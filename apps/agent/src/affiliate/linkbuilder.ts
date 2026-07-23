/**
 * Camada rápida (HTTP) da geração de links de afiliado.
 *
 * O Programa de Afiliados do ML não expõe API pública de geração de link —
 * aqui reutilizamos os cookies da sessão logada do portal para chamar o mesmo
 * endpoint interno (`createUrl`) que o linkbuilder do hub usa. Quando a sessão
 * expira, lançamos SessionExpiredError e o chamador aciona a camada de
 * resiliência Playwright (portal-login.ts).
 */

import { setTimeout as sleep } from "node:timers/promises";
import { fetch } from "undici";
import type { AgentEnv, AffiliateSessionStatus } from "@ml-agent/core";
import { loadSession, type PortalCookie } from "./session.js";

export type { AffiliateSessionStatus };

/** URL do hub de afiliados — usada para checagem leve de sessão. */
const HUB_URL = "https://www.mercadolivre.com.br/afiliados/hub";

/** Endpoint interno chamado pelo linkbuilder do portal. */
const CREATE_URL_ENDPOINT =
  "https://www.mercadolivre.com.br/affiliate-program/api/affiliates/v1/createUrl";

/** User-Agent realista — o endpoint interno rejeita clients "não-browser". */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Tamanho de lote por chamada ao createUrl. */
const BATCH_SIZE = 10;

/** Lançado quando a sessão do portal expirou ou a resposta é irreconhecível. */
export class SessionExpiredError extends Error {
  constructor(message = "Sessão do portal de afiliados expirada ou inválida") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

/** Cookie ainda válido e aplicável ao host do portal? */
function isCookieUsable(cookie: PortalCookie, host: string): boolean {
  if (cookie.expires !== undefined && cookie.expires > 0 && cookie.expires * 1000 < Date.now()) {
    return false;
  }
  // Match de domínio estilo RFC 6265: ".mercadolivre.com.br" cobre subdomínios.
  const domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  return host === domain || host.endsWith(`.${domain}`);
}

/** Monta o header Cookie para o host do portal. */
function buildCookieHeader(cookies: PortalCookie[], host = "www.mercadolivre.com.br"): string {
  return cookies
    .filter((c) => isCookieUsable(c, host))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/** Headers comuns às chamadas autenticadas contra o portal. */
function portalHeaders(cookieHeader: string): Record<string, string> {
  return {
    "user-agent": USER_AGENT,
    cookie: cookieHeader,
    accept: "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9",
    "x-requested-with": "XMLHttpRequest",
    referer: "https://www.mercadolivre.com.br/afiliados/linkbuilder",
  };
}

/** URL de redirect aponta para tela de login? */
function isLoginRedirect(location: string): boolean {
  return /login|registration|\/jms\//i.test(location);
}

/**
 * Checagem leve do status da sessão: GET no hub de afiliados sem seguir
 * redirects — sessão válida responde 200; expirada redireciona para login.
 */
export async function getSessionStatus(env: AgentEnv): Promise<AffiliateSessionStatus> {
  const cookies = await loadSession(env);
  if (!cookies || cookies.length === 0) return "unknown";

  const cookieHeader = buildCookieHeader(cookies);
  if (!cookieHeader) return "unknown";

  try {
    const res = await fetch(HUB_URL, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        cookie: cookieHeader,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });

    if (res.status === 200) return "valid";
    if (res.status === 401 || res.status === 403) return "expired";
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "";
      return isLoginRedirect(location) ? "expired" : "valid";
    }
    return "unknown";
  } catch {
    // Falha de rede não significa sessão inválida — não alarmar o dashboard.
    return "unknown";
  }
}

/**
 * Extrai o short link de uma entrada da resposta, tolerando os shapes que o
 * endpoint interno já apresentou: { short_url }, { shortUrl }, { url }.
 */
