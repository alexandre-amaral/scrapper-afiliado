/**
 * Fluxo OAuth2 (authorization code + PKCE) da API oficial do Mercado Livre.
 *
 * 1. /oauth/start → gera code_verifier/code_challenge, redireciona para a tela
 *    de consentimento do ML com o challenge.
 * 2. ML volta em /oauth/callback?code=... → trocamos o code (mais o verifier)
 *    por access + refresh token e persistimos ML_REFRESH_TOKEN no cofre.
 *
 * O ML exige PKCE (code_challenge_method=S256). O redirect_uri precisa bater
 * EXATAMENTE com o cadastrado no app do DevCenter.
 */

import { createHash, randomBytes } from "node:crypto";
import type { AgentEnv } from "@ml-agent/core";
import type { Db } from "@ml-agent/db";
import { resolveEnv, saveSecrets } from "./secrets.js";

const ML_AUTH_BASE = "https://auth.mercadolivre.com.br"; // domínio BR da autorização
const ML_API_BASE = "https://api.mercadolibre.com";

/**
 * Guarda o code_verifier entre /oauth/start e /oauth/callback.
 * Fluxo single-user local → estado em memória basta (perde-se ao reiniciar,
 * mas a autorização inteira dura segundos).
 */
let pendingVerifier: string | null = null;

/** base64url sem padding, como exige o RFC 7636. */
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gera o par PKCE: verifier aleatório + challenge S256. */
function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32)); // 43 chars, dentro do range 43–128
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** redirect_uri usado no fluxo — deve ser idêntico ao cadastrado no app ML. */
export function redirectUri(env: AgentEnv): string {
  const base = env.PUBLIC_URL?.trim() || `http://localhost:${env.AGENT_PORT}`;
  return `${base.replace(/\/+$/, "")}/oauth/callback`;
}

/** URL de consentimento para onde /oauth/start redireciona (com PKCE). */
export async function buildAuthUrl(db: Db, env: AgentEnv): Promise<string> {
  const resolved = await resolveEnv(db, env);
  if (!resolved.ML_CLIENT_ID) {
    throw new Error("ML_CLIENT_ID não configurado — cadastre o app no DevCenter e salve em Credenciais.");
  }
  const { verifier, challenge } = makePkce();
  pendingVerifier = verifier; // guardado para a troca do code

  const params = new URLSearchParams({
    response_type: "code",
    client_id: resolved.ML_CLIENT_ID,
    redirect_uri: redirectUri(resolved),
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${ML_AUTH_BASE}/authorization?${params.toString()}`;
}

interface MlTokenExchange {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: number;
}

/**
 * Troca o `code` recebido no callback (mais o code_verifier do PKCE) por
 * access + refresh token e salva o ML_REFRESH_TOKEN no cofre.
 */
export async function exchangeCode(db: Db, env: AgentEnv, code: string): Promise<{ userId?: number }> {
  const resolved = await resolveEnv(db, env);
  if (!resolved.ML_CLIENT_ID || !resolved.ML_CLIENT_SECRET) {
    throw new Error("ML_CLIENT_ID/ML_CLIENT_SECRET ausentes — salve-os em Credenciais antes de autorizar.");
  }
  const verifier = pendingVerifier;
  if (!verifier) {
    throw new Error(
      "code_verifier ausente — reinicie a autorização a partir de /oauth/start (não recarregue o callback direto).",
    );
  }

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: resolved.ML_CLIENT_ID,
      client_secret: resolved.ML_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri(resolved),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Troca de code falhou (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as MlTokenExchange;
  if (!data.refresh_token) {
    throw new Error("Resposta do ML sem refresh_token — confira o scope offline_access no app.");
  }

  await saveSecrets(db, env, { ML_REFRESH_TOKEN: data.refresh_token });
  pendingVerifier = null; // consumido
  return { userId: data.user_id };
}
