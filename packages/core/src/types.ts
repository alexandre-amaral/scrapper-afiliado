/**
 * Tipos compartilhados entre agente, dashboard e pacotes.
 * Fonte da verdade dos contratos do pipeline:
 * coleta → filtro/ranking → link de afiliado → composição → disparo.
 */

/** De onde a oferta veio. */
export type OfferSource = "ml-api" | "scraper" | "manual";

/** Ciclo de vida de uma mensagem na fila. */
export type MessageStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "sent"
  | "failed"
  | "rejected";

/** Status da sessão do portal de afiliados. */
export type AffiliateSessionStatus = "valid" | "expired" | "unknown";

/** Status da conexão WhatsApp (instância Evolution). */
export type WhatsAppStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "qr" // aguardando leitura de QR code
  | "banned";

/** Oferta normalizada, independente da fonte. */
export interface Offer {
  id: number;
  /** MLB id do item (ex.: MLB123456789) — chave de dedup. */
  itemId: string;
  title: string;
  url: string;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  freeShipping: boolean;
  imageUrl: string | null;
  category: string | null;
  seller: string | null;
  source: OfferSource;
  collectedAt: string; // ISO 8601
}

export interface AffiliateLink {
  id: number;
  offerId: number;
  /** Link final de afiliado gerado pelo linkbuilder. */
  shortUrl: string;
  createdAt: string;
}

export interface Message {
  id: number;
  offerId: number;
  affiliateLinkId: number | null;
  /** Texto final a ser enviado (composto pelo LLM ou template fallback). */
  body: string;
  status: MessageStatus;
  /** Grupo de destino (JID do WhatsApp). */
  groupId: string;
  scheduledFor: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface Group {
  id: string; // JID, ex.: 1203630XXXX@g.us
  name: string;
  enabled: boolean;
  /** Máximo de mensagens por dia neste grupo. */
  maxPerDay: number;
}

export interface RunLog {
  id: number;
  job: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  detail: string | null;
}

/** Filtros aplicados na etapa de seleção de ofertas. */
export interface OfferFilters {
  minDiscountPct: number;
  minPrice: number | null;
  maxPrice: number | null;
  blockedSellers: string[];
  blockedCategories: string[];
  /** Não repostar o mesmo itemId dentro desta janela (horas). */
  dedupWindowHours: number;
}

/** Configurações operacionais editáveis pelo dashboard (tabela settings). */
export interface AgentSettings {
  filters: OfferFilters;
  /** true = mensagens vão direto para scheduled; false = exigem aprovação. */
  autoApprove: boolean;
  /** Janela de envio, horário local. */
  sendWindowStart: string; // "09:00"
  sendWindowEnd: string; // "21:00"
  /** Intervalo base entre envios (minutos) — jitter é aplicado por cima. */
  sendIntervalMinutes: number;
  /** Jitter máximo somado/subtraído do intervalo (minutos). */
  sendJitterMinutes: number;
  /** Prompt-base do compositor de mensagens (editável no dashboard). */
  composerPrompt: string;
  /** Palavras-chave monitoradas na API oficial do ML. */
  keywords: string[];
  /** Quantas ofertas o ranking LLM deve escolher por ciclo. */
  rankTopN: number;
  /** Pausa global (ativada automaticamente ao detectar desconexão/ban). */
  paused: boolean;
}

/** Interface do transporte de saída — implementada por Evolution (e futuramente Telegram). */
export interface WhatsAppSender {
  sendText(groupId: string, text: string): Promise<{ messageId: string }>;
  getStatus(): Promise<WhatsAppStatus>;
  /** Retorna o QR code (base64) quando status === "qr". */
  getQrCode(): Promise<string | null>;
  listGroups(): Promise<Group[]>;
}
