/**
 * Parsing dos webhooks da Evolution API.
 * Interessa-nos apenas o evento de desconexão (connection.update com
 * state "close") — usado para pausar o agente automaticamente.
 */

/** Evento de desconexão detectado num webhook da Evolution. */
export interface DisconnectionEvent {
  instance: string;
  state: string;
  raw: unknown;
}

/**
 * Interpreta o corpo de um webhook da Evolution.
 * Formato esperado: { event: "connection.update", instance, data: { state } }.
 * Retorna o evento apenas quando o estado indica desconexão ("close");
 * caso contrário, null. Nunca lança — parsing 100% defensivo.
 */
export function parseEvolutionWebhook(body: unknown): DisconnectionEvent | null {
  try {
    if (typeof body !== "object" || body === null) return null;
    const record = body as Record<string, unknown>;

    const event = record["event"];
    if (typeof event !== "string" || event !== "connection.update") return null;

    const data = record["data"];
    if (typeof data !== "object" || data === null) return null;
    const state = (data as Record<string, unknown>)["state"];
    if (typeof state !== "string" || state !== "close") return null;

    const instance = record["instance"];
    return {
      instance: typeof instance === "string" ? instance : "",
      state,
      raw: body,
    };
  } catch {
    // Qualquer formato inesperado é ignorado silenciosamente.
    return null;
  }
}
