/**
 * Adapter da Evolution API v2 — implementa o contrato WhatsAppSender.
 * Transporte trocável: se um dia migrarmos de Evolution, basta trocar
 * esta classe mantendo a interface (ver ARQUITETURA.md, seção 2).
 */

import type { AgentEnv } from "@ml-agent/core";
import type { Group, WhatsAppSender, WhatsAppStatus } from "@ml-agent/core";

/** Valor padrão de mensagens/dia para grupos recém-descobertos. */
const DEFAULT_MAX_PER_DAY = 5;

/** Erro HTTP com corpo da resposta para facilitar diagnóstico. */
class EvolutionApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = "EvolutionApiError";
  }
}

export class EvolutionSender implements WhatsAppSender {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor(env: AgentEnv) {
    // Remove barra final para montar URLs de forma previsível.
    this.baseUrl = env.EVOLUTION_URL.replace(/\/+$/, "");
    this.apiKey = env.EVOLUTION_API_KEY;
    this.instance = env.EVOLUTION_INSTANCE;
  }

  /** Requisição base — sempre JSON com header de apikey. */
  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: unknown }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text; // Resposta não-JSON — mantém o texto cru para o erro.
    }

    if (!res.ok) {
      throw new EvolutionApiError(
        res.status,
        text,
        `Evolution API ${method} ${path} falhou (${res.status}): ${text}`,
      );
    }
    return { status: res.status, data };
  }

  /**
   * Garante que a instância exista na Evolution.
   * Tolera erros de "já existe" (403/409 ou mensagem correspondente).
   */
  async ensureInstance(): Promise<void> {
    try {
      await this.request("POST", "/instance/create", {
        instanceName: this.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
    } catch (err) {
      if (err instanceof EvolutionApiError) {
        const alreadyExists =
          err.status === 403 ||
          err.status === 409 ||
          /already (in use|exists)|j[áa] existe/i.test(err.body);
        if (alreadyExists) return;
      }
      throw err;
    }
  }

  /** Envia texto para um grupo (JID, ex.: 1203630XXXX@g.us). */
  async sendText(groupId: string, text: string): Promise<{ messageId: string }> {
    const { data } = await this.request(
      "POST",
      `/message/sendText/${encodeURIComponent(this.instance)}`,
      { number: groupId, text },
    );

    // Parsing defensivo: Evolution v2 responde { key: { id }, ... },
    // mas versões/forks variam — tentamos os campos mais comuns.
    const messageId = extractMessageId(data) ?? "";
    return { messageId };
  }

  /**
   * Estado da conexão da instância.
   * Nunca lança: erro de rede vira "disconnected"; instância inexistente
   * (404) dispara ensureInstance e retorna "qr".
   */
  async getStatus(): Promise<WhatsAppStatus> {
    try {
      const { data } = await this.request(
        "GET",
        `/instance/connectionState/${encodeURIComponent(this.instance)}`,
      );
      return mapConnectionState(extractState(data));
    } catch (err) {
      if (err instanceof EvolutionApiError && err.status === 404) {
        try {
          await this.ensureInstance();
          return "qr";
        } catch {
          return "disconnected";
        }
      }
      return "disconnected";
    }
  }

  /** QR code em base64 para parear a instância, ou null se indisponível. */
  async getQrCode(): Promise<string | null> {
    try {
      const { data } = await this.request(
        "GET",
        `/instance/connect/${encodeURIComponent(this.instance)}`,
      );
      if (!isRecord(data)) return null;
      // Evolution v2 retorna { base64, code, pairingCode, ... }.
      const base64 = data["base64"];
      if (typeof base64 === "string" && base64.length > 0) return base64;
      const code = data["code"];
      if (typeof code === "string" && code.length > 0) return code;
      return null;
    } catch {
      return null;
    }
  }

  /** Lista os grupos da instância mapeados para o contrato Group. */
  async listGroups(): Promise<Group[]> {
    const { data } = await this.request(
      "GET",
      `/group/fetchAllGroups/${encodeURIComponent(this.instance)}?getParticipants=false`,
    );

    if (!Array.isArray(data)) return [];

    const groups: Group[] = [];
    for (const item of data) {
      if (!isRecord(item)) continue;
      const id = item["id"];
      if (typeof id !== "string" || id.length === 0) continue;
      const subject = item["subject"];
      groups.push({
        id,
        name: typeof subject === "string" ? subject : id,
        enabled: true,
        maxPerDay: DEFAULT_MAX_PER_DAY,
      });
    }
    return groups;
  }
}

/** Type guard simples para objetos planos. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extrai o id da mensagem do payload de envio (formatos variam). */
function extractMessageId(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const key = data["key"];
  if (isRecord(key) && typeof key["id"] === "string") return key["id"];
  if (typeof data["id"] === "string") return data["id"];
  return null;
}

/** Extrai o campo de estado do payload de connectionState (formatos variam). */
function extractState(data: unknown): string {
  if (!isRecord(data)) return "";
  // Formato v2: { instance: { instanceName, state } }
  const instance = data["instance"];
  if (isRecord(instance) && typeof instance["state"] === "string") {
    return instance["state"];
  }
  if (typeof data["state"] === "string") return data["state"];
  return "";
}

/** Mapeia estados da Evolution para o WhatsAppStatus do contrato. */
function mapConnectionState(state: string): WhatsAppStatus {
  switch (state) {
    case "open":
      return "connected";
    case "connecting":
      return "connecting";
    case "close":
    default:
      return "disconnected";
  }
}
