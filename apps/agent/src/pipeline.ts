import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type {
  AgentEnv,
  AgentSettings,
  NewOfferInput,
  Offer,
  WhatsAppSender,
} from "@ml-agent/core";
import { affiliateLinks, groups, messages, offers, runs, type Db } from "@ml-agent/db";
import { collectFromMlApi, collectFromScraper, parseManualUrls } from "./sources/index.js";
import {
  generateAffiliateLink,
  SessionExpiredError,
  tryRefreshSessionHeadless,
} from "./affiliate/index.js";
import { composeMessage, rankOffers } from "./llm/index.js";
import { getSettings, patchSettings } from "./settings.js";
import { resolveEnv } from "./secrets.js";

/** Logger mínimo compatível com o pino do Fastify. */
export interface Log {
  /* eslint-disable @typescript-eslint/no-explicit-any -- compatibilidade estrutural com pino */
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface PipelineCtx {
  env: AgentEnv;
  db: Db;
  log: Log;
}

/* ------------------------------------------------------------------ */
/* Helpers de log na tabela runs                                       */
/* ------------------------------------------------------------------ */

/** Abre uma linha em runs e retorna o id para fechamento posterior. */
async function startRun(db: Db, job: string): Promise<number> {
  const [row] = await db
    .insert(runs)
    .values({ job, startedAt: new Date().toISOString() })
    .returning({ id: runs.id });
  return row!.id;
}

async function finishRun(db: Db, id: number, ok: boolean, detail: string): Promise<void> {
  await db
    .update(runs)
    .set({ finishedAt: new Date().toISOString(), ok, detail })
    .where(eq(runs.id, id));
}

/** Registra uma execução já finalizada (falhas pontuais de sub-etapas). */
async function logRun(db: Db, job: string, ok: boolean, detail: string): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(runs).values({ job, startedAt: now, finishedAt: now, ok, detail });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------------------------------------------ */
/* Dedup + filtros + inserção de ofertas                               */
/* ------------------------------------------------------------------ */

/**
 * Remove duplicatas (no lote e contra a janela de dedup do banco),
 * aplica os filtros configurados (opcional) e insere as sobreviventes.
 * Retorna as ofertas inseridas já com id.
 */
async function dedupFilterInsert(
  db: Db,
  settings: AgentSettings,
  inputs: NewOfferInput[],
  applyFilters: boolean,
): Promise<Offer[]> {
  if (inputs.length === 0) return [];

  // Dedup dentro do próprio lote (última ocorrência vence).
  const byItemId = new Map<string, NewOfferInput>();
  for (const input of inputs) byItemId.set(input.itemId, input);
  let candidates = [...byItemId.values()];

  // Dedup contra o banco dentro da janela configurada.
  const cutoff = new Date(
    Date.now() - settings.filters.dedupWindowHours * 3_600_000,
  ).toISOString();
  const existing = await db
    .select({ itemId: offers.itemId })
    .from(offers)
    .where(
      and(
        inArray(offers.itemId, candidates.map((c) => c.itemId)),
        gte(offers.collectedAt, cutoff),
      ),
    );
  const seen = new Set(existing.map((e) => e.itemId));
  candidates = candidates.filter((c) => !seen.has(c.itemId));

  if (applyFilters) {
    const f = settings.filters;
    const blockedSellers = new Set(f.blockedSellers.map((s) => s.toLowerCase()));
    const blockedCategories = new Set(f.blockedCategories.map((c) => c.toLowerCase()));
    candidates = candidates.filter((c) => {
      if ((c.discountPct ?? 0) < f.minDiscountPct) return false;
      if (f.minPrice !== null && c.price < f.minPrice) return false;
      if (f.maxPrice !== null && c.price > f.maxPrice) return false;
      if (c.seller && blockedSellers.has(c.seller.toLowerCase())) return false;
      if (c.category && blockedCategories.has(c.category.toLowerCase())) return false;
      return true;
    });
  }

  if (candidates.length === 0) return [];

  const now = new Date().toISOString();
  const inserted = await db
    .insert(offers)
    .values(candidates.map((c) => ({ ...c, collectedAt: now })))
    .returning();
  return inserted as Offer[];
}

/* ------------------------------------------------------------------ */
/* Link de afiliado + composição + criação de mensagens                */
/* ------------------------------------------------------------------ */

/**
 * Para cada oferta: gera link de afiliado, compõe a mensagem e cria uma
 * linha em messages para cada grupo habilitado (respeitando maxPerDay).
 * Retorna o total de mensagens criadas.
 */
async function createMessagesForOffers(
  ctx: PipelineCtx,
  settings: AgentSettings,
  selected: Offer[],
): Promise<number> {
  const { env, db, log } = ctx;
  if (selected.length === 0) return 0;

  const enabledGroups = await db.select().from(groups).where(eq(groups.enabled, true));
  if (enabledGroups.length === 0) {
    log.warn("nenhum grupo habilitado — ofertas coletadas mas nenhuma mensagem criada");
    return 0;
  }

  // Contagem atual por grupo: enviadas hoje + pendentes (approved/scheduled).
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();
  const counts = new Map<string, number>();
  for (const g of enabledGroups) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.groupId, g.id),
          or(
            and(eq(messages.status, "sent"), gte(messages.sentAt, dayStartIso)),
            inArray(messages.status, ["approved", "scheduled"]),
          ),
        ),
      );
    counts.set(g.id, row?.n ?? 0);
  }

  const status = settings.autoApprove ? ("approved" as const) : ("draft" as const);
  let created = 0;
  let sessionRefreshTried = false;

  for (const offer of selected) {
    // 1) Link de afiliado — com uma tentativa de renovação de sessão.
    let shortUrl: string | null = null;
    try {
      shortUrl = await generateAffiliateLink(env, offer.url);
    } catch (err) {
      if (err instanceof SessionExpiredError && !sessionRefreshTried) {
        sessionRefreshTried = true;
        const refreshed = await tryRefreshSessionHeadless(env).catch(() => false);
        if (refreshed) {
          try {
            shortUrl = await generateAffiliateLink(env, offer.url);
          } catch (retryErr) {
            await logRun(
              db,
              "affiliate",
              false,
              `link falhou após renovar sessão: ${errMsg(retryErr)}`,
            );
            break; // sessão irrecuperável neste ciclo — interrompe a etapa
          }
        } else {
          await logRun(db, "affiliate", false, "sessão expirada e renovação headless falhou");
          break;
        }
      } else if (err instanceof SessionExpiredError) {
        await logRun(db, "affiliate", false, "sessão expirada (renovação já tentada neste ciclo)");
        break;
      } else {
        log.error({ err, itemId: offer.itemId }, "falha ao gerar link de afiliado — pulando oferta");
        continue;
      }
    }
    if (!shortUrl) continue;

    const [link] = await db
      .insert(affiliateLinks)
      .values({ offerId: offer.id, shortUrl, createdAt: new Date().toISOString() })
      .returning({ id: affiliateLinks.id });

    // 2) Composição do texto via LLM.
    let body: string;
    try {
      body = await composeMessage(env, offer, shortUrl, settings.composerPrompt);
    } catch (err) {
      log.error({ err, itemId: offer.itemId }, "falha ao compor mensagem — pulando oferta");
      continue;
    }

    // 3) Uma mensagem por grupo habilitado, respeitando maxPerDay.
    for (const g of enabledGroups) {
      const current = counts.get(g.id) ?? 0;
      if (current >= g.maxPerDay) continue;
      await db.insert(messages).values({
        offerId: offer.id,
        affiliateLinkId: link?.id ?? null,
        body,
        status,
        groupId: g.id,
        createdAt: new Date().toISOString(),
      });
      counts.set(g.id, current + 1);
      created++;
    }
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* Jobs públicos                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ciclo completo de coleta: fontes → dedup/filtros → ranking LLM →
 * link de afiliado → composição → mensagens por grupo.
 */
export async function runCollection(ctx: PipelineCtx): Promise<{ collected: number; kept: number }> {
  const { db, log } = ctx;
  // Env efetivo: .env + segredos do dashboard (chave Gemini, credenciais ML).
  const env = await resolveEnv(db, ctx.env);
  const settings = await getSettings(db);
  if (settings.paused) {
    log.info("coleta pulada: agente pausado");
    return { collected: 0, kept: 0 };
  }

  const runId = await startRun(db, "collection");
  try {
    // Coleta das fontes automáticas — cada uma isolada em try/catch.
    const collected: NewOfferInput[] = [];
    try {
      collected.push(...(await collectFromMlApi(env, settings.keywords)));
    } catch (err) {
      log.error({ err }, "coleta ml-api falhou");
      await logRun(db, "collection:ml-api", false, errMsg(err));
    }
    try {
      collected.push(...(await collectFromScraper()));
    } catch (err) {
      log.error({ err }, "coleta scraper falhou");
      await logRun(db, "collection:scraper", false, errMsg(err));
    }

    const inserted = await dedupFilterInsert(db, settings, collected, true);

    // Ranking LLM — em caso de falha, fallback por maior desconto.
    let ranked: Offer[] = [];
    if (inserted.length > 0) {
      try {
        ranked = await rankOffers(env, inserted, settings.rankTopN);
      } catch (err) {
        log.error({ err }, "ranking LLM falhou — usando fallback por desconto");
        ranked = [...inserted]
          .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
          .slice(0, settings.rankTopN);
      }
    }

    const created = await createMessagesForOffers(ctx, settings, ranked);

    await finishRun(
      db,
      runId,
      true,
      JSON.stringify({ collected: collected.length, kept: inserted.length, ranked: ranked.length, messages: created }),
    );
    return { collected: collected.length, kept: inserted.length };
  } catch (err) {
    await finishRun(db, runId, false, errMsg(err));
    throw err;
  }
}

/**
 * Fonte manual: URLs coladas no dashboard passam pelo mesmo funil
 * (dedup, link, composição, mensagens), sem filtros nem ranking —
 * a curadoria já foi humana. Retorna o nº de mensagens criadas.
 */
export async function processManualUrls(ctx: PipelineCtx, urls: string[]): Promise<number> {
  const { db } = ctx;
  const env = await resolveEnv(db, ctx.env);
  const settings = await getSettings(db);

  const runId = await startRun(db, "manual");
  try {
    const parsed = await parseManualUrls(urls);
    const inserted = await dedupFilterInsert(db, settings, parsed, false);
    const created = await createMessagesForOffers(ctx, settings, inserted);
    await finishRun(
      db,
      runId,
      true,
      JSON.stringify({ urls: urls.length, kept: inserted.length, messages: created }),
    );
    return created;
  } catch (err) {
    await finishRun(db, runId, false, errMsg(err));
    throw err;
  }
}

/** "HH:MM" → minutos desde meia-noite. */
function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Verifica se o horário local atual está dentro da janela (suporta janela cruzando meia-noite). */
function withinSendWindow(settings: AgentSettings, now: Date): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.sendWindowStart);
  const end = toMinutes(settings.sendWindowEnd);
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end; // janela cruza a meia-noite
}

