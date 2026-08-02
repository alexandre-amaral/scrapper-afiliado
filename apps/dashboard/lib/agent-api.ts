// Cliente server-side da API REST do agente.
// Usa AGENT_URL + AGENT_TOKEN (somente no servidor — o token nunca vai ao client).

// ----- Tipos da API -----

export type WhatsAppStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "qr"
  | "banned";

export type AffiliateSessionStatus = "valid" | "expired" | "unknown";

export type MessageStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "sent"
  | "failed"
  | "rejected";

export interface Message {
  id: string;
  offerId: string;
  body: string;
  status: MessageStatus;
  groupId: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface Run {
  id: string;
  kind?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string | null;
  detail?: string | null;
  [key: string]: unknown;
}

export interface Overview {
  whatsapp: WhatsAppStatus;
  affiliateSession: AffiliateSessionStatus;
  paused: boolean;
  nextMessages: Message[];
  lastSent: Message[];
  lastRuns: Run[];
}

export type OfferSource = string; // ex.: "ml-api" | "scraper" | "manual"

export interface Offer {
  id: string;
  itemId: string;
  title: string;
  url: string;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  freeShipping: boolean;
  imageUrl: string | null;
  source: OfferSource;
  collectedAt: string;
}

export interface Group {
  id: string;
  name: string;
  enabled: boolean;
  maxPerDay: number;
}

export interface AgentFilters {
  minDiscountPct: number;
  minPrice: number | null;
  maxPrice: number | null;
  blockedSellers: string[];
  blockedCategories: string[];
  dedupWindowHours: number;
}

export interface AgentSettings {
  filters: AgentFilters;
  autoApprove: boolean;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendIntervalMinutes: number;
  sendJitterMinutes: number;
  composerPrompt: string;
  keywords: string[];
  rankTopN: number;
  paused: boolean;
}

export interface QrResponse {
  qr: string | null;
  /** Mensagem amigável quando o QR não pôde ser gerado. */
  error?: string | null;
}

// ----- Diagnóstico -----

export type CheckStatus = "ok" | "warn" | "error";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** O que o operador deve fazer; null quando está tudo certo. */
  action: string | null;
  href: string;
}

export interface Diagnostics {
  ready: boolean;
  errors: number;
  warnings: number;
  checks: DiagnosticCheck[];
}

// ----- Credenciais -----

export interface CredentialsStatus {
  gemini: { configured: boolean; source: "dashboard" | "env" | "none" };
  llmModel: string;
  ml: {
    clientId: string;
    clientSecretConfigured: boolean;
    refreshTokenConfigured: boolean;
    source: "dashboard" | "env" | "none";
  };
  affiliateTag: string;
  sensitiveFields: string[];
  /** URL pública do agente para o operador autorizar a API oficial do ML. */
  mlOAuthStartUrl?: string;
  /** redirect_uri a cadastrar no DevCenter do ML. */
  mlOAuthRedirectUri?: string;
}

export interface AffiliateLoginState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  error: string | null;
}

export interface AffiliateStatus {
  session: AffiliateSessionStatus;
  login: AffiliateLoginState;
  /** false em VPS headless — login interativo não abre janela visível. */
  interactiveAvailable?: boolean;
}

// ----- Cliente -----

export class AgentApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AgentApiError";
  }
}

export function agentUrlForDisplay(): string {
  return process.env.AGENT_URL ?? "(AGENT_URL não definida)";
}

export async function agentFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.AGENT_URL;
  if (!baseUrl) {
    throw new AgentApiError(
      "AGENT_URL não está configurada. Defina AGENT_URL e AGENT_TOKEN no .env (ou nas variáveis de ambiente da Vercel).",
    );
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.AGENT_TOKEN ?? ""}`,
        ...(init.body != null ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new AgentApiError(
      `Agente não alcançável em ${baseUrl} — verifique AGENT_URL/AGENT_TOKEN.`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        detail = parsed.error;
      }
    } catch {
      // corpo não-JSON — mantém o texto cru
    }
    throw new AgentApiError(
      detail
        ? detail
        : `Agente respondeu ${res.status} em ${path}`,
      res.status,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// Variante segura para páginas: nunca lança — devolve um resultado
// discriminado para renderizar um aviso amigável em vez de quebrar.
export type AgentResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function tryAgent<T>(path: string): Promise<AgentResult<T>> {
  try {
    return { ok: true, data: await agentFetch<T>(path) };
  } catch (err) {
    if (err instanceof AgentApiError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: `Agente não alcançável em ${agentUrlForDisplay()} — verifique AGENT_URL/AGENT_TOKEN.`,
    };
  }
}
