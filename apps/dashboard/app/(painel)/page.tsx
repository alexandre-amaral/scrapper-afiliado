import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { DispatchNowButton } from "@/components/dispatch-now-button";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Diagnostics, type Overview } from "@/lib/agent-api";
import { formatDateTime, formatDuration, truncate } from "@/lib/format";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [result, diagnostics] = await Promise.all([
    tryAgent<Overview>("/overview"),
    tryAgent<Diagnostics>("/diagnostics"),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Visão geral" />
        <SetupHint message={result.error} />
      </div>
    );
  }

  const overview = result.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Visão geral"
        description="Saúde do agente, fila de disparos e últimas execuções."
      />

      {diagnostics.ok ? (
        <DiagnosticsPanel diagnostics={diagnostics.data} />
      ) : null}

      <section className={ui.card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Envio</h2>
            <p className="mt-1 text-sm text-mute">
              {overview.paused
                ? "Pausado — nada sai até você clicar em Retomar."
                : `Uma mensagem a cada ${formatDuration(overview.sendIntervalSeconds)}` +
                  (overview.sendJitterSeconds > 0
                    ? `, variando até ${formatDuration(overview.sendJitterSeconds)}`
                    : "") +
                  `, entre ${overview.sendWindowStart} e ${overview.sendWindowEnd}.`}
            </p>
            <p className="mt-1 text-xs text-mute">
              {overview.autoApprove
                ? "Aprovação automática ligada: as mensagens vão para o grupo sem passar pela fila de aprovação."
                : `Aprovação manual: ${overview.pendingApproval} mensagem(ns) esperando você aprovar.`}
            </p>
            <p className="mt-1 text-xs text-mute">
              Relógio do servidor: {formatDateTime(overview.agentTime)} · Próxima
              tentativa: {formatDateTime(overview.dispatch.nextAttemptAt)}
            </p>
            {overview.dispatch.lastReason ? (
              <p className="mt-1 text-xs text-mute">
                Última tentativa ({formatDateTime(overview.dispatch.lastAttemptAt)}):{" "}
                {overview.dispatch.lastReason}
              </p>
            ) : null}
          </div>
          <DispatchNowButton />
        </div>
      </section>

      <section>
        <h2 className={ui.sectionTitle}>Próximos disparos</h2>
        {overview.nextMessages.length === 0 ? (
          <p className="text-sm text-mute">
            Nenhuma mensagem agendada no momento. Colete ofertas ou aprove
            rascunhos na fila.
          </p>
        ) : (
          <ul className={ui.list}>
            {overview.nextMessages.map((message) => (
              <li key={message.id} className="flex items-start gap-4 p-4">
                <span className={ui.monoBadge}>
                  {formatDateTime(message.scheduledFor)}
                </span>
                <p className="min-w-0 text-sm text-ink/90">
                  {truncate(message.body)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={ui.sectionTitle}>Últimos enviados</h2>
        {overview.lastSent.length === 0 ? (
          <p className="text-sm text-mute">
            Nada enviado ainda. Quando o primeiro disparo sair, aparece aqui.
          </p>
        ) : (
          <ul className={ui.list}>
            {overview.lastSent.map((message) => (
              <li key={message.id} className="flex items-start gap-4 p-4">
                <span className={ui.monoBadge}>
                  {formatDateTime(message.sentAt)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink/90">{truncate(message.body)}</p>
                  {message.error ? (
                    <p className="mt-1 text-xs text-danger">
                      Erro: {message.error}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={ui.sectionTitle}>Últimas execuções</h2>
        {overview.lastRuns.length === 0 ? (
          <p className="text-sm text-mute">Nenhuma execução registrada.</p>
        ) : (
          <ul className={ui.list}>
            {overview.lastRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm"
              >
                <span className={ui.monoBadge}>
                  {formatDateTime(run.startedAt)}
                </span>
                {run.job ? <span className="text-ink/90">{run.job}</span> : null}
                <span className={run.ok === false ? "text-danger" : "text-mute"}>
                  {run.ok === false ? "falhou" : "ok"}
                </span>
                {run.detail ? (
                  <span className="text-xs text-mute">{truncate(run.detail, 180)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
