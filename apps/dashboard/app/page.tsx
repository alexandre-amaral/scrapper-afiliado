import { togglePause, triggerCollect } from "@/app/actions";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Overview } from "@/lib/agent-api";
import { formatDateTime, truncate } from "@/lib/format";
import {
  affiliateColors,
  affiliateLabels,
  whatsappColors,
  whatsappLabels,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export default async function OverviewPage() {
  const result = await tryAgent<Overview>("/overview");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
        <SetupHint message={result.error} />
      </div>
    );
  }

  const overview = result.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
        <form action={triggerCollect}>
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            Coletar agora
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="WhatsApp">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusDot color={whatsappColors[overview.whatsapp]} />
            {whatsappLabels[overview.whatsapp]}
          </div>
        </Card>

        <Card title="Sessão de afiliado">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusDot color={affiliateColors[overview.affiliateSession]} />
            {affiliateLabels[overview.affiliateSession]}
          </div>
        </Card>

        <Card title="Disparos">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <StatusDot
                color={overview.paused ? "bg-amber-500" : "bg-emerald-500"}
              />
              {overview.paused ? "Pausado" : "Ativo"}
            </div>
            <form action={togglePause}>
              <input
                type="hidden"
                name="paused"
                value={String(overview.paused)}
              />
              <button
                type="submit"
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
              >
                {overview.paused ? "Retomar" : "Pausar"}
              </button>
            </form>
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">
          Próximos disparos
        </h2>
        {overview.nextMessages.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma mensagem agendada no momento.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
            {overview.nextMessages.map((message) => (
              <li key={message.id} className="flex items-start gap-4 p-4">
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {formatDateTime(message.scheduledFor)}
                </span>
                <p className="min-w-0 text-sm text-neutral-300">
                  {truncate(message.body)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">
          Últimos enviados
        </h2>
        {overview.lastSent.length === 0 ? (
          <p className="text-sm text-neutral-500">Nada enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
            {overview.lastSent.map((message) => (
              <li key={message.id} className="flex items-start gap-4 p-4">
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {formatDateTime(message.sentAt)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-300">
                    {truncate(message.body)}
                  </p>
                  {message.error ? (
                    <p className="mt-1 text-xs text-red-400">
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
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">
          Últimas execuções
        </h2>
        {overview.lastRuns.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma execução registrada.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
            {overview.lastRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm"
              >
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {formatDateTime(run.startedAt)}
                </span>
                {run.kind ? (
                  <span className="text-neutral-300">{run.kind}</span>
                ) : null}
                {run.status ? (
                  <span
                    className={
                      run.status === "failed" || run.status === "error"
                        ? "text-red-400"
                        : "text-neutral-400"
                    }
                  >
                    {run.status}
                  </span>
                ) : null}
                {run.detail ? (
                  <span className="text-xs text-neutral-500">{run.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
