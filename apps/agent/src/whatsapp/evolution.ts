/**
 * Adapter da Evolution API v2 — implementa o contrato WhatsAppSender.
 * Transporte trocável: se um dia migrarmos de Evolution, basta trocar
 * esta classe mantendo a interface (ver ARQUITETURA.md, seção 2).
 */

import qrcode from "qrcode";
import type { AgentEnv } from "@ml-agent/core";
import type { Group, WhatsAppSender, WhatsAppStatus } from "@ml-agent/core";

/** Valor padrão de mensagens/dia para grupos recém-descobertos. */
const DEFAULT_MAX_PER_DAY = 5;

/** Tentativas de ler o QR — a Evolution gera a imagem de forma assíncrona. */
const QR_FETCH_ATTEMPTS = 4;
const QR_FETCH_DELAY_MS = 1200;

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
  private readonly webhookUrl: string | null;

  constructor(env: AgentEnv) {
    // Remove barra final para montar URLs de forma previsível.
    this.baseUrl = env.EVOLUTION_URL.replace(/\/+$/, "");
    this.apiKey = env.EVOLUTION_API_KEY;
    this.instance = env.EVOLUTION_INSTANCE;
    this.webhookUrl = resolveWebhookUrl(env);
  }

  /** Requisição base — sempre JSON com header de apikey. */
  private async request(
    method: "GET" | "POST" | "DELETE",
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
   * Quando cria do zero, já registra o webhook de desconexão (se houver URL).
   */
  async ensureInstance(): Promise<void> {
    try {
      await this.request("POST", "/instance/create", {
        instanceName: this.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        ...(this.webhookUrl
          ? {
              webhook: {
                enabled: true,
                url: this.webhookUrl,
                byEvents: false,
                base64: true,
                events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "LOGOUT_INSTANCE"],
              },
            }
          : {}),
      });
    } catch (err) {
      if (err instanceof EvolutionApiError) {
        const alreadyExists =
          err.status === 403 ||
          err.status === 409 ||
          /already (in use|exists)|j[áa] existe/i.test(err.body);
        if (alreadyExists) {
          // Instância antiga: tenta só atualizar o webhook (best-effort).
          await this.ensureWebhook().catch(() => undefined);
          return;
        }
      }
      throw err;
    }
  }

  /** Configura o webhook de desconexão numa instância já existente. */
  async ensureWebhook(): Promise<void> {
    if (!this.webhookUrl) return;
    await this.request("POST", `/webhook/set/${encodeURIComponent(this.instance)}`, {
      webhook: {
        enabled: true,
        url: this.webhookUrl,
        byEvents: false,
        base64: true,
        events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "LOGOUT_INSTANCE"],
      },
    });
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
   * dispara ensureInstance e retorna "qr".
   */
  async getStatus(): Promise<WhatsAppStatus> {
    try {
      const { data } = await this.request(
        "GET",
        `/instance/connectionState/${encodeURIComponent(this.instance)}`,
      );
      return mapConnectionState(extractState(data));
    } catch (err) {
      if (err instanceof EvolutionApiError && looksLikeMissingInstance(err)) {
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

  /**
   * QR code em data-URL (PNG base64) para parear a instância, ou null.
   *
   * A Evolution gera o QR de forma assíncrona (evento Baileys → toDataURL).
   * GET /instance/connect pode devolver:
   *   - { base64, code, pairingCode, count }  (estado connecting/close)
   *   - { qrcode: { base64, code, ... } }     (outros formatos / create)
   *   - só { code } sem imagem ainda
   *
   * Por isso: ensureInstance → várias tentativas → extrai base64 → se só
   * houver o payload cru do WhatsApp (`code`), gera o PNG localmente.
   */
  async getQrCode(): Promise<string | null> {
    try {
      await this.ensureInstance();
    } catch {
      // Sem instância e sem conseguir criar — as tentativas abaixo falham
      // com mensagem clara via null; o endpoint /whatsapp/qr loga o erro.
    }

    let lastError: unknown;
    let gotResponse = false;
    for (let attempt = 0; attempt < QR_FETCH_ATTEMPTS; attempt++) {
      try {
        const { data } = await this.request(
          "GET",
          `/instance/connect/${encodeURIComponent(this.instance)}`,
        );

        // Algumas versões devolvem 200 com { error: true, message } em vez de HTTP 4xx.
        if (isRecord(data) && data["error"] === true) {
          const msg = data["message"];
          throw new EvolutionApiError(
            400,
            typeof msg === "string" ? msg : JSON.stringify(data),
            typeof msg === "string" ? msg : "Evolution retornou erro ao conectar a instância",
          );
        }
        gotResponse = true;

        // Já conectado: connect devolve connectionState, sem QR.
        if (extractState(data) === "open") return null;

        const image = await resolveQrImage(data);
        if (image) return image;
      } catch (err) {
        lastError = err;
        if (err instanceof EvolutionApiError && looksLikeMissingInstance(err)) {
          try {
            await this.ensureInstance();
          } catch (createErr) {
            lastError = createErr;
          }
        }
      }
      if (attempt < QR_FETCH_ATTEMPTS - 1) {
        await sleep(QR_FETCH_DELAY_MS);
      }
    }

    // Só propaga erro de rede/API se nenhuma resposta útil chegou —
    // QR vazio após respostas 200 é "ainda gerando", não falha dura.
    if (!gotResponse && lastError) {
      const wrapped = new Error(
        lastError instanceof Error ? lastError.message : String(lastError),
      );
      (wrapped as Error & { cause?: unknown }).cause = lastError;
      throw wrapped;
    }
    return null;
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

  /**
   * Checa se a Evolution responde (para /diagnostics).
   * Não lança — devolve ok/mensagem amigável.
   */
  async ping(): Promise<{ ok: boolean; detail: string }> {
    try {
      // fetchInstances é leve e autentica com a mesma apikey.
      await this.request("GET", "/instance/fetchInstances");
      return { ok: true, detail: `Evolution alcançável em ${this.baseUrl}.` };
    } catch (err) {
      if (err instanceof EvolutionApiError) {
        if (err.status === 401 || err.status === 403) {
          return {
            ok: false,
            detail:
              "Evolution respondeu, mas a chave (EVOLUTION_API_KEY) está errada.",
          };
        }
        return {
          ok: false,
          detail: `Evolution respondeu ${err.status} — confira EVOLUTION_URL e a API key.`,
        };
      }
      return {
        ok: false,
        detail: `Não foi possível alcançar a Evolution em ${this.baseUrl}. Na VPS use http://evolution:8080.`,
      };
    }
  }
}

/** Monta a URL do webhook que a Evolution chama ao desconectar. */
function resolveWebhookUrl(env: AgentEnv): string | null {
  const override = process.env["EVOLUTION_WEBHOOK_URL"]?.trim();
  if (override) return override.replace(/\/+$/, "");

  try {
    const host = new URL(env.EVOLUTION_URL).hostname;
    // Compose interno: agent e evolution na mesma rede — webhook sem TLS público.
    if (host === "evolution") {
      return `http://agent:${env.AGENT_PORT}/webhook/evolution`;
    }
  } catch {
    // URL inválida — cai nos fallbacks abaixo.
  }

  const pub = env.PUBLIC_URL?.trim();
  if (pub) return `${pub.replace(/\/+$/, "")}/webhook/evolution`;

  // Dev local (agent + evolution no host): webhook loopback.
  if (/localhost|127\.0\.0\.1/i.test(env.EVOLUTION_URL)) {
    return `http://127.0.0.1:${env.AGENT_PORT}/webhook/evolution`;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Type guard simples para objetos planos. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Instância ausente na Evolution (404 clássico ou 400 "does not exist"). */
function looksLikeMissingInstance(err: EvolutionApiError): boolean {
  if (err.status === 404) return true;
  return (
    (err.status === 400 || err.status === 404) &&
    /does not exist|not found|n[aã]o encontrad/i.test(err.body)
  );
}

/**
 * Extrai uma imagem de QR (data-URL ou base64 puro) do payload da Evolution.
 * Nunca devolve o campo `code` cru — isso é o payload do WhatsApp, não PNG.
 */
function extractQrBase64(data: unknown): string | null {
  if (!isRecord(data)) return null;

  const direct = asImageBase64(data["base64"]);
  if (direct) return direct;

  const nested = data["qrcode"];
  if (isRecord(nested)) {
    const fromNested = asImageBase64(nested["base64"]);
    if (fromNested) return fromNested;
  }
  // Algumas forks devolvem a data-URL direto em "qrcode".
  if (typeof nested === "string") {
    const fromString = asImageBase64(nested);
    if (fromString) return fromString;
  }

  return null;
}

/** Extrai o payload cru do QR (`2@...`) para gerar a imagem localmente. */
function extractQrPayload(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const top = data["code"];
  if (typeof top === "string" && looksLikeWhatsAppQrPayload(top)) return top;
  const nested = data["qrcode"];
  if (isRecord(nested)) {
    const code = nested["code"];
    if (typeof code === "string" && looksLikeWhatsAppQrPayload(code)) return code;
  }
  return null;
}

/** Aceita data-URL ou base64 de PNG/JPEG; rejeita o payload `2@...` do WA. */
function asImageBase64(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 32) return null;
  if (value.startsWith("data:image/")) return value;
  // Payload do WhatsApp (não é imagem).
  if (looksLikeWhatsAppQrPayload(value)) return null;
  // PNG em base64 começa com iVBOR; JPEG com /9j/.
  if (/^(iVBOR|\/9j\/)/.test(value)) return value;
  // Outros base64 longos sem prefixo — a UI prefixa data:image/png.
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").length > 200) {
    return value.replace(/\s/g, "");
  }
  return null;
}

function looksLikeWhatsAppQrPayload(value: string): boolean {
  // Payload do QR do WhatsApp Web (Baileys): começa com "2@" e é longo.
  // Não confundir com pairingCode curto (ex.: WZYEH1YY) nem com base64 de PNG.
  return value.startsWith("2@") && value.length > 40;
}

/**
 * Resolve a imagem do QR: prefere base64 da Evolution; se só houver o
 * payload cru, gera o PNG com a lib `qrcode`.
 */
async function resolveQrImage(data: unknown): Promise<string | null> {
  const fromApi = extractQrBase64(data);
  if (fromApi) return fromApi;

  const payload = extractQrPayload(data);
  if (!payload) return null;

  try {
    return await qrcode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      type: "image/png",
    });
  } catch {
    return null;
  }
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
  // connectToWhatsapp às vezes devolve { instance: { status } }
  if (isRecord(instance) && typeof instance["status"] === "string") {
    return instance["status"];
  }
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
