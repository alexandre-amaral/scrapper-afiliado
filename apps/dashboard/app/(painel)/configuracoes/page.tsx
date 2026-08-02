import type { Metadata } from "next";
import { patchSettings } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type AgentSettings } from "@/lib/agent-api";
import { formatDuration, splitDuration } from "@/lib/format";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configurações" };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={ui.label}>{label}</label>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const result = await tryAgent<AgentSettings>("/settings");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configurações" />
        <SetupHint message={result.error} />
      </div>
    );
  }

  const settings = result.data;
  const interval = splitDuration(settings.sendIntervalSeconds);
  const jitter = splitDuration(settings.sendJitterSeconds);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Filtros de ofertas, cadência de envio e prompt do compositor de mensagens."
      />

      <form action={patchSettings} className="space-y-6">
        <section className={ui.card}>
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Filtros de ofertas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Desconto mínimo (%)">
              <input
                type="number"
                name="minDiscountPct"
                min={0}
                max={100}
                defaultValue={settings.filters.minDiscountPct}
                className={ui.input}
              />
            </Field>
            <Field label="Preço mínimo (R$)">
              <input
                type="number"
                name="minPrice"
                min={0}
                step="0.01"
                placeholder="sem limite"
                defaultValue={settings.filters.minPrice ?? ""}
                className={ui.input}
              />
            </Field>
            <Field label="Preço máximo (R$)">
              <input
                type="number"
                name="maxPrice"
                min={0}
                step="0.01"
                placeholder="sem limite"
                defaultValue={settings.filters.maxPrice ?? ""}
                className={ui.input}
              />
            </Field>
            <Field label="Janela de deduplicação (horas)">
              <input
                type="number"
                name="dedupWindowHours"
                min={0}
                defaultValue={settings.filters.dedupWindowHours}
                className={ui.input}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Vendedores bloqueados (separados por vírgula)">
              <input
                type="text"
                name="blockedSellers"
                defaultValue={settings.filters.blockedSellers.join(", ")}
                className={ui.input}
              />
            </Field>
            <Field label="Categorias bloqueadas (separadas por vírgula)">
              <input
                type="text"
                name="blockedCategories"
                defaultValue={settings.filters.blockedCategories.join(", ")}
                className={ui.input}
              />
            </Field>
          </div>
        </section>

        <section className={ui.card}>
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Busca e ranqueamento
          </h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Palavras-chave monitoradas (separadas por vírgula)">
              <input
                type="text"
                name="keywords"
                defaultValue={settings.keywords.join(", ")}
                placeholder="notebook, air fryer, smartphone"
                className={ui.input}
              />
            </Field>
            <Field label="Top N no ranking">
              <input
                type="number"
                name="rankTopN"
                min={1}
                defaultValue={settings.rankTopN}
                className={ui.input}
              />
            </Field>
          </div>
        </section>

        <section className={ui.card}>
          <h2 className="mb-1 text-sm font-semibold text-ink">
            Cadência de envio
          </h2>
          <p className="mb-4 text-xs text-mute">
            O agente envia <strong>uma mensagem por vez</strong>. O intervalo é
            o tempo de espera entre uma mensagem e a próxima; a variação
            aleatória é somada ou subtraída desse tempo para o ritmo não ficar
            robótico. A janela usa o relógio do servidor
            {" — "}veja o horário atual dele na Visão geral.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início da janela de envio">
              <input
                type="text"
                name="sendWindowStart"
                defaultValue={settings.sendWindowStart}
                placeholder="09:00"
                className={ui.input}
              />
            </Field>
            <Field label="Fim da janela de envio">
              <input
                type="text"
                name="sendWindowEnd"
                defaultValue={settings.sendWindowEnd}
                placeholder="21:00"
                className={ui.input}
              />
            </Field>
            <Field label="Intervalo entre envios">
              <div className="flex gap-2">
                <input
                  type="number"
                  name="sendInterval"
                  min={1}
                  defaultValue={interval.value}
                  className={`${ui.input} flex-1`}
                />
                <select
                  name="sendIntervalUnit"
                  defaultValue={interval.unit}
                  className={`${ui.input} w-32`}
                >
                  <option value="s">segundos</option>
                  <option value="min">minutos</option>
                </select>
              </div>
            </Field>
            <Field label="Variação aleatória (para mais ou para menos)">
              <div className="flex gap-2">
                <input
                  type="number"
                  name="sendJitter"
                  min={0}
                  defaultValue={jitter.value}
                  className={`${ui.input} flex-1`}
                />
                <select
                  name="sendJitterUnit"
                  defaultValue={jitter.unit}
                  className={`${ui.input} w-32`}
                >
                  <option value="s">segundos</option>
                  <option value="min">minutos</option>
                </select>
              </div>
            </Field>
          </div>
          <p className="mt-3 text-xs text-mute">
            Hoje: 1 mensagem a cada{" "}
            <strong className="text-ink">
              {formatDuration(settings.sendIntervalSeconds)}
            </strong>
            {settings.sendJitterSeconds > 0
              ? ` (variando até ${formatDuration(settings.sendJitterSeconds)} para mais ou para menos)`
              : ""}
            . Mínimo permitido: 5 segundos.
          </p>
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-ink/90">
            <strong>Atenção:</strong> intervalos curtos (poucos segundos ou
            poucos minutos) servem para <strong>teste</strong>. Deixar assim no
            dia a dia faz o WhatsApp enxergar comportamento de robô e{" "}
            <strong>aumenta muito o risco de banimento do número</strong>. Para
            operar, volte para algo entre 30 e 60 minutos.
          </p>

          <div className="mt-5 border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="autoApprove"
                defaultChecked={settings.autoApprove}
                className="mt-0.5 h-4 w-4 rounded border-border bg-elevated accent-accent"
              />
              <span>
                Aprovação automática
                <span className="mt-1 block text-xs text-mute">
                  Ligada, toda mensagem nova já entra pronta para envio e a fila
                  de Aprovação fica vazia — nada espera clique. Ao ligar, os
                  rascunhos que já estão na fila também são liberados.
                </span>
              </span>
            </label>
            <p className="mt-3 text-xs text-mute">
              Situação atual:{" "}
              <strong className="text-ink">
                {settings.autoApprove
                  ? "as mensagens são enviadas sem aprovação manual."
                  : "cada mensagem precisa ser aprovada na tela Aprovação antes de sair."}
              </strong>
            </p>
          </div>
        </section>

        <section className={ui.card}>
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Prompt do compositor de mensagens
          </h2>
          <p className="mb-3 text-xs text-mute">
            Instruções para o LLM compor a mensagem da oferta (tom, emojis,
            urgência). Em caso de falha do LLM, o agente usa um template
            determinístico de fallback.
          </p>
          <textarea
            name="composerPrompt"
            rows={8}
            defaultValue={settings.composerPrompt}
            className={ui.textarea}
          />
        </section>

        <button type="submit" className={ui.btnPrimary}>
          Salvar configurações
        </button>
      </form>
    </div>
  );
}
