import type { AffiliateSessionStatus, WhatsAppStatus } from "@/lib/agent-api";

export const whatsappLabels: Record<WhatsAppStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando…",
  disconnected: "Desconectado",
  qr: "Aguardando QR code",
  banned: "Banido",
};

export const whatsappColors: Record<WhatsAppStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning",
  disconnected: "bg-mute",
  qr: "bg-accent",
  banned: "bg-danger",
};

export const affiliateLabels: Record<AffiliateSessionStatus, string> = {
  valid: "Válida",
  expired: "Expirada",
  unknown: "Desconhecida",
};

export const affiliateColors: Record<AffiliateSessionStatus, string> = {
  valid: "bg-success",
  expired: "bg-danger",
  unknown: "bg-mute",
};
