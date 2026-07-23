/**
 * Fonte scraper: página pública de ofertas do Mercado Livre.
 * Usa Playwright (chromium headless) com múltiplas estratégias de seletor,
 * já que o layout da página muda com frequência.
 *
 * Nota: a extração usa a API de Locators (lado Node) em vez de page.evaluate,
 * pois o tsconfig do monorepo não inclui a lib DOM.
 */

import { createHash } from "node:crypto";
import { chromium } from "playwright";
import type { Locator, Page } from "playwright";
import type { NewOfferInput } from "@ml-agent/core";

const OFFERS_URL = "https://www.mercadolivre.com.br/ofertas";

/** Limite de cards processados por coleta (controla round-trips com o browser). */
const MAX_CARDS = 60;

/** Converte "R$ 1.234,56" (ou variações) em número. */
function parseBrlPrice(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/\s+/g, " ").match(/(?:R\$\s*)?([\d.]+)(?:,(\d{1,2}))?/);
  if (!match || !match[1]) return null;
  const intPart = match[1].replace(/\./g, "");
  const cents = match[2] ?? "0";
  const value = Number.parseFloat(`${intPart}.${cents}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Extrai "35" de textos como "35% OFF". */
function parseDiscountPct(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d{1,3})\s*%/);
  if (!match || !match[1]) return null;
  const pct = Number.parseInt(match[1], 10);
  return pct > 0 && pct <= 100 ? pct : null;
}

/** Extrai o MLB id da URL; se não houver, deriva um id estável do hash da URL. */
function extractItemId(url: string): string {
  // Cobre /MLB-123456789-..., /p/MLB123456789, item_id=MLB123456789 etc.
  const match = url.match(/MLB-?(\d{6,})/i);
  if (match?.[1]) return `MLB${match[1]}`;
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  return `URL-${hash}`;
}

/** Remove parâmetros de tracking, mantendo a URL canônica do produto. */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

/** textContent aparado do primeiro match do locator, ou null se não existir. */
async function textIfAny(loc: Locator): Promise<string | null> {
  const first = loc.first();
  if ((await first.count()) === 0) return null;
  const text = (await first.textContent())?.trim();
  return text || null;
}

/** Primeiro texto não-vazio entre vários seletores dentro do card. */
async function firstText(card: Locator, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    const text = await textIfAny(card.locator(sel));
    if (text) return text;
  }
  return null;
}

/** Primeiro atributo não-vazio entre vários seletores dentro do card. */
async function firstAttr(
  card: Locator,
  selectors: string[],
  attrs: string[],
): Promise<string | null> {
  for (const sel of selectors) {
    const loc = card.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    for (const attr of attrs) {
      const value = (await loc.getAttribute(attr))?.trim();
      if (value) return value;
    }
  }
  return null;
}

/**
 * Lê um valor monetário de um componente andes-money-amount, que separa
 * inteiro (fraction) e centavos (cents) em spans distintos — concatenar o
 * textContent direto produziria "1.23456". Cai para o texto bruto se não
 * houver os spans.
 */
async function readMoney(card: Locator, containerSelectors: string[]): Promise<number | null> {
  for (const sel of containerSelectors) {
    const container = card.locator(sel).first();
    if ((await container.count()) === 0) continue;

    const fraction = await textIfAny(container.locator('[class*="fraction"]'));
    if (fraction) {
      const cents = await textIfAny(container.locator('[class*="cents"]'));
      const value = parseBrlPrice(`${fraction},${cents ?? "00"}`);
      if (value != null) return value;
    }

    const value = parseBrlPrice(await textIfAny(container));
    if (value != null) return value;
  }
  return null;
}

/**
 * Escolhe a melhor estratégia de seletor de cards: poly-card (layout atual),
 * andes-card (layout anterior) ou fallback genérico por link de produto.
 */
async function pickCards(page: Page): Promise<Locator[]> {
  const strategies: Locator[] = [
    page.locator('[class*="poly-card"]'),
    page.locator('.andes-card, [class*="andes-card"]'),
    page
      .locator("li, article")
      .filter({ has: page.locator('a[href*="/p/MLB"], a[href*="MLB-"]') }),
  ];

  for (const strategy of strategies) {
    const count = await strategy.count();
    // Só aceitamos a estratégia se ela achou um volume plausível de cards.
    if (count >= 3) {
      const max = Math.min(count, MAX_CARDS);
      return Array.from({ length: max }, (_, i) => strategy.nth(i));
    }
  }
  return [];
}

/** Extrai uma oferta de um card; retorna null se faltar dado essencial. */
async function parseCard(card: Locator, baseUrl: string): Promise<NewOfferInput | null> {
  const href = await firstAttr(
    card,
    ['a[href*="/p/MLB"]', 'a[href*="MLB-"]', 'a[href*="mercadolivre.com"]', "a[href]"],
    ["href"],
  );
  if (!href) return null;

  let url: string;
  try {
    url = cleanUrl(new URL(href, baseUrl).toString());
  } catch {
    return null;
  }

  const title =
    (await firstText(card, [
      '[class*="poly-component__title"]',
      '[class*="promotion-item__title"]',
      '[class*="ui-search-item__title"]',
      "h2",
      "h3",
    ])) ?? (await firstAttr(card, ["a[href]"], ["title"]));
  if (!title) return null;

  const price = await readMoney(card, [
    '[class*="poly-price__current"] .andes-money-amount',
    '[class*="poly-price__current"]',
    '[class*="price-current"]',
    ".andes-money-amount:not(.andes-money-amount--previous)",
  ]);
  if (price == null) return null;

  let originalPrice = await readMoney(card, [
    ".andes-money-amount--previous",
    "s",
    "del",
    '[class*="original-price"]',
    '[class*="price__original"]',
  ]);
  if (originalPrice != null && originalPrice <= price) originalPrice = null;

  // Desconto: badge tem prioridade; senão calculamos a partir dos preços.
  let discountPct = parseDiscountPct(
    await firstText(card, [
      '[class*="poly-price__disc"]',
      '[class*="promotion-item__discount"]',
      '[class*="discount"]',
    ]),
  );
  if (discountPct == null && originalPrice != null) {
    discountPct = Math.round(((originalPrice - price) / originalPrice) * 1000) / 10;
  }

  const rawImage = await firstAttr(card, ["img"], ["data-src", "src"]);
  const imageUrl =
    rawImage && /^https?:\/\//.test(rawImage)
      ? rawImage.replace(/^http:\/\//, "https://")
      : null;

  return {
    itemId: extractItemId(url),
    title,
    url,
    price,
    originalPrice,
    discountPct,
    // A página de ofertas não expõe frete de forma confiável nos cards.
    freeShipping: false,
    imageUrl,
    category: null,
    seller: null,
    source: "scraper",
  };
}

/**
 * Coleta ofertas da página pública /ofertas do Mercado Livre.
 * Lança erro se nenhum card for reconhecido, para o chamador poder alertar
 * sobre possível mudança de layout.
 */
export async function collectFromScraper(): Promise<NewOfferInput[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      locale: "pt-BR",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(OFFERS_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Espera algum indício de cards; se nenhum seletor conhecido aparecer,
    // ainda tentamos extrair — o fallback genérico pode encontrar algo.
    await page
      .waitForSelector('[class*="poly-card"], .andes-card, a[href*="/p/MLB"], a[href*="MLB-"]', {
        timeout: 20_000,
      })
      .catch(() => {
        console.warn(
          "[scraper] nenhum seletor conhecido apareceu no timeout — tentando extrair mesmo assim",
        );
      });

    const cards = await pickCards(page);
    const baseUrl = page.url();

    const offers: NewOfferInput[] = [];
    const seen = new Set<string>();

    for (const card of cards) {
      try {
        const offer = await parseCard(card, baseUrl);
        if (offer && !seen.has(offer.itemId)) {
          seen.add(offer.itemId);
          offers.push(offer);
        }
      } catch {
        // Card individual quebrado (detached, layout parcial) — segue o baile.
      }
    }

    if (offers.length === 0) {
      throw new Error("scraper: nenhum card reconhecido — layout pode ter mudado");
    }

    return offers;
  } finally {
    await browser.close();
  }
}
