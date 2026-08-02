/**
 * Camada de resiliência (Playwright) da sessão do portal de afiliados.
 *
 * Quando a camada HTTP falha (SessionExpiredError), o agente abre o portal
 * com um contexto persistente do Chromium:
 *  - headless: tenta renovar a sessão em silêncio (o profile em disco muitas
 *    vezes ainda está logado mesmo com os cookies persistidos vencidos);
 *  - interativo: abre o navegador para o usuário completar login/2FA
 *    manualmente e captura os cookies ao final.
 *
 * Login interativo exige interface gráfica na máquina do AGENTE (não no
 * navegador do dashboard). Em VPS headless sem DISPLAY, não funciona —
 * use o fluxo “Colar cookies” do dashboard (login no Chrome do operador).
 */

import { dirname, join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { AgentEnv } from "@ml-agent/core";
import { saveSession, type PortalCookie } from "./session.js";

/**
 * Esta máquina consegue abrir um Chromium visível para o operador logar?
 * Linux sem DISPLAY/WAYLAND = VPS headless típica → false.
 * Override: AFFILIATE_INTERACTIVE=0 força off; =1 força on.
 */
export function canOpenVisibleBrowser(): boolean {
  const override = process.env.AFFILIATE_INTERACTIVE?.trim();
  if (override === "0" || override === "false") return false;
  if (override === "1" || override === "true") return true;
  if (process.platform === "linux") {
    return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  }
  // macOS / Windows: assume sessão gráfica local.
  return true;
}

/** Mensagem amigável quando o login interativo é impossível nesta máquina. */
export const INTERACTIVE_UNAVAILABLE_MSG =
  "Este servidor não tem tela gráfica — o botão Conectar abriria um navegador no servidor, onde ninguém vê. Em Credenciais, use “Colar cookies da sessão”: faça login no portal no seu Chrome e cole os cookies no painel.";

/** Página do linkbuilder — redireciona para login quando deslogado. */
const LINKBUILDER_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder";

/** Tempo máximo (ms) esperando o usuário completar login/2FA no modo interativo. */
const INTERACTIVE_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/** Intervalo (ms) entre checagens de "já logou?". */
const POLL_INTERVAL_MS = 2000;

/** Diretório do profile persistente do Chromium, junto ao banco. */
function profileDir(env: AgentEnv): string {
  return join(dirname(env.DATABASE_PATH), "playwright-profile");
}

/**
 * Carrega uma URL num navegador real (profile persistente) e devolve o HTML.
 *
 * Necessário porque o ML passou a barrar `fetch` puro com uma página de
 * verificação anti-bot (account-verification) — só um navegador de verdade,
 * com a sessão do profile, chega ao HTML do produto. Retorna null em falha.
 */
export async function fetchPageHtml(env: AgentEnv, url: string): Promise<string | null> {
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir(env), { headless: true });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Se caiu na verificação anti-bot, não há dados de produto para extrair.
    if (/account-verification|\/gz\//i.test(page.url())) return null;
    return await page.content();
  } catch {
    return null;
  } finally {
    await context?.close().catch(() => {});
  }
}

/** A URL atual é uma tela de login/registro do ML? */
function isLoginUrl(url: string): boolean {
  return /login|registration|\/jms\/|account-verification|two_factor|2fa/i.test(url);
}

/** Domínios cujos cookies interessam à camada HTTP. */
function isPortalDomain(domain: string): boolean {
  const d = domain.startsWith(".") ? domain.slice(1) : domain;
  return (
    d === "mercadolivre.com.br" ||
    d.endsWith(".mercadolivre.com.br") ||
    d === "mercadolibre.com" ||
    d.endsWith(".mercadolibre.com")
  );
}

/** Extrai do contexto os cookies dos domínios do portal e persiste criptografado. */
async function extractAndSaveCookies(env: AgentEnv, context: BrowserContext): Promise<void> {
  const all = await context.cookies();
  const portalCookies: PortalCookie[] = all
    .filter((c) => isPortalDomain(c.domain))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      // Playwright usa -1 para cookies de sessão — normalizamos para ausente.
      expires: c.expires > 0 ? c.expires : undefined,
    }));
  await saveSession(env, portalCookies);
}

/** A página parece estar logada no hub (fora da tela de login)? */
async function isLoggedIn(page: Page): Promise<boolean> {
  if (isLoginUrl(page.url())) return false;
  // Confirmação extra: conteúdo do hub/linkbuilder visível (tolerante a layout).
  const hubMarker = page
    .locator("text=/linkbuilder|afiliad/i")
    .first();
  return (await hubMarker.count()) > 0 || page.url().includes("/afiliados");
}

/**
 * Abre o linkbuilder num Chromium visível e espera (até 5 min) o usuário
 * completar login/2FA manualmente, caso o profile persistido esteja deslogado.
 * Ao detectar sessão ativa, extrai e persiste os cookies do portal.
 */
export async function refreshSessionInteractive(
  env: AgentEnv,
  opts: { headless?: boolean } = {},
): Promise<void> {
  const headless = opts.headless ?? false;
  if (!headless && !canOpenVisibleBrowser()) {
    throw new Error(INTERACTIVE_UNAVAILABLE_MSG);
  }

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir(env), {
      headless,
      viewport: { width: 1280, height: 800 },
      locale: "pt-BR",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (!headless && /display|x server|headless|no usable|browser has been closed/i.test(detail)) {
      throw new Error(INTERACTIVE_UNAVAILABLE_MSG);
    }
    throw new Error(`Não foi possível abrir o navegador para login: ${detail}`);
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(LINKBUILDER_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const deadline = Date.now() + INTERACTIVE_LOGIN_TIMEOUT_MS;
    let loggedIn = await isLoggedIn(page);

    // Espera ativa: o usuário resolve login + 2FA no navegador aberto.
    while (!loggedIn && Date.now() < deadline) {
      await page.waitForTimeout(POLL_INTERVAL_MS);
      loggedIn = await isLoggedIn(page);
    }

    if (!loggedIn) {
      throw new Error(
        "Login no portal de afiliados não foi concluído em 5 minutos — tente novamente",
      );
    }

    // Pequena folga para o portal terminar de assentar cookies pós-login.
    await page.waitForTimeout(1500);
    await extractAndSaveCookies(env, context);
  } finally {
    await context.close();
  }
}

/**
 * Tentativa silenciosa de renovação: abre o mesmo profile persistente em modo
 * headless. Se o profile ainda estiver logado, re-extrai e salva os cookies e
 * retorna true. Se cair na tela de login, retorna false — o chamador alerta o
 * dashboard que é preciso login interativo.
 */
export async function tryRefreshSessionHeadless(env: AgentEnv): Promise<boolean> {
  const context = await chromium.launchPersistentContext(profileDir(env), {
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(LINKBUILDER_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Dá tempo para redirects de SSO/login se resolverem sozinhos.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    if (!(await isLoggedIn(page))) {
      return false; // paredão de login — precisa de intervenção humana
    }

    await extractAndSaveCookies(env, context);
    return true;
  } catch {
    // Qualquer falha (rede, timeout) = não conseguimos renovar em silêncio.
    return false;
  } finally {
    await context.close();
  }
}
