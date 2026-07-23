import cron from "node-cron";
import type { AgentEnv } from "@ml-agent/core";
import { runs, type Db } from "@ml-agent/db";
import { getSessionStatus } from "../affiliate/index.js";
import { EvolutionSender } from "../whatsapp/index.js";
import { dispatchDueMessages, runCollection, type Log } from "../pipeline.js";
import { getSettings } from "../settings.js";

export interface SchedulerCtx {
  env: AgentEnv;
  db: Db;
  log: Log;
}

/**
 * Agenda os jobs recorrentes do agente:
 * - coleta a cada 2 horas (cron fixo);
 * - disparo em loop auto-agendado com intervalo + jitter (cadência humana);
 * - verificação da sessão de afiliado a cada 6 horas.
 */
export function startScheduler(ctx: SchedulerCtx): void {
  const { env, db, log } = ctx;

  // Sender compartilhado entre os ticks de disparo.
  const sender = new EvolutionSender(env);

  // --- Coleta: a cada 2 horas ---
  cron.schedule("0 */2 * * *", async () => {
    try {
      const result = await runCollection({ env, db, log });
      log.info(result, "ciclo de coleta concluído");
    } catch (err) {
      log.error({ err }, "ciclo de coleta falhou");
    }
  });

  // --- Disparo: loop auto-agendado (intervalo ± jitter, relido a cada ciclo) ---
  const dispatchTick = async (): Promise<void> => {
    try {
      const sent = await dispatchDueMessages({ env, db, log, sender });
      if (sent > 0) log.info({ sent }, "tick de disparo concluído");
    } catch (err) {
      log.error({ err }, "tick de disparo falhou");
    }

    // Relê as settings a cada ciclo — mudanças no dashboard valem já no próximo tick.
    let delayMinutes = 45;
    try {
      const settings = await getSettings(db);
      const jitter = (Math.random() * 2 - 1) * settings.sendJitterMinutes;
      delayMinutes = Math.max(1, settings.sendIntervalMinutes + jitter);
    } catch (err) {
      log.error({ err }, "falha ao ler settings para agendar próximo disparo — usando fallback");
    }
    const timer = setTimeout(() => void dispatchTick(), delayMinutes * 60_000);
    timer.unref?.();
  };
  // Primeiro tick após 1 minuto para dar tempo ao boot completo.
  const firstTimer = setTimeout(() => void dispatchTick(), 60_000);
  firstTimer.unref?.();

  // --- Sessão de afiliado: verificação a cada 6 horas ---
  cron.schedule("0 */6 * * *", async () => {
    try {
      const status = await getSessionStatus(env);
      if (status === "expired") {
        log.warn("sessão do portal de afiliados expirada — necessário novo login");
        const now = new Date().toISOString();
        await db.insert(runs).values({
          job: "session-check",
          startedAt: now,
          finishedAt: now,
          ok: false,
          detail: "sessão de afiliado expirada — renove pelo dashboard/login manual",
        });
      }
    } catch (err) {
      log.error({ err }, "verificação de sessão de afiliado falhou");
    }
  });

  log.info("scheduler iniciado: coleta 2h, disparo com jitter, sessão 6h");
}
