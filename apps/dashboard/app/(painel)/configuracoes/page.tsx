import type { Metadata } from "next";
import { patchSettings } from "@/app/actions";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type AgentSettings } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configurações" };

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-xs font-medium text-neutral-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const result = await tryAgent<AgentSettings>("/settings");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <SetupHint message={result.error} />
      </div>
    );
  }

  const settings = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Filtros de ofertas, cadência de envio e prompt do compositor de
          mensagens.
        </p>
      </div>

      <form action={patchSettings} className="space-y-6">
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-300">
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
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
              />
            </Field>
            <Field label="Janela de deduplicação (horas)">
              <input
                type="number"
                name="dedupWindowHours"
                min={0}
                defaultValue={settings.filters.dedupWindowHours}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Vendedores bloqueados (separados por vírgula)">
              <input
                type="text"
                name="blockedSellers"
                defaultValue={settings.filters.blockedSellers.join(", ")}
                className={inputClass}
              />
            </Field>
            <Field label="Categorias bloqueadas (separadas por vírgula)">
              <input
                type="text"
                name="blockedCategories"
                defaultValue={settings.filters.blockedCategories.join(", ")}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-300">
            Busca e ranqueamento
          </h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Palavras-chave monitoradas (separadas por vírgula)">
              <input
                type="text"
                name="keywords"
                defaultValue={settings.keywords.join(", ")}
                placeholder="notebook, air fryer, smartphone"
                className={inputClass}
              />
            </Field>
            <Field label="Top N no ranking">
              <input
                type="number"
                name="rankTopN"
                min={1}
                defaultValue={settings.rankTopN}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-300">
            Cadência de envio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Início da janela de envio">
              <input
                type="text"
                name="sendWindowStart"
                defaultValue={settings.sendWindowStart}
                placeholder="09:00"
                className={inputClass}
              />
            </Field>
            <Field label="Fim da janela de envio">
              <input
                type="text"
                name="sendWindowEnd"
                defaultValue={settings.sendWindowEnd}
                placeholder="21:00"
                className={inputClass}
              />
            </Field>
            <Field label="Intervalo entre envios (min)">
              <input
                type="number"
                name="sendIntervalMinutes"
                min={0}
                defaultValue={settings.sendIntervalMinutes}
                className={inputClass}
              />
            </Field>
            <Field label="Jitter aleatório (min)">
              <input
                type="number"
                name="sendJitterMinutes"
                min={0}
                defaultValue={settings.sendJitterMinutes}
                className={inputClass}
              />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              name="autoApprove"
              defaultChecked={settings.autoApprove}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 accent-emerald-600"
            />
            Aprovação automática (envia sem passar pela fila de aprovação)
          </label>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-2 text-sm font-semibold text-neutral-300">
            Prompt do compositor de mensagens
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Instruções para o LLM compor a mensagem da oferta (tom, emojis,
            urgência). Em caso de falha do LLM, o agente usa um template
            determinístico de fallback.
          </p>
          <textarea
            name="composerPrompt"
            rows={8}
            defaultValue={settings.composerPrompt}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-neutral-500"
          />
        </section>

        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
        >
          Salvar configurações
        </button>
      </form>
    </div>
  );
}
