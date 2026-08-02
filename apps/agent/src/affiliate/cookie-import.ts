/**
 * Importação de cookies do portal de afiliados (fluxo VPS-friendly).
 *
 * O operador faz login no próprio navegador (Windows/Chrome), exporta os
 * cookies e cola no dashboard. Aceita vários formatos comuns para não
 * exigir SSH nem copiar a pasta data/.
 */

import { dirname, join } from "node:path";
import { chromium } from "playwright";
import type { AgentEnv } from "@ml-agent/core";
import { saveSession, type PortalCookie } from "./session.js";
import { getSessionStatus } from "./linkbuilder.js";

const DEFAULT_DOMAIN = ".mercadolivre.com.br";
const DEFAULT_PATH = "/";

/** Domínios aceitos no import (mesma regra da extração Playwright). */
function isPortalDomain(domain: string): boolean {
  const d = domain.startsWith(".") ? domain.slice(1) : domain;
  return (
    d === "mercadolivre.com.br" ||
    d.endsWith(".mercadolivre.com.br") ||
    d === "mercadolibre.com" ||
    d.endsWith(".mercadolibre.com")
  );
}

function normalizeDomain(raw: string | undefined): string {
  const d = (raw ?? DEFAULT_DOMAIN).trim();
  if (!d) return DEFAULT_DOMAIN;
  // Cookie-Editor às vezes manda host completo sem ponto inicial.
  if (!d.startsWith(".") && /mercadolivre|mercadolibre/i.test(d) && !d.startsWith("www.")) {
    return `.${d}`;
  }
  return d;
}

function asCookie(partial: {
  name?: unknown;
  value?: unknown;
  domain?: unknown;
  path?: unknown;
  expires?: unknown;
  expirationDate?: unknown;
}): PortalCookie | null {
  if (typeof partial.name !== "string" || !partial.name.trim()) return null;
  if (typeof partial.value !== "string") return null;
  const domain = normalizeDomain(
    typeof partial.domain === "string" ? partial.domain : undefined,
  );
  if (!isPortalDomain(domain)) return null;

  let expires: number | undefined;
  const expRaw = partial.expires ?? partial.expirationDate;
  if (typeof expRaw === "number" && Number.isFinite(expRaw) && expRaw > 0) {
    // Cookie-Editor usa segundos; alguns exports usam ms.
    expires = expRaw > 1e12 ? Math.floor(expRaw / 1000) : Math.floor(expRaw);
  }

  return {
    name: partial.name.trim(),
    value: partial.value,
    domain,
    path:
      typeof partial.path === "string" && partial.path.trim()
        ? partial.path.trim()
        : DEFAULT_PATH,
    expires,
  };
}

/** Extrai o header Cookie: de um cURL ou de uma linha solta. */
function extractCookieHeader(text: string): string | null {
  const curlMatch = text.match(/-H\s+['"]Cookie:\s*([^'"]+)['"]/i)
    ?? text.match(/--header\s+['"]Cookie:\s*([^'"]+)['"]/i);
  if (curlMatch?.[1]) return curlMatch[1];

  const headerMatch = text.match(/^\s*Cookie:\s*(.+)$/im);
  if (headerMatch?.[1]) return headerMatch[1].trim();

  return null;
}

/** Parseia `a=1; b=2` (header Cookie ou document.cookie). */
function parseCookieHeader(header: string): PortalCookie[] {
  const out: PortalCookie[] = [];
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Ignora atributos que às vezes vazam em colas ruins.
    if (/^(path|domain|expires|max-age|secure|httponly|samesite)$/i.test(name)) continue;
    const cookie = asCookie({ name, value, domain: DEFAULT_DOMAIN, path: DEFAULT_PATH });
    if (cookie) out.push(cookie);
  }
  return out;
}

/** Formato Netscape / cookies.txt (uma linha por cookie). */
function parseNetscape(text: string): PortalCookie[] {
  const out: PortalCookie[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cols = trimmed.split("\t");
    if (cols.length < 7) continue;
    const [domain, , path, , expiresRaw, name, value] = cols;
    if (!domain || !name || value === undefined) continue;
    const expiresNum = Number(expiresRaw);
    const cookie = asCookie({
      name,
      value,
      domain,
      path: path || DEFAULT_PATH,
      expires: Number.isFinite(expiresNum) && expiresNum > 0 ? expiresNum : undefined,
    });
    if (cookie) out.push(cookie);
  }
  return out;
}

