/**
 * Fonte manual: URLs de produto coladas pelo usuário no dashboard.
 * Faz fetch simples do HTML e extrai metadados via JSON-LD (Product),
 * Open Graph e regex de fallback — sem navegador.
 */

import { createHash } from "node:crypto";
import type { NewOfferInput } from "@ml-agent/core";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Decodifica entidades HTML comuns em conteúdo de meta tags. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

/** Lê o content de uma meta tag por property/name, tolerando ordem de atributos. */
function extractMeta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/** Nó JSON-LD com os campos de Product/Offer que usamos. */
interface JsonLdProduct {
  name?: string;
  image?: string | string[] | { url?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}
interface JsonLdOffer {
  price?: number | string;
  lowPrice?: number | string;
}

/** Procura um bloco JSON-LD com @type Product e extrai nome/imagem/preço. */
function extractJsonLdProduct(
  html: string,
): { name: string | null; image: string | null; price: number | null } | null {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse((match[1] ?? "").trim());
    } catch {
      continue; // JSON-LD malformado — tenta o próximo bloco.
    }

    // Pode ser um objeto único, um array ou um @graph.
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])
        ? ((parsed as { "@graph": unknown[] })["@graph"] as unknown[])
        : [parsed];

    for (const node of candidates) {
      if (!node || typeof node !== "object") continue;
      const type = (node as { "@type"?: string | string[] })["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) continue;

      const product = node as JsonLdProduct;
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const rawPrice = offer?.price ?? offer?.lowPrice;
      const price =
        rawPrice != null && Number.isFinite(Number(rawPrice)) && Number(rawPrice) > 0
          ? Number(rawPrice)
          : null;

      let image: string | null = null;
      if (typeof product.image === "string") image = product.image;
      else if (Array.isArray(product.image) && typeof product.image[0] === "string") {
        image = product.image[0];
      } else if (product.image && typeof product.image === "object" && "url" in product.image) {
        image = (product.image as { url?: string }).url ?? null;
      }

      return { name: product.name ?? null, image, price };
    }
  }
  return null;
}

/** Último recurso: regex por atributos/chaves "price" no HTML. */
function extractPriceByRegex(html: string): number | null {
  const patterns = [
    /itemprop=["']price["'][^>]+content=["']([\d.]+)["']/i,
    /content=["']([\d.]+)["'][^>]+itemprop=["']price["']/i,
    /["']price["']\s*:\s*"?([\d]+(?:\.[\d]+)?)"?/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

/** Extrai o MLB id da URL; se não houver, deriva um id estável do hash da URL. */
function extractItemId(url: string): string {
  const match = url.match(/MLB-?(\d{6,})/i);
  if (match) return `MLB${match[1]}`;
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  return `URL-${hash}`;
}

/** Valida que a string é uma URL http(s) absoluta. */
function asHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Processa uma lista de URLs de produto coladas manualmente.
 * Cada URL que falhar (rede, HTML sem metadados, sem preço) é logada e pulada.
 */
export async function parseManualUrls(urls: string[]): Promise<NewOfferInput[]> {
  const offers: NewOfferInput[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        console.error(`[manual] HTTP ${res.status} ao buscar ${url} — pulando`);
        continue;
      }
      const html = await res.text();

      const jsonLd = extractJsonLdProduct(html);
      const title = jsonLd?.name ?? extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title");
      const price =
        jsonLd?.price ??
        (() => {
          const metaPrice = extractMeta(html, "product:price:amount") ?? extractMeta(html, "og:price:amount");
          const parsed = metaPrice ? Number.parseFloat(metaPrice) : NaN;
          return Number.isFinite(parsed) && parsed > 0 ? parsed : extractPriceByRegex(html);
        })();

      if (!title || price == null) {
        console.error(`[manual] não foi possível extrair título/preço de ${url} — pulando`);
        continue;
      }

      const imageUrl = asHttpUrl(jsonLd?.image ?? extractMeta(html, "og:image"));
      // Tenta o MLB id na URL original; se não houver, tenta na canônica (og:url).
      const canonicalUrl = asHttpUrl(extractMeta(html, "og:url")) ?? url;
      let itemId = extractItemId(url);
      if (itemId.startsWith("URL-") && canonicalUrl !== url) {
        const fromCanonical = extractItemId(canonicalUrl);
        if (!fromCanonical.startsWith("URL-")) itemId = fromCanonical;
      }

      if (seen.has(itemId)) continue;
      seen.add(itemId);

      offers.push({
        itemId,
        title,
        url,
        price,
        // Fonte manual não expõe preço original/desconto de forma confiável.
        originalPrice: null,
        discountPct: null,
        freeShipping: false,
        imageUrl,
        category: null,
        seller: null,
        source: "manual",
      });
    } catch (err) {
      console.error(`[manual] erro ao processar ${url}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return offers;
}
