// Autenticação do painel: uma senha única para o operador.
//
// Por que assim: o dashboard é um proxy stateless (não tem banco nem acesso ao
// Drizzle), então não há onde guardar sessões. A solução é um cookie que se
// autovalida — ele carrega a data de expiração e uma assinatura HMAC dessa
// data. O servidor recomputa a assinatura com o segredo; se bater, o cookie é
// legítimo. Ninguém consegue forjar um sem conhecer DASHBOARD_SESSION_SECRET.
//
// Roda no Edge Runtime (middleware), então usa Web Crypto — `node:crypto` não
// existe lá.

const COOKIE_NAME = "painel_sessao";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** Converte bytes para hexadecimal. */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Assina um texto com HMAC-SHA256, devolvendo hexadecimal. */
async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return toHex(signature);
}

/**
 * Compara duas strings em tempo constante.
 *
 * Um `===` normal para de comparar no primeiro caractere diferente, e o tempo
 * que ele leva vaza informação sobre quantos caracteres iniciais estavam
 * certos. Repetindo o teste, dá para descobrir o valor caractere a caractere.
 * Aqui o tempo é sempre o mesmo, independente de onde está a diferença.
 */
function equalsConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Deriva o hash da senha (SHA-256 com o segredo como sal). */
async function hashPassword(password: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}:${password}`),
  );
  return toHex(digest);
}

/** Confere a senha digitada contra a configurada em DASHBOARD_PASSWORD. */
export async function verifyPassword(
  attempt: string,
  password: string,
  secret: string,
): Promise<boolean> {
  // Compara os hashes (não as senhas cruas) para que o tempo de comparação
  // não dependa do tamanho da senha real.
  const [a, b] = await Promise.all([
    hashPassword(attempt, secret),
    hashPassword(password, secret),
  ]);
  return equalsConstantTime(a, b);
}

/** Cria o valor do cookie de sessão: "expiraEm.assinatura". */
export async function createSessionValue(secret: string): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_DURATION_MS);
  const signature = await sign(expiresAt, secret);
  return `${expiresAt}.${signature}`;
}

/** Valida o cookie: assinatura correta e ainda dentro do prazo. */
export async function isValidSession(
  cookieValue: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!cookieValue) return false;

  const separator = cookieValue.lastIndexOf(".");
  if (separator === -1) return false;

  const expiresAt = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);

  const expected = await sign(expiresAt, secret);
  if (!equalsConstantTime(signature, expected)) return false;

  const timestamp = Number(expiresAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_DURATION_MS / 1000,
} as const;
