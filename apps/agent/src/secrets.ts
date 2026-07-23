/**
 * Cofre de segredos configuráveis pelo dashboard.
 *
 * Guarda credenciais sensíveis (chave Gemini, client_id/secret/refresh do ML)
 * no SQLite, criptografadas em repouso com AES-256-GCM — mesma cripto usada
 * para os cookies do portal de afiliados (SESSION_ENCRYPTION_KEY).
 *
 * Fluxo: o dashboard grava via PATCH /credentials; o agente lê em runtime
 * através de resolveEnv(), que sobrepõe estes segredos ao .env base. Assim os
 * consumidores (provider LLM, ml-api) continuam recebendo um AgentEnv normal,
 * sem saber de onde a credencial veio.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AgentEnv } from "@ml-agent/core";
import { settings, type Db } from "@ml-agent/db";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SECRETS_KEY = "secrets"; // linha na tabela k/v settings

/** Campos de segredo que o dashboard pode gerenciar. */
export type StoredSecrets = {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  LLM_MODEL?: string;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
  ML_REFRESH_TOKEN?: string;
  ML_AFFILIATE_TAG?: string;
};

const SECRET_FIELDS: (keyof StoredSecrets)[] = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "LLM_MODEL",
  "ML_CLIENT_ID",
  "ML_CLIENT_SECRET",
  "ML_REFRESH_TOKEN",
  "ML_AFFILIATE_TAG",
];

/** Campos tratados como sensíveis — nunca devolvidos em claro ao dashboard. */
const SENSITIVE_FIELDS: (keyof StoredSecrets)[] = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "ML_CLIENT_SECRET",
  "ML_REFRESH_TOKEN",
];

function deriveKey(env: AgentEnv): Buffer {
  return createHash("sha256").update(env.SESSION_ENCRYPTION_KEY, "utf8").digest();
}

function encrypt(env: AgentEnv, plaintext: string): string {
  const key = deriveKey(env);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

function decrypt(env: AgentEnv, blob: string): string | null {
  try {
    const raw = Buffer.from(blob, "base64");
    if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) return null;
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ct = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(env), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // chave trocada ou blob corrompido
  }
}

/** Lê e descriptografa os segredos salvos (vazio se nada configurado). */
export async function loadSecrets(db: Db, env: AgentEnv): Promise<StoredSecrets> {
  const rows = await db.select().from(settings).where(eq(settings.key, SECRETS_KEY)).limit(1);
  if (rows.length === 0) return {};
  const plain = decrypt(env, rows[0]!.value);
  if (!plain) return {};
  try {
    const parsed: unknown = JSON.parse(plain);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StoredSecrets;
  } catch {
    return {};
  }
}

/** Grava um patch parcial de segredos (só campos não-vazios sobrescrevem). */
export async function saveSecrets(db: Db, env: AgentEnv, patch: StoredSecrets): Promise<void> {
  const current = await loadSecrets(db, env);
  const next: StoredSecrets = { ...current };
  for (const field of SECRET_FIELDS) {
    const value = patch[field];
    // string vazia = "limpar"; undefined = "não mexer"
    if (value === undefined) continue;
    if (value === "") delete next[field];
    else next[field] = value;
  }
  const now = new Date().toISOString();
  const blob = encrypt(env, JSON.stringify(next));
  await db
    .insert(settings)
    .values({ key: SECRETS_KEY, value: blob, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: blob, updatedAt: now } });
}

/**
 * Env efetivo em runtime: base do .env com os segredos do banco sobrepostos.
 * Só sobrepõe campos não-vazios, então o .env continua sendo fallback.
 */
export async function resolveEnv(db: Db, env: AgentEnv): Promise<AgentEnv> {
  const secrets = await loadSecrets(db, env);
  const resolved: AgentEnv = { ...env };
  for (const field of SECRET_FIELDS) {
    const value = secrets[field];
    if (value) (resolved as Record<string, unknown>)[field] = value;
  }
  return resolved;
}

/**
 * Visão segura pro dashboard: campos sensíveis viram booleano "configurado?",
 * campos não-sensíveis (client_id, modelo) retornam o valor em claro.
 * Também informa se a origem é o banco ou o .env.
 */
export async function getCredentialsStatus(db: Db, env: AgentEnv) {
  const secrets = await loadSecrets(db, env);
  const has = (field: keyof StoredSecrets) => Boolean(secrets[field] || env[field as keyof AgentEnv]);

  return {
    gemini: {
      configured: has("GOOGLE_GENERATIVE_AI_API_KEY"),
      source: secrets.GOOGLE_GENERATIVE_AI_API_KEY
        ? "dashboard"
        : env.GOOGLE_GENERATIVE_AI_API_KEY
          ? "env"
          : "none",
    },
    llmModel: secrets.LLM_MODEL || env.LLM_MODEL,
    ml: {
      clientId: secrets.ML_CLIENT_ID || env.ML_CLIENT_ID || "",
      clientSecretConfigured: has("ML_CLIENT_SECRET"),
      refreshTokenConfigured: has("ML_REFRESH_TOKEN"),
      source: secrets.ML_CLIENT_ID ? "dashboard" : env.ML_CLIENT_ID ? "env" : "none",
    },
    affiliateTag: secrets.ML_AFFILIATE_TAG || env.ML_AFFILIATE_TAG || "",
    sensitiveFields: SENSITIVE_FIELDS,
  };
}
