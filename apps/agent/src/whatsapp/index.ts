/**
 * Módulo WhatsApp do agente — transporte via Evolution API v2.
 * Ponto único de import para o resto do app.
 */

export { EvolutionSender } from "./evolution.js";
export { parseEvolutionWebhook } from "./webhook.js";
export type { DisconnectionEvent } from "./webhook.js";
export type { WhatsAppSender } from "@ml-agent/core";
