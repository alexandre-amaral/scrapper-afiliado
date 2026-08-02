import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Diagnostics, type Overview } from "@/lib/agent-api";
import { formatDateTime, truncate } from "@/lib/format";
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
                {run.kind ? <span className="text-ink/90">{run.kind}</span> : null}
                {run.status ? (
                  <span
                    className={
                      run.status === "failed" || run.status === "error"
                        ? "text-danger"
                        : "text-mute"
                    }
                  >
                    {run.status}
                  </span>
                ) : null}
                {run.detail ? (
                  <span className="text-xs text-mute">{run.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
