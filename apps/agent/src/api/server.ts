import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  manualUrlsSchema,
  messagePatchSchema,
  messageStatusSchema,
  type AgentEnv,
  type MessageStatus,
} from "@ml-agent/core";
import { groups, messages, offers, runs, type Db } from "@ml-agent/db";
import {
  canOpenVisibleBrowser,
  getSessionStatus,
  importAffiliateSession,
  INTERACTIVE_UNAVAILABLE_MSG,
  refreshSessionInteractive,
  tryRefreshSessionHeadless,
} from "../affiliate/index.js";
import { EvolutionSender, parseEvolutionWebhook } from "../whatsapp/index.js";
import {
  approveDraftMessages,
  dispatchDueMessages,
  processManualUrls,
  runCollection,
} from "../pipeline.js";
import { getDispatchState } from "../scheduler/state.js";
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

/**
 * Base pública do agente (OAuth no navegador do operador).
 * Sem PUBLIC_URL devolve null — a UI NÃO deve inventar localhost em produção.
 */
function publicAgentBase(agentEnv: AgentEnv): string | null {
  const pub = agentEnv.PUBLIC_URL?.trim();
  if (!pub) return null;
  return pub.replace(/\/+$/, "");
}

export interface ServerCtx {
  env: AgentEnv;
  db: Db;
}

