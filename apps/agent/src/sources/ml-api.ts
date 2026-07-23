/**
 * Fonte oficial: API do Mercado Livre.
 * Autentica via OAuth2 (refresh_token) e busca ofertas por palavra-chave
 * em /sites/MLB/search, normalizando os resultados para NewOfferInput.
 */

import type { AgentEnv, NewOfferInput } from "@ml-agent/core";

const ML_API_BASE = "https://api.mercadolibre.com";

/** Margem de segurança antes do token expirar de fato (ms). */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Resposta do endpoint OAuth do ML (campos que usamos). */
interface MlTokenResponse {
  access_token: string;
  expires_in: number; // segundos
}

/** Item retornado pela busca do ML (campos que usamos). */
interface MlSearchResult {
  id: string;
  title: string;
  permalink: string;
  price: number;
  original_price: number | null;
  thumbnail: string | null;
  category_id: string | null;
  shipping?: { free_shipping?: boolean };
  seller?: { nickname?: string | null };
  sale_price?: {
    amount?: number | null;
    regular_amount?: number | null;
  } | null;
}

interface MlSearchResponse {
  results: MlSearchResult[];
}

/** Cache do token em memória de módulo — evita renovar a cada chamada. */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Obtém um access token válido, renovando via refresh_token quando o cache
 * está vazio ou expirado.
 */
async function getAccessToken(env: AgentEnv): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ML_CLIENT_ID,
      client_secret: env.ML_CLIENT_SECRET,
      refresh_token: env.ML_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ml-api: falha ao renovar token (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as MlTokenResponse;
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  };
  return cachedToken.accessToken;
}

/** Calcula o percentual de desconto (0–100) a partir dos preços. */
function computeDiscountPct(price: number, originalPrice: number | null): number | null {
  if (originalPrice == null || originalPrice <= 0 || originalPrice <= price) return null;
  const pct = ((originalPrice - price) / originalPrice) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}

/** Normaliza um resultado da busca para o contrato compartilhado. */
function mapResult(item: MlSearchResult): NewOfferInput | null {
  // Preferimos sale_price quando presente (promoções relâmpago usam esse campo).
  const price = item.sale_price?.amount ?? item.price;
  const originalPrice = item.sale_price?.regular_amount ?? item.original_price ?? null;

  if (!item.id || !item.title || !item.permalink || typeof price !== "number" || price <= 0) {
    return null;
  }

  // Thumbnails vêm em http:// e baixa resolução — normalizamos para https.
  const imageUrl = item.thumbnail ? item.thumbnail.replace(/^http:\/\//, "https://") : null;

  return {
    itemId: item.id,
    title: item.title,
    url: item.permalink,
    price,
    originalPrice: originalPrice != null && originalPrice > price ? originalPrice : null,
    discountPct: computeDiscountPct(price, originalPrice),
    freeShipping: item.shipping?.free_shipping ?? false,
    imageUrl,
    category: item.category_id ?? null,
    seller: item.seller?.nickname ?? null,
    source: "ml-api",
  };
}

/**
 * Coleta ofertas na API oficial do ML para cada palavra-chave.
 * Erros por palavra-chave são tolerados (log + continua); sem credenciais,
 * a fonte é considerada desativada e retorna lista vazia.
 */
export async function collectFromMlApi(
  env: AgentEnv,
  keywords: string[],
): Promise<NewOfferInput[]> {
  if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET || !env.ML_REFRESH_TOKEN) {
    console.warn("[ml-api] credenciais ausentes — fonte desativada (retornando lista vazia)");
    return [];
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    console.error(`[ml-api] erro ao autenticar: ${err instanceof Error ? err.message : err}`);
    return [];
  }

  const offers: NewOfferInput[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    try {
      const url = new URL(`${ML_API_BASE}/sites/MLB/search`);
      url.searchParams.set("q", keyword);
      url.searchParams.set("limit", "50");

      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[ml-api] busca por "${keyword}" falhou (HTTP ${res.status}): ${body.slice(0, 200)}`,
        );
        continue;
      }

      const data = (await res.json()) as MlSearchResponse;
      for (const item of data.results ?? []) {
        const offer = mapResult(item);
        // Dedup entre palavras-chave dentro do mesmo ciclo de coleta.
        if (offer && !seen.has(offer.itemId)) {
          seen.add(offer.itemId);
          offers.push(offer);
        }
      }
    } catch (err) {
      console.error(
        `[ml-api] erro na palavra-chave "${keyword}": ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return offers;
}
