import type { AffiliateSessionStatus, WhatsAppStatus } from "@/lib/agent-api";

export const whatsappLabels: Record<WhatsAppStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando…",
  disconnected: "Desconectado",
  qr: "Aguardando QR code",
  banned: "Banido",
};

export const whatsappColors: Record<WhatsAppStatus, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-500",
  disconnected: "bg-neutral-500",
  qr: "bg-sky-500",
  banned: "bg-red-500",
};

export const affiliateLabels: Record<AffiliateSessionStatus, string> = {
  valid: "Válida",
  expired: "Expirada",
  unknown: "Desconhecida",
};

export const affiliateColors: Record<AffiliateSessionStatus, string> = {
  valid: "bg-emerald-500",
  expired: "bg-red-500",
  unknown: "bg-neutral-500",
};