/** Segundos → texto curto em português ("45 min", "30 s", "1 h 30 min"). */
function describeSeconds(total: number): string {
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "HH:MM" do relógio local do agente (mesmo relógio usado na janela de envio). */
function localClock(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Mesma regra do pipeline: janela pode cruzar a meia-noite. */
function withinWindowNow(start: string, end: string, now = new Date()): boolean {
  const toMinutes = (hhmm: string): number => {
    const [h = 0, m = 0] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
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
  // Garante a instância + webhook na Evolution API — best-effort, não bloqueia o boot.
  try {
    await sender.ensureInstance();
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
    const [settings, whatsapp, affiliateSession, nextMessages, lastSent, lastRuns, draftCount] =
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
        db
          .select({ n: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.status, "draft")),
      ]);
    return {
      whatsapp,
      affiliateSession,
      paused: settings.paused,
      autoApprove: settings.autoApprove,
      sendIntervalSeconds: settings.sendIntervalSeconds,
      sendJitterSeconds: settings.sendJitterSeconds,
      sendWindowStart: settings.sendWindowStart,
      sendWindowEnd: settings.sendWindowEnd,
      // Relógio do agente: a janela de envio usa o fuso do CONTAINER, não o do
      // navegador. Mostrar aqui evita o clássico "está dentro do horário, por
      // que não enviou?" quando o servidor está em UTC.
      agentTime: new Date().toISOString(),
      dispatch: getDispatchState(),
      pendingApproval: draftCount[0]?.n ?? 0,
      nextMessages,
      lastSent,
      lastRuns,
    };
  });

  // --- Diagnóstico: "está tudo pronto para operar?" ---
  // Centraliza aqui (e não no dashboard) porque a regra do que é
  // pré-requisito é conhecimento do pipeline, não da tela. Cada item traz o
  // texto do que fazer, para o operador resolver sem precisar de suporte.
  app.get("/diagnostics", async () => {
    const resolved = await resolveEnv(db, env);
    const [waStatus, affiliate, credentials, enabledGroups, settings, evolution, draftCount] =
      await Promise.all([
        sender.getStatus().catch(() => "disconnected" as const),
        getSessionStatus(resolved).catch(() => "unknown" as const),
        getCredentialsStatus(db, env),
        db.select().from(groups).where(eq(groups.enabled, true)),
        getSettings(db),
        sender.ping(),
        db
          .select({ n: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.status, "draft")),
      ]);
    const pendingDrafts = draftCount[0]?.n ?? 0;

    // ok: pronto | warn: funciona, mas atenção | error: bloqueia a operação
    const checks = [
      {
        id: "evolution",
        label: "Evolution API",
        status: evolution.ok ? "ok" : "error",
        detail: evolution.detail,
        action: evolution.ok
          ? null
          : "Na VPS, defina EVOLUTION_URL=http://evolution:8080 e a mesma EVOLUTION_API_KEY do container.",
        href: "/whatsapp",
      },
      {
        id: "whatsapp",
        label: "WhatsApp conectado",
        status: waStatus === "connected" ? "ok" : "error",
        detail:
          waStatus === "connected"
            ? "Número pareado e ativo."
            : "Sem WhatsApp conectado — nada será enviado.",
        action: waStatus === "connected" ? null : "Vá em WhatsApp e escaneie o QR Code.",
        href: "/whatsapp",
      },
      {
        id: "affiliate",
        label: "Conta de afiliado",
        status: affiliate === "valid" ? "ok" : affiliate === "expired" ? "error" : "warn",
        detail:
          affiliate === "valid"
            ? "Sessão do portal válida."
            : affiliate === "expired"
              ? "A sessão expirou — links de afiliado não serão gerados."
              : "Sessão do portal ausente ou não confirmada.",
        action:
          affiliate === "valid"
            ? null
            : canOpenVisibleBrowser()
              ? "Vá em Credenciais e clique em Conectar conta de afiliado (ou cole os cookies da sessão)."
              : "Vá em Credenciais e use “Colar cookies da sessão”: login no seu Chrome + exportar cookies para o painel.",
        href: "/credenciais",
      },
      {
        id: "affiliateTag",
        label: "Etiqueta de afiliado",
        status: credentials.affiliateTag ? "ok" : "error",
        detail: credentials.affiliateTag
          ? `Usando a etiqueta ${credentials.affiliateTag}.`
          : "Sem etiqueta, nenhum link é gerado e você não recebe comissão.",
        action: credentials.affiliateTag
          ? null
          : "Vá em Credenciais e preencha a etiqueta do portal de afiliados.",
        href: "/credenciais",
      },
      {
        id: "gemini",
        label: "Chave da Gemini",
        status: credentials.gemini.configured ? "ok" : "warn",
        detail: credentials.gemini.configured
          ? "IA configurada para escrever as mensagens."
          : "Sem a chave, as mensagens usam um texto padrão mais simples.",
        action: credentials.gemini.configured
          ? null
          : "Vá em Credenciais e cole a chave da Gemini.",
        href: "/credenciais",
      },
      {
        id: "groups",
        label: "Grupos ativos",
        status: enabledGroups.length > 0 ? "ok" : "error",
        detail:
          enabledGroups.length > 0
            ? `${enabledGroups.length} grupo(s) recebendo mensagens.`
            : "Nenhum grupo ligado — as mensagens não têm para onde ir.",
        action:
          enabledGroups.length > 0 ? null : "Vá em Grupos, sincronize e ligue ao menos um.",
        href: "/grupos",
      },
      {
        id: "paused",
        label: "Disparos ativos",
        status: settings.paused ? "warn" : "ok",
        detail: settings.paused
          ? "O agente está pausado — nada será enviado até retomar."
          : `Enviando entre ${settings.sendWindowStart} e ${settings.sendWindowEnd}, ` +
            `1 mensagem a cada ${describeSeconds(settings.sendIntervalSeconds)}` +
            `${settings.sendJitterSeconds > 0 ? ` (± ${describeSeconds(settings.sendJitterSeconds)})` : ""}.`,
        action: settings.paused ? "Clique em Retomar no cartão de Disparos." : null,
        href: "/",
      },
      {
        id: "sendWindow",
        label: "Horário do agente",
        status: withinWindowNow(settings.sendWindowStart, settings.sendWindowEnd) ? "ok" : "warn",
        detail: withinWindowNow(settings.sendWindowStart, settings.sendWindowEnd)
          ? `Agora são ${localClock()} no servidor — dentro da janela de envio.`
          : `Agora são ${localClock()} no servidor, fora da janela ${settings.sendWindowStart}–${settings.sendWindowEnd}. Nada sai até voltar para a janela.`,
        action: withinWindowNow(settings.sendWindowStart, settings.sendWindowEnd)
          ? null
          : "Amplie a janela de envio em Configurações ou espere o horário.",
        href: "/configuracoes",
      },
      {
        id: "approval",
        label: "Aprovação das mensagens",
        status: settings.autoApprove || pendingDrafts === 0 ? "ok" : "warn",
        detail: settings.autoApprove
          ? "Automática: as mensagens novas já entram prontas para envio."
          : pendingDrafts > 0
            ? `${pendingDrafts} mensagem(ns) esperando você aprovar — sem isso nada é enviado.`
            : "Manual: cada mensagem precisa ser aprovada antes de sair.",
        action:
          settings.autoApprove || pendingDrafts === 0
            ? null
            : "Vá em Aprovação e aprove, ou ligue a aprovação automática em Configurações.",
        href: settings.autoApprove ? "/configuracoes" : "/aprovacao",
      },
    ] as const;

    const errors = checks.filter((c) => c.status === "error").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    return { ready: errors === 0, errors, warnings, checks };
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

  // --- Grupos: leitura rápida (só do banco) ---
  // NÃO consulta a Evolution aqui — listar centenas de grupos é lento e
  // travaria a página a cada load. A sincronização é explícita via POST /groups/sync.
  app.get("/groups", async () => {
    return db.select().from(groups).orderBy(asc(groups.name));
  });

  // --- Sincroniza os grupos com a Evolution (botão no dashboard) ---
  app.post("/groups/sync", async (_req, reply) => {
    try {
      const remote = await sender.listGroups();
      for (const g of remote) {
        // Grupos novos entram DESABILITADOS; em conflito, só o nome é atualizado
        // (enabled/maxPerDay configurados pelo operador são preservados).
        await db
          .insert(groups)
          .values({ id: g.id, name: g.name, enabled: false, maxPerDay: g.maxPerDay })
          .onConflictDoUpdate({ target: groups.id, set: { name: g.name } });
      }
      return { synced: remote.length };
    } catch (err) {
      app.log.warn({ err }, "sincronização de grupos falhou");
      return reply.code(502).send({ error: "não foi possível sincronizar com o WhatsApp agora." });
    }
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
      const before = await getSettings(db);
      const after = await patchSettings(db, req.body);

      // Ligar a aprovação automática precisa valer para a fila que já existe.
      // Sem isso os rascunhos criados antes ficavam presos para sempre: o
      // operador liga a chave, some o botão de aprovar da rotina e nada sai.
      if (after.autoApprove && !before.autoApprove) {
        const promoted = await approveDraftMessages(db);
        if (promoted > 0) {
          const now = new Date().toISOString();
          await db.insert(runs).values({
            job: "auto-approve",
            startedAt: now,
            finishedAt: now,
            ok: true,
            detail: `aprovação automática ligada — ${promoted} rascunho(s) liberados para envio`,
          });
          app.log.info({ promoted }, "aprovação automática ligada — rascunhos aprovados");
        }
      }
      return after;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: err.issues });
      throw err;
    }
  });

  // --- Disparo manual: envia UMA mensagem agora (botão "Enviar agora") ---
  // Mesmo caminho do scheduler — inclusive uma mensagem por vez. Serve para o
  // operador testar sem esperar o próximo tick e ver o motivo quando nada sai.
  app.post("/dispatch", async () => {
    const result = await dispatchDueMessages({ ...pipelineCtx, sender });
    return result;
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
  app.get("/credentials", async () => {
    const status = await getCredentialsStatus(db, env);
    const base = publicAgentBase(env);
    // Sem PUBLIC_URL não inventamos localhost na UI — o operador veria um
    // redirect URI inválido em produção.
    return {
      ...status,
      mlOAuthStartUrl: base ? `${base}/oauth/start` : null,
      mlOAuthRedirectUri: base ? `${base}/oauth/callback` : null,
      publicUrlConfigured: Boolean(base),
    };
  });

  app.patch("/credentials", async (req, reply) => {
    const parsed = credentialsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    await saveSecrets(db, env, parsed.data as StoredSecrets);
    const status = await getCredentialsStatus(db, env);
    const base = publicAgentBase(env);
    return {
      ...status,
      mlOAuthStartUrl: base ? `${base}/oauth/start` : null,
      mlOAuthRedirectUri: base ? `${base}/oauth/callback` : null,
      publicUrlConfigured: Boolean(base),
    };
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

  // --- Conta de afiliado: login interativo (GUI) + renovação headless ---
  // O Chromium abre NA MÁQUINA DO AGENTE — em VPS sem tela isso é no-op visual.
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
    interactiveAvailable: canOpenVisibleBrowser(),
  }));

  app.post("/affiliate/connect", async (_req, reply) => {
    if (!canOpenVisibleBrowser()) {
      return reply.code(400).send({ error: INTERACTIVE_UNAVAILABLE_MSG });
    }
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

  // Renovação silenciosa (headless): funciona na VPS se o profile Playwright
  // ainda estiver logado. Não substitui o primeiro login com 2FA.
  app.post("/affiliate/refresh", async (_req, reply) => {
    try {
      const resolved = await resolveEnv(db, env);
      const ok = await tryRefreshSessionHeadless(resolved);
      if (!ok) {
        return reply.code(409).send({
          ok: false,
          error: canOpenVisibleBrowser()
            ? "Não deu para renovar sozinho — a sessão pediu login de novo. Clique em Conectar conta de afiliado ou cole cookies frescos em Credenciais."
            : "Não deu para renovar sozinho. Em Credenciais, use “Colar cookies da sessão”: faça login no portal no seu Chrome, exporte os cookies e cole no painel.",
        });
      }
      return {
        ok: true,
        session: await getSessionStatus(resolved).catch(() => "unknown" as const),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "renovação headless de afiliado falhou");
      return reply.code(500).send({ ok: false, error: `Falha ao renovar a sessão: ${message}` });
    }
  });

  // Importação de cookies colados no dashboard (fluxo principal em VPS).
  app.post("/affiliate/session", async (req, reply) => {
    const bodySchema = z.object({
      cookies: z.string().min(1, "Cole os cookies no campo."),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Texto de cookies inválido.",
      });
    }
    try {
      const resolved = await resolveEnv(db, env);
      const result = await importAffiliateSession(resolved, parsed.data.cookies);
      if (!result.ok) {
        return reply.code(400).send(result);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "importação de sessão de afiliado falhou");
      return reply.code(500).send({
        ok: false,
        error: `Não foi possível salvar a sessão: ${message}`,
      });
    }
  });

  // --- WhatsApp: QR code para parear ---
  app.get("/whatsapp/qr", async () => {
    try {
      const qr = await sender.getQrCode();
      if (!qr) {
        return {
          qr: null,
          error:
            "A Evolution ainda não gerou o QR. Aguarde alguns segundos e clique em Buscar QR code. Se persistir, confira EVOLUTION_URL (na VPS: http://evolution:8080) e a API key.",
        };
      }
      return { qr, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "falha ao obter QR code da Evolution");
      return {
        qr: null,
        error: message.includes("fetch") || /ECONNREFUSED|ENOTFOUND|unreachable/i.test(message)
          ? `Não foi possível falar com a Evolution. Na VPS use EVOLUTION_URL=http://evolution:8080. Detalhe: ${message}`
          : `Falha ao gerar o QR: ${message}`,
      };
    }
  });

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
