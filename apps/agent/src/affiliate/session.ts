/**
 * Persistência criptografada da sessão do portal de afiliados.
 *
 * Os cookies do portal logado são serializados em JSON e gravados em disco
 * com AES-256-GCM (chave derivada de SESSION_ENCRYPTION_KEY). O arquivo fica
 * ao lado do banco SQLite: <dir do DATABASE_PATH>/affiliate-session.enc.
 *
 * Formato do arquivo (binário): [ iv (12 bytes) | authTag (16 bytes) | ciphertext ].
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentEnv } from "@ml-agent/core";

/** Cookie do portal, no formato mínimo necessário para replay HTTP e Playwright. */
export type PortalCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Epoch em segundos; ausente = cookie de sessão. */
  expires?: number;
};

const IV_LENGTH = 12; // tamanho recomendado de IV para GCM
const AUTH_TAG_LENGTH = 16;

/** Deriva a chave AES de 32 bytes a partir da env (sha256 do valor bruto). */
function deriveKey(env: AgentEnv): Buffer {
  return createHash("sha256").update(env.SESSION_ENCRYPTION_KEY, "utf8").digest();
}

/** Caminho do arquivo de sessão, junto ao banco de dados. */
export function sessionFilePath(env: AgentEnv): string {
  return join(dirname(env.DATABASE_PATH), "affiliate-session.enc");
}

/** Criptografa e grava os cookies do portal em disco. */
export async function saveSession(env: AgentEnv, cookies: PortalCookie[]): Promise<void> {
  const filePath = sessionFilePath(env);
  await mkdir(dirname(filePath), { recursive: true });

  const key = deriveKey(env);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(JSON.stringify(cookies), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  await writeFile(filePath, Buffer.concat([iv, authTag, ciphertext]), { mode: 0o600 });
}

/**
 * Lê e descriptografa a sessão persistida.
 * Retorna null se o arquivo não existir, estiver corrompido ou a chave mudou —
 * o chamador trata como "sessão desconhecida" e dispara o fluxo de re-login.
 */
export async function loadSession(env: AgentEnv): Promise<PortalCookie[] | null> {
  let raw: Buffer;
  try {
    raw = await readFile(sessionFilePath(env));
  } catch {
    return null; // arquivo ausente ou ilegível
  }

  if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) return null;

  try {
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv("aes-256-gcm", deriveKey(env), iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const parsed: unknown = JSON.parse(plaintext.toString("utf8"));
    if (!Array.isArray(parsed)) return null;

    // Validação defensiva do shape — descarta tudo se algum item for inválido.
    const valid = parsed.every(
      (c): c is PortalCookie =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as PortalCookie).name === "string" &&
        typeof (c as PortalCookie).value === "string" &&
        typeof (c as PortalCookie).domain === "string" &&
        typeof (c as PortalCookie).path === "string",
    );
    return valid ? (parsed as PortalCookie[]) : null;
  } catch {
    return null; // authTag inválido (chave trocada) ou JSON corrompido
  }
}
