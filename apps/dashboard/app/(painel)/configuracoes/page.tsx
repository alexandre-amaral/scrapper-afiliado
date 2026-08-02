import type { Metadata } from "next";
import { patchSettings } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type AgentSettings } from "@/lib/agent-api";
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
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Cadência de envio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Field label="Intervalo entre envios (min)">
              <input
                type="number"
                name="sendIntervalMinutes"
                min={0}
                defaultValue={settings.sendIntervalMinutes}
                className={ui.input}
              />
            </Field>
            <Field label="Jitter aleatório (min)">
              <input
                type="number"
                name="sendJitterMinutes"
                min={0}
                defaultValue={settings.sendJitterMinutes}
                className={ui.input}
              />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="autoApprove"
              defaultChecked={settings.autoApprove}
              className="h-4 w-4 rounded border-border bg-elevated accent-accent"
            />
            Aprovação automática (envia sem passar pela fila de aprovação)
          </label>
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
