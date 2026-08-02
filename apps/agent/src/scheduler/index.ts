import cron from "node-cron";
import type { AgentEnv } from "@ml-agent/core";
import { runs, type Db } from "@ml-agent/db";
import { getSessionStatus } from "../affiliate/index.js";
import { EvolutionSender } from "../whatsapp/index.js";
import { dispatchDueMessages, runCollection, type Log } from "../pipeline.js";
import { getSettings } from "../settings.js";
import { setDispatchState } from "./state.js";

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
  //
  // O intervalo só é respeitado DEPOIS de um envio de verdade — é ele que
  // espaça as mensagens no grupo (mitigação anti-ban). Quando o tick não
  // envia nada (pausado, fila vazia, fora da janela, WhatsApp caído) o loop
  // volta em IDLE_RETRY_MS. Antes o tick ocioso também dormia o intervalo
  // inteiro, então mudar a cadência no painel só valia até uma hora depois —
  // e o operador via o agente "parado" sem explicação.
  const IDLE_RETRY_MS = 10_000;
  const BOOT_DELAY_MS = 10_000;

  const scheduleNext = (delayMs: number): void => {
    setDispatchState({ nextAttemptAt: new Date(Date.now() + delayMs).toISOString() });
    const timer = setTimeout(() => void dispatchTick(), delayMs);
    timer.unref?.();
  };

  const dispatchTick = async (): Promise<void> => {
    let sent = 0;
    try {
      const result = await dispatchDueMessages({ env, db, log, sender });
      sent = result.sent;
      setDispatchState({
        lastAttemptAt: new Date().toISOString(),
        lastReason: result.reason,
      });
      if (sent > 0) log.info({ sent }, "tick de disparo concluído");
    } catch (err) {
      log.error({ err }, "tick de disparo falhou");
      setDispatchState({
        lastAttemptAt: new Date().toISOString(),
        lastReason: err instanceof Error ? err.message : String(err),
      });
    }

    if (sent === 0) {
      scheduleNext(IDLE_RETRY_MS);
      return;
    }

    // Relê as settings a cada ciclo — mudanças no painel valem no próximo envio.
    let delayMs = 45 * 60_000;
    try {
      const settings = await getSettings(db);
      const jitter = (Math.random() * 2 - 1) * settings.sendJitterSeconds;
      delayMs = Math.max(1, settings.sendIntervalSeconds + jitter) * 1_000;
    } catch (err) {
      log.error({ err }, "falha ao ler settings para agendar próximo disparo — usando fallback");
    }
    scheduleNext(delayMs);
  };

  // Primeiro tick logo após o boot — o loop ocioso é barato.
  scheduleNext(BOOT_DELAY_MS);

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