/** name=value por linha (export simples / planilha). */
function parseNameValueLines(text: string): PortalCookie[] {
  const out: PortalCookie[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Tab-separated name\tvalue (DevTools copy)
    if (trimmed.includes("\t")) {
      const [name, value, ...rest] = trimmed.split("\t");
      // DevTools às vezes cola: name, value, domain, path...
      const domain = rest[0];
      const path = rest[1];
      const cookie = asCookie({ name, value, domain, path });
      if (cookie) out.push(cookie);
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    const cookie = asCookie({ name, value });
    if (cookie) out.push(cookie);
  }
  return out;
}

/**
 * Interpreta o texto colado pelo operador.
 * Ordem: JSON → Cookie header / cURL → Netscape → linhas name=value.
 */
export function parseCookiePaste(raw: string): PortalCookie[] {
  const text = raw.trim();
  if (!text) return [];

  // JSON (Cookie-Editor, EditThisCookie, array nosso, ou { cookies: [...] })
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed !== null &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { cookies?: unknown }).cookies)
          ? ((parsed as { cookies: unknown[] }).cookies)
          : [];
      const cookies = list
        .map((item) =>
          item !== null && typeof item === "object"
            ? asCookie(item as Record<string, unknown>)
            : null,
        )
        .filter((c): c is PortalCookie => c !== null);
      if (cookies.length > 0) return dedupeCookies(cookies);
    } catch {
      // cai nos outros formatos
    }
  }

  const header = extractCookieHeader(text);
  if (header) {
    const fromHeader = parseCookieHeader(header);
    if (fromHeader.length > 0) return dedupeCookies(fromHeader);
  }

  // Header puro sem prefixo Cookie: (só se parece com a=b; c=d)
  if (/^[^=;\s]+=[^;]*(;\s*[^=;\s]+=[^;]*)+$/.test(text.replace(/\s+/g, " ").trim())) {
    const fromHeader = parseCookieHeader(text);
    if (fromHeader.length > 0) return dedupeCookies(fromHeader);
  }

  const netscape = parseNetscape(text);
  if (netscape.length > 0) return dedupeCookies(netscape);

  return dedupeCookies(parseNameValueLines(text));
}

function dedupeCookies(cookies: PortalCookie[]): PortalCookie[] {
  const map = new Map<string, PortalCookie>();
  for (const c of cookies) {
    map.set(`${c.domain}|${c.path}|${c.name}`, c);
  }
  return [...map.values()];
}

/** Injeta cookies no profile Playwright para renovação headless futura. */
export async function seedPlaywrightProfile(
  env: AgentEnv,
  cookies: PortalCookie[],
): Promise<void> {
  const profileDir = join(dirname(env.DATABASE_PATH), "playwright-profile");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
  });
  try {
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || DEFAULT_PATH,
        ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
      })),
    );
  } finally {
    await context.close().catch(() => {});
  }
}

export type ImportSessionResult = {
  ok: true;
  cookieCount: number;
  session: "valid" | "expired" | "unknown";
} | {
  ok: false;
  error: string;
};

/**
 * Salva cookies colados, semeia o profile Playwright e valida a sessão
 * contra o hub de afiliados.
 */
export async function importAffiliateSession(
  env: AgentEnv,
  rawPaste: string,
): Promise<ImportSessionResult> {
  const cookies = parseCookiePaste(rawPaste);
  if (cookies.length === 0) {
    return {
      ok: false,
      error:
        "Não encontrei cookies válidos do Mercado Livre no texto colado. Exporte com a extensão Cookie-Editor (JSON) ou cole o cabeçalho Cookie de uma requisição ao portal.",
    };
  }
  if (cookies.length < 2) {
    return {
      ok: false,
      error:
        "Parece incompleto — só veio 1 cookie. Exporte todos os cookies de mercadolivre.com.br (incluindo HttpOnly).",
    };
  }

  await saveSession(env, cookies);

  // Best-effort: se o seed do profile falhar, a sessão HTTP ainda serve
  // para gerar links; só a renovação headless fica mais frágil.
  try {
    await seedPlaywrightProfile(env, cookies);
  } catch {
    // ignorado — createLink usa só o .enc
  }

  const session = await getSessionStatus(env);
  if (session === "expired") {
    return {
      ok: false,
      error:
        "Os cookies foram salvos, mas o portal ainda pede login. Faça login de novo no navegador, exporte cookies frescos e cole outra vez.",
    };
  }

  return { ok: true, cookieCount: cookies.length, session };
}