function extractShortUrl(entry: unknown): string | null {
  if (typeof entry === "string") return entry.startsWith("http") ? entry : null;
  if (typeof entry !== "object" || entry === null) return null;
  const obj = entry as Record<string, unknown>;
  for (const key of ["short_url", "shortUrl", "url", "link"]) {
    const value = obj[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return null;
}

/**
 * Extrai a URL longa (de origem) de uma entrada da resposta, quando presente —
 * usada para mapear resposta → URL de entrada nos lotes.
 */
function extractLongUrl(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null) return null;
  const obj = entry as Record<string, unknown>;
  for (const key of ["long_url", "longUrl", "original_url", "originalUrl"]) {
    const value = obj[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return null;
}

/** POST no createUrl para um lote de URLs; retorna as entradas cruas da resposta. */
async function callCreateUrl(env: AgentEnv, productUrls: string[]): Promise<unknown[]> {
  const cookies = await loadSession(env);
  if (!cookies || cookies.length === 0) {
    throw new SessionExpiredError("Nenhuma sessão do portal persistida — faça login primeiro");
  }
  const cookieHeader = buildCookieHeader(cookies);
  if (!cookieHeader) {
    throw new SessionExpiredError("Cookies da sessão expiraram — renovação necessária");
  }

  const res = await fetch(CREATE_URL_ENDPOINT, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...portalHeaders(cookieHeader),
      "content-type": "application/json",
      origin: "https://www.mercadolivre.com.br",
    },
    body: JSON.stringify({ urls: productUrls }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new SessionExpiredError(`createUrl respondeu ${res.status} — sessão expirada`);
  }
  if (res.status >= 300 && res.status < 400) {
    // Redirect para login também sinaliza sessão morta.
    throw new SessionExpiredError("createUrl redirecionou — sessão expirada");
  }
  if (!res.ok) {
    throw new Error(`createUrl falhou com status ${res.status}`);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    // Resposta não-JSON (ex.: HTML de login servido com 200) = sessão inválida.
    throw new SessionExpiredError("createUrl retornou resposta não-JSON — sessão expirada");
  }

  // Shapes conhecidos: { urls: [...] } | { data: { urls: [...] } } | objeto único.
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.urls)) return obj.urls;
    const data = obj.data;
    if (typeof data === "object" && data !== null) {
      const dataUrls = (data as Record<string, unknown>).urls;
      if (Array.isArray(dataUrls)) return dataUrls;
    }
    return [payload]; // shape { short_url } direto
  }
  if (Array.isArray(payload)) return payload;

  throw new SessionExpiredError("Resposta do createUrl em formato irreconhecível");
}

/** Gera o link de afiliado para uma única URL de produto. */
export async function generateAffiliateLink(env: AgentEnv, productUrl: string): Promise<string> {
  const entries = await callCreateUrl(env, [productUrl]);
  const shortUrl = entries.map(extractShortUrl).find((u): u is string => u !== null);
  if (!shortUrl) {
    throw new SessionExpiredError("createUrl não retornou short link — resposta inesperada");
  }
  return shortUrl;
}

/** Jitter entre lotes: 1–2s, imitando cadência humana no portal. */
function jitterDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Versão em lote: divide em blocos de 10 URLs por chamada, sequencial, com
 * jitter de 1–2s entre blocos. Retorna Map<urlOriginal, shortLink> — URLs sem
 * resposta correspondente simplesmente ficam de fora do Map.
 */
export async function generateAffiliateLinks(
  env: AgentEnv,
  productUrls: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (let i = 0; i < productUrls.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(jitterDelayMs());

    const chunk = productUrls.slice(i, i + BATCH_SIZE);
    const entries = await callCreateUrl(env, chunk);

    entries.forEach((entry, index) => {
      const shortUrl = extractShortUrl(entry);
      if (!shortUrl) return;
      // Preferir o mapeamento pela long_url da resposta; fallback pela posição.
      const longUrl = extractLongUrl(entry);
      const inputUrl = longUrl && chunk.includes(longUrl) ? longUrl : chunk[index];
      if (inputUrl !== undefined && !result.has(inputUrl)) {
        result.set(inputUrl, shortUrl);
      }
    });
  }

  return result;
}
