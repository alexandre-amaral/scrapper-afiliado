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

/**
 * Endpoint interno chamado pelo linkbuilder do portal (capturado via DevTools
 * na sessão logada em jul/2026). Payload: { urls: string[], tag: string }.
 * Resposta: { status, urls: [{ short_url, origin_url, error_code, message, status }],
 * total_success, total_error }. O link de afiliado sai em `short_url` (meli.la).
 */
const CREATE_LINK_ENDPOINT =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

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

/** Uma entrada do array `urls` na resposta do createLink. */
interface CreateLinkEntry {
  short_url?: string;
  origin_url?: string;
  long_url?: string;
  error_code?: number;
  message?: string;
  status?: number;
}

/** Lançado quando um item específico é rejeitado pelo programa (ex.: URL inelegível). */
export class LinkNotAllowedError extends Error {
  constructor(
    public readonly originUrl: string,
    public readonly code: number,
    message: string,
  ) {
    super(`URL rejeitada pelo programa de afiliados (código ${code}): ${message}`);
    this.name = "LinkNotAllowedError";
  }
}

/** Resolve a tag de afiliado a ser usada no payload (env → obrigatória). */
function resolveTag(env: AgentEnv): string {
  const tag = env.ML_AFFILIATE_TAG?.trim();
  if (!tag) {
    throw new SessionExpiredError(
      "ML_AFFILIATE_TAG não configurada — defina a etiqueta de afiliado (ex.: abcd1234567) " +
        "nas Credenciais do dashboard ou no .env.",
    );
  }
  return tag;
}

/**
 * POST no createLink para um lote de URLs; retorna as entradas cruas da resposta.
 * Contrato real (capturado do portal): body { urls, tag };
 * resposta { status, urls: CreateLinkEntry[], total_success, total_error }.
 */
async function callCreateLink(env: AgentEnv, productUrls: string[]): Promise<CreateLinkEntry[]> {
  const cookies = await loadSession(env);
  if (!cookies || cookies.length === 0) {
    throw new SessionExpiredError("Nenhuma sessão do portal persistida — faça login primeiro");
  }
  const cookieHeader = buildCookieHeader(cookies);
  if (!cookieHeader) {
    throw new SessionExpiredError("Cookies da sessão expiraram — renovação necessária");
  }

  const res = await fetch(CREATE_LINK_ENDPOINT, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...portalHeaders(cookieHeader),
      "content-type": "application/json",
      origin: "https://www.mercadolivre.com.br",
    },
    body: JSON.stringify({ urls: productUrls, tag: resolveTag(env) }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new SessionExpiredError(`createLink respondeu ${res.status} — sessão expirada`);
  }
  if (res.status >= 300 && res.status < 400) {
    // Redirect para login também sinaliza sessão morta.
    throw new SessionExpiredError("createLink redirecionou — sessão expirada");
  }
  if (!res.ok) {
    throw new Error(`createLink falhou com status ${res.status}`);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    // Resposta não-JSON (ex.: HTML de login servido com 200) = sessão inválida.
    throw new SessionExpiredError("createLink retornou resposta não-JSON — sessão expirada");
  }

  if (typeof payload === "object" && payload !== null && Array.isArray((payload as { urls?: unknown }).urls)) {
    return (payload as { urls: CreateLinkEntry[] }).urls;
  }
  throw new SessionExpiredError("Resposta do createLink em formato irreconhecível");
}

/** Sucesso de item = error_code ausente/zero E short_url presente. */
function entryShortUrl(entry: CreateLinkEntry): string | null {
  if (entry.error_code && entry.error_code !== 0) return null;
  const url = entry.short_url;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

/** Gera o link de afiliado para uma única URL de produto. */
export async function generateAffiliateLink(env: AgentEnv, productUrl: string): Promise<string> {
  const entries = await callCreateLink(env, [productUrl]);
  const entry = entries[0];
  if (!entry) {
    throw new SessionExpiredError("createLink não retornou nenhuma entrada — resposta inesperada");
  }
  const shortUrl = entryShortUrl(entry);
  if (!shortUrl) {
    // Item rejeitado (ex.: código 111 "URL not allowed") — erro do item, não da sessão.
    throw new LinkNotAllowedError(
      entry.origin_url ?? productUrl,
      entry.error_code ?? -1,
      entry.message ?? "sem short_url na resposta",
    );
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
    const entries = await callCreateLink(env, chunk);

    entries.forEach((entry, index) => {
      const shortUrl = entryShortUrl(entry);
      if (!shortUrl) return; // item rejeitado — fica de fora do Map
      // Preferir o mapeamento pela origin_url da resposta; fallback pela posição.
      const originUrl = entry.origin_url;
      const inputUrl = originUrl && chunk.includes(originUrl) ? originUrl : chunk[index];
      if (inputUrl !== undefined && !result.has(inputUrl)) {
        result.set(inputUrl, shortUrl);
      }
    });
  }

  return result;
}