/** Heurística: o erro indica desconexão/ban do WhatsApp? */
function looksLikeDisconnection(message: string): boolean {
  return /disconnect|desconect|logged.?out|logout|connection|conex[aã]o|closed|not connected|banned|banido|unauthorized|forbidden|\b401\b|\b403\b/i.test(
    message,
  );
}

/**
 * Envia NO MÁXIMO UMA mensagem por tick — a cadência humana é controlada
 * pelo intervalo + jitter do scheduler, não por lotes.
 */
export async function dispatchDueMessages(
  ctx: PipelineCtx & { sender: WhatsAppSender },
): Promise<number> {
  const { db, log, sender } = ctx;
  const settings = await getSettings(db);
  if (settings.paused) {
    log.info("disparo pulado: agente pausado");
    return 0;
  }

  const now = new Date();
  if (!withinSendWindow(settings, now)) return 0;

  const nowIso = now.toISOString();
  const [due] = await db
    .select()
    .from(messages)
    .where(
      or(
        eq(messages.status, "approved"),
        and(eq(messages.status, "scheduled"), lte(messages.scheduledFor, nowIso)),
      ),
    )
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(1);
  if (!due) return 0;

  const waStatus = await sender.getStatus().catch(() => "disconnected" as const);
  if (waStatus !== "connected") {
    log.warn({ waStatus }, "disparo pulado: WhatsApp não conectado");
    return 0;
  }

  try {
    await sender.sendText(due.groupId, due.body);
    await db
      .update(messages)
      .set({ status: "sent", sentAt: new Date().toISOString(), error: null })
      .where(eq(messages.id, due.id));
    await logRun(db, "dispatch", true, `mensagem ${due.id} enviada para ${due.groupId}`);
    return 1;
  } catch (err) {
    const message = errMsg(err);
    await db
      .update(messages)
      .set({ status: "failed", error: message })
      .where(eq(messages.id, due.id));
    if (looksLikeDisconnection(message)) {
      // Pausa automática anti-ban: para tudo até o operador revisar.
      await patchSettings(db, { paused: true });
      log.error({ err }, "envio falhou com sinal de desconexão — agente pausado automaticamente");
    } else {
      log.error({ err }, "envio falhou");
    }
    await logRun(db, "dispatch", false, `mensagem ${due.id}: ${message}`);
    return 0;
  }
}
