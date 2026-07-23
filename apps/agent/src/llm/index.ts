/**
 * Módulo LLM do agente — ranking de ofertas e composição de mensagens.
 * BYOK: o provider é criado a partir do env validado (ver provider.ts).
 */

export { getModel } from "./provider.js";
export { rankOffers } from "./ranking.js";
export { composeMessage, fallbackTemplate } from "./composer.js";
