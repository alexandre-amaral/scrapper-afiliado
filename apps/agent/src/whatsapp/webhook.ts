/**
 * Parsing dos webhooks da Evolution API.
 * Interessa-nos o evento de desconexão (connection.update /
 * CONNECTION_UPDATE com state indicando queda) — usado para pausar
 * o agente automaticamente.
 */

/** Evento de desconexão detectado num webhook da Evolution. */
export interface DisconnectionEvent {
  instance: string;
  state: string;
  raw: unknown;
}

/**
 * Interpreta o corpo de um webhook da Evolution.
 * Formatos aceitos (v2 e forks):
 *   { event: "connection.update", instance, data: { state } }
 *   { event: "CONNECTION_UPDATE", instance, data: { state } }
 *   { event: "logout.instance"|"LOGOUT_INSTANCE", ... }
 *
 * Retorna o evento quando o estado indica desconexão/logout/ban;
 * caso contrário, null. Nunca lança — parsing 100% defensivo.
 */
export function parseEvolutionWebhook(body: unknown): DisconnectionEvent | null {
  try {
    if (typeof body !== "object" || body === null) return null;
    const record = body as Record<string, unknown>;

    const event = record["event"];
    if (typeof event !== "string") return null;

    const normalizedEvent = event.toLowerCase().replace(/_/g, ".");
    const isConnection =
      normalizedEvent === "connection.update" ||
      normalizedEvent === "logout.instance" ||
      normalizedEvent === "remove.instance";
    if (!isConnection) return null;

    const data = record["data"];
    let state = "";
    if (typeof data === "object" && data !== null) {
      const rawState = (data as Record<string, unknown>)["state"];
      if (typeof rawState === "string") state = rawState;
      const statusReason = (data as Record<string, unknown>)["statusReason"];
      // statusReason 401/403 costuma acompanhar logout forçado / ban.
      if (
        !state &&
        (statusReason === 401 ||
          statusReason === 403 ||
          statusReason === "401" ||
          statusReason === "403")
      ) {
        state = "close";
      }
    }

    // LOGOUT_INSTANCE / REMOVE_INSTANCE sem state explícito → tratar como queda.
    if (!state && (normalizedEvent === "logout.instance" || normalizedEvent === "remove.instance")) {
      state = "logout";
    }

    if (!state) return null;
    if (!/close|disconnect|logout|logged.?out|banned|refused/i.test(state)) {
      return null;
    }

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
