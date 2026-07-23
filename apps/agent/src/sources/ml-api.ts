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

/**
 * A busca clássica /sites/MLB/search foi bloqueada (403) para apps de terceiros
 * em 2026. Usamos a API de catálogo, que continua acessível com OAuth:
 *   1. /products/search?q=... → lista de produtos do catálogo (id, name)
 *   2. /products/{id}/items   → ofertas reais do produto (price, shipping, deal_ids)
 */

/** Produto do catálogo retornado por /products/search. */
interface MlCatalogProduct {
  id: string;
  name: string;
}
interface MlProductsSearchResponse {
  results: MlCatalogProduct[];
}

/** Detalhe do produto de catálogo (para permalink e imagem). */
interface MlProductDetail {
  permalink?: string | null;
  pictures?: { url?: string }[];
}

/** Item (oferta real) de um produto de catálogo, via /products/{id}/items. */
interface MlProductItem {
  item_id?: string;
  price?: number | null;
  original_price?: number | null;
  category_id?: string | null;
  deal_ids?: string[];
  shipping?: { free_shipping?: boolean };
}
interface MlProductItemsResponse {
  results: MlProductItem[];
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

/** Quantos produtos buscar por palavra-chave (cada um vira 1 chamada de itens). */
const PRODUCTS_PER_KEYWORD = 10;

/** GET autenticado que devolve JSON; null em erro (logado pelo chamador). */
async function apiGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${ML_API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** URL de produto a partir do id de catálogo, quando o permalink não vem. */
function fallbackProductUrl(productId: string): string {
  return `https://www.mercadolivre.com.br/p/${productId}`;
}

/**
 * Monta uma oferta a partir de um produto de catálogo + sua melhor oferta (item).
 * Retorna null quando não há preço válido.
 */
function buildOffer(
  product: MlCatalogProduct,
  detail: MlProductDetail | null,
  item: MlProductItem | null,
): NewOfferInput | null {
  const price = item?.price ?? null;
  if (typeof price !== "number" || price <= 0) return null;

  const originalPrice = item?.original_price ?? null;
  const url = detail?.permalink || fallbackProductUrl(product.id);
  const imageUrl = detail?.pictures?.[0]?.url?.replace(/^http:\/\//, "https://") ?? null;

  return {
    // Prefere o item_id real (MLBxxxxxx do anúncio) para dedup; senão o id do produto.
    itemId: item?.item_id ?? product.id,
    title: product.name,
    url,
    price,
    originalPrice: originalPrice != null && originalPrice > price ? originalPrice : null,
    discountPct: computeDiscountPct(price, originalPrice),
    freeShipping: item?.shipping?.free_shipping ?? false,
    imageUrl,
    category: item?.category_id ?? null,
    seller: null, // não exposto pela API de catálogo
    source: "ml-api",
  };
}

/**
 * Coleta ofertas na API oficial do ML (API de catálogo) para cada palavra-chave.
 *
 * A busca clássica foi bloqueada (403) em 2026; usamos /products/search seguido
 * de /products/{id}/items para obter o preço real. Erros por palavra-chave ou
 * por produto são tolerados. Sem credenciais, a fonte é desativada.
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
      const search = await apiGet<MlProductsSearchResponse>(
        accessToken,
        `/products/search?site_id=MLB&status=active&q=${encodeURIComponent(keyword)}&limit=${PRODUCTS_PER_KEYWORD}`,
      );
      if (!search) {
        console.error(`[ml-api] /products/search falhou para "${keyword}"`);
        continue;
      }

      for (const product of search.results ?? []) {
        if (seen.has(product.id)) continue;
        // Busca a melhor oferta (item) e o detalhe (permalink/imagem) em paralelo.
        const [items, detail] = await Promise.all([
          apiGet<MlProductItemsResponse>(accessToken, `/products/${product.id}/items`),
          apiGet<MlProductDetail>(accessToken, `/products/${product.id}`),
        ]);
        const bestItem = items?.results?.[0] ?? null;
        const offer = buildOffer(product, detail, bestItem);
        if (offer && !seen.has(offer.itemId)) {
          seen.add(product.id);
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
