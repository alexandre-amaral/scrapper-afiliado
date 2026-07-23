import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  manualUrlsSchema,
  messagePatchSchema,
  messageStatusSchema,
  type AgentEnv,
  type MessageStatus,
} from "@ml-agent/core";
import { groups, messages, offers, runs, type Db } from "@ml-agent/db";
import { getSessionStatus, refreshSessionInteractive } from "../affiliate/index.js";
import { EvolutionSender, parseEvolutionWebhook } from "../whatsapp/index.js";
import { processManualUrls, runCollection } from "../pipeline.js";
import { getSettings, patchSettings } from "../settings.js";
import { getCredentialsStatus, resolveEnv, saveSecrets, type StoredSecrets } from "../secrets.js";
import { buildAuthUrl, exchangeCode, redirectUri } from "../oauth.js";

/** Estado do login de afiliado em andamento (Playwright abre o navegador local). */
type AffiliateLoginState = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  error: string | null;
};

export interface ServerCtx {
  env: AgentEnv;
  db: Db;
}

/** Página HTML simples exibida ao final do fluxo OAuth (sucesso ou erro). */
function oauthResultPage(ok: boolean, message: string): string {
  const color = ok ? "#16a34a" : "#dc2626";
  const title = ok ? "✅ Conectado" : "❌ Falhou";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OAuth Mercado Livre</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:420px;padding:32px;border:1px solid #262626;border-radius:12px;text-align:center">
<h1 style="color:${color};margin:0 0 12px">${title}</h1>
<p style="color:#a3a3a3;line-height:1.5">${message}</p>
<p style="color:#525252;font-size:14px;margin-top:24px">Pode fechar esta aba e voltar ao dashboard.</p>
</div></body></html>`;
}

/**
 * Rotas públicas (sem Bearer token): health, webhook da Evolution e o fluxo
 * OAuth do ML — /oauth/start e /oauth/callback são acessados pelo NAVEGADOR
 * (redirect do ML), então não podem exigir o token do dashboard.
 */
function isPublicRoute(method: string, path: string): boolean {
  return (
    (method === "GET" && path === "/health") ||
    (method === "POST" && path === "/webhook/evolution") ||
    (method === "GET" && path === "/oauth/start") ||
    (method === "GET" && path === "/oauth/callback")
  );
}

export async function buildServer(ctx: ServerCtx): Promise<FastifyInstance> {
  const { env, db } = ctx;
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Sender único compartilhado por todas as rotas.
  const sender = new EvolutionSender(env);
  // Garante a instância na Evolution API — best-effort, não bloqueia o boot.
  try {
    await (sender as unknown as { ensureInstance?: () => Promise<unknown> }).ensureInstance?.();
  } catch (err) {
    app.log.warn({ err }, "ensureInstance falhou no boot — seguirá tentando via status/QR");
  }

  const pipelineCtx = { env, db, log: app.log };

  // --- Autenticação por Bearer token em todas as rotas privadas ---
  app.addHook("onRequest", async (req, reply) => {
    const path = (req.url.split("?")[0] ?? "/").replace(/\/+$/, "") || "/";
    if (isPublicRoute(req.method, path)) return;
    if (req.headers.authorization !== `Bearer ${env.AGENT_TOKEN}`) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  // --- Health ---
  app.get("/health", async () => ({ ok: true }));

  // --- Visão geral para o dashboard ---
  app.get("/overview", async () => {
    const [settings, whatsapp, affiliateSession, nextMessages, lastSent, lastRuns] =
      await Promise.all([
        getSettings(db),
        sender.getStatus().catch(() => "disconnected" as const),
        getSessionStatus(env).catch(() => "unknown" as const),
        db
          .select()
          .from(messages)
          .where(inArray(messages.status, ["approved", "scheduled"]))
          .orderBy(asc(messages.createdAt), asc(messages.id))
          .limit(5),
        db
          .select()
          .from(messages)
          .where(eq(messages.status, "sent"))
          .orderBy(desc(messages.sentAt))
          .limit(10),
        db.select().from(runs).orderBy(desc(runs.id)).limit(10),
      ]);
    return { whatsapp, affiliateSession, paused: settings.paused, nextMessages, lastSent, lastRuns };
  });

  // --- Ofertas recentes ---
  app.get("/offers", async (req, reply) => {
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
      .safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: query.error.issues });
    const rows = await db.select().from(offers).orderBy(desc(offers.id)).limit(query.data.limit);
    return rows;
  });

  // --- Fonte manual: URLs coladas no dashboard ---
  app.post("/manual", async (req, reply) => {
    const body = manualUrlsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });
    const created = await processManualUrls(pipelineCtx, body.data.urls);
    return { created };
  });

  // --- Fila de mensagens ---
  app.get("/messages", async (req, reply) => {
    const query = z
      .object({
        status: messageStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: query.error.issues });
    const base = db.select().from(messages);
    const rows = query.data.status
      ? await base.where(eq(messages.status, query.data.status)).orderBy(desc(messages.id)).limit(query.data.limit)
      : await base.orderBy(desc(messages.id)).limit(query.data.limit);
    return rows;
  });

  const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

  app.patch("/messages/:id", async (req, reply) => {
    const params = idParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.issues });
    const body = messagePatchSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });

    const set: Partial<{
      body: string;
      status: MessageStatus;
      groupId: string;
      scheduledFor: string | null;
    }> = {};
    if (body.data.body !== undefined) set.body = body.data.body;
    if (body.data.status !== undefined) set.status = body.data.status;
    if (body.data.groupId !== undefined) set.groupId = body.data.groupId;
    if (body.data.scheduledFor !== undefined) set.scheduledFor = body.data.scheduledFor;
    if (Object.keys(set).length === 0) return reply.code(400).send({ error: "patch vazio" });

    const [updated] = await db
      .update(messages)
      .set(set)
      .where(eq(messages.id, params.data.id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "mensagem não encontrada" });
    return updated;
  });

  app.post("/messages/:id/approve", async (req, reply) => {
    const params = idParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.issues });
    const [updated] = await db
      .update(messages)
      .set({ status: "approved" })
      .where(eq(messages.id, params.data.id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "mensagem não encontrada" });
    return updated;
  });

  app.post("/messages/:id/reject", async (req, reply) => {
    const params = idParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.issues });
    const [updated] = await db
      .update(messages)
      .set({ status: "rejected" })
      .where(eq(messages.id, params.data.id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "mensagem não encontrada" });
    return updated;
  });

  // --- Grupos: banco mesclado com os grupos vistos pela Evolution ---
  app.get("/groups", async () => {
    try {
      const remote = await sender.listGroups();
      for (const g of remote) {
        // Upsert: grupos novos entram DESABILITADOS (operador habilita no dashboard);
        // em conflito, só o nome é atualizado — enabled/maxPerDay configurados são preservados.
        await db
          .insert(groups)
          .values({ id: g.id, name: g.name, enabled: false, maxPerDay: g.maxPerDay })
          .onConflictDoUpdate({ target: groups.id, set: { name: g.name } });
      }
    } catch (err) {
      app.log.warn({ err }, "listGroups falhou — retornando apenas grupos do banco");
    }
    return db.select().from(groups).orderBy(asc(groups.name));
  });

  app.patch("/groups/:id", async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.issues });
    const body = z
      .object({
        enabled: z.boolean().optional(),
        // Prende no intervalo [1, 50] em vez de rejeitar (vem de formulário).
        maxPerDay: z
          .number()
          .optional()
          .transform((v) => (v === undefined ? undefined : Math.min(50, Math.max(1, Math.round(v))))),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });

    const set: Partial<{ enabled: boolean; maxPerDay: number }> = {};
    if (body.data.enabled !== undefined) set.enabled = body.data.enabled;
    if (body.data.maxPerDay !== undefined) set.maxPerDay = body.data.maxPerDay;
    if (Object.keys(set).length === 0) return reply.code(400).send({ error: "patch vazio" });

    const [updated] = await db
      .update(groups)
      .set(set)
      .where(eq(groups.id, params.data.id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "grupo não encontrado" });
    return updated;
  });

  // --- Settings ---
  app.get("/settings", async () => getSettings(db));

  app.patch("/settings", async (req, reply) => {
    try {
      return await patchSettings(db, req.body);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: err.issues });
      throw err;
    }
  });

  // --- Credenciais (chave Gemini + API oficial ML), criptografadas no SQLite ---
  const credentialsPatchSchema = z.object({
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().optional(),
    ML_CLIENT_ID: z.string().optional(),
    ML_CLIENT_SECRET: z.string().optional(),
    ML_REFRESH_TOKEN: z.string().optional(),
    ML_AFFILIATE_TAG: z.string().optional(),
  });

  // Devolve status seguro (sensíveis viram booleano "configurado?"), nunca em claro.
  app.get("/credentials", async () => getCredentialsStatus(db, env));

  app.patch("/credentials", async (req, reply) => {
    const parsed = credentialsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    await saveSecrets(db, env, parsed.data as StoredSecrets);
    return getCredentialsStatus(db, env);
  });

  // --- OAuth da API oficial do ML (fluxo authorization code) ---
  // GET /oauth/start → redireciona o navegador para o consentimento do ML.
  app.get("/oauth/start", async (_req, reply) => {
    try {
      const authUrl = await buildAuthUrl(db, env);
      return reply.redirect(authUrl);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /oauth/callback?code=... → troca o code por refresh token e salva.
  app.get<{ Querystring: { code?: string; error?: string } }>(
    "/oauth/callback",
    async (req, reply) => {
      const { code, error } = req.query;
      if (error) {
        return reply.type("text/html").send(oauthResultPage(false, `Autorização negada: ${error}`));
      }
      if (!code) {
        return reply.type("text/html").send(oauthResultPage(false, "Callback sem parâmetro 'code'."));
      }
      try {
        const { userId } = await exchangeCode(db, env, code);
        return reply
          .type("text/html")
          .send(oauthResultPage(true, `Conta ML conectada${userId ? ` (user ${userId})` : ""}.`));
      } catch (err) {
        return reply
          .type("text/html")
          .send(oauthResultPage(false, err instanceof Error ? err.message : String(err)));
      }
    },
  );

  // Mostra o redirect_uri exato a cadastrar no DevCenter (ajuda de setup).
  app.get("/oauth/redirect-uri", async () => ({ redirectUri: redirectUri(env) }));

  // --- Conta de afiliado: dispara o login interativo via Playwright ---
  // Abre um Chromium na máquina do agente para o operador logar + 2FA.
  // Só faz sentido rodando local (não numa VPS headless).
  const affiliateLogin: AffiliateLoginState = {
    running: false,
    startedAt: null,
    finishedAt: null,
    ok: null,
    error: null,
  };

  app.get("/affiliate/status", async () => ({
    session: await getSessionStatus(await resolveEnv(db, env)).catch(() => "unknown" as const),
    login: affiliateLogin,
  }));

  app.post("/affiliate/connect", async (_req, reply) => {
    if (affiliateLogin.running) {
      return reply.code(409).send({ error: "Login de afiliado já em andamento." });
    }
    affiliateLogin.running = true;
    affiliateLogin.startedAt = new Date().toISOString();
    affiliateLogin.finishedAt = null;
    affiliateLogin.ok = null;
    affiliateLogin.error = null;

    // Fire-and-forget: o navegador abre e o operador conclui manualmente.
    void (async () => {
      try {
        const resolved = await resolveEnv(db, env);
        await refreshSessionInteractive(resolved, { headless: false });
        affiliateLogin.ok = true;
      } catch (err) {
        affiliateLogin.ok = false;
        affiliateLogin.error = err instanceof Error ? err.message : String(err);
        app.log.error({ err }, "login interativo de afiliado falhou");
      } finally {
        affiliateLogin.running = false;
        affiliateLogin.finishedAt = new Date().toISOString();
      }
    })();

    return { started: true };
  });

  // --- WhatsApp: QR code para parear ---
  app.get("/whatsapp/qr", async () => ({ qr: await sender.getQrCode() }));

  // --- Coleta manual (fire-and-forget) ---
  app.post("/collect", async () => {
    void runCollection(pipelineCtx).catch((err) => {
      app.log.error({ err }, "coleta disparada via API falhou");
    });
    return { started: true };
  });

  // --- Webhook da Evolution API (sem auth — sempre responde 200) ---
  app.post("/webhook/evolution", async (req) => {
    try {
      const event = parseEvolutionWebhook(req.body);
      if (event && /close|disconnect|logout|logged.?out|banned/i.test(String(event.state))) {
        // Pausa automática anti-ban ao detectar desconexão da instância.
        await patchSettings(db, { paused: true });
        const now = new Date().toISOString();
        await db.insert(runs).values({
          job: "webhook",
          startedAt: now,
          finishedAt: now,
          ok: false,
          detail: `evolution reportou estado "${String(event.state)}" na instância ${String(event.instance)} — agente pausado`,
        });
        app.log.warn({ event: { instance: event.instance, state: event.state } }, "desconexão detectada via webhook — agente pausado");
      }
    } catch (err) {
      app.log.error({ err }, "falha ao processar webhook da Evolution");
    }
    return { ok: true };
  });

  return app;
}
