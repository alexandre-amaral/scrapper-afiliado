import type { Metadata } from "next";
import { patchGroup, syncGroups } from "@/app/actions";
import { SetupHint } from "@/components/setup-hint";
import { SyncGroupsButton } from "@/components/sync-groups-button";
import { tryAgent, type Group } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const result = await tryAgent<Group[]>("/groups");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Grupos</h1>
        <SetupHint message={result.error} />
      </div>
    );
  }

  const groups = result.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Grupos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Grupos de WhatsApp que recebem as ofertas. Controle quais estão
            ativos e o limite diário de mensagens por grupo.
          </p>
        </div>
        <SyncGroupsButton action={syncGroups} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-10 text-center">
          <p className="text-sm text-neutral-400">Nenhum grupo encontrado.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Conecte o WhatsApp e clique em “Sincronizar grupos” para o agente
            descobrir os grupos do número.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <div className="hidden grid-cols-[1fr_8rem_8rem_6rem] gap-4 bg-neutral-900 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500 sm:grid">
            <span>Grupo</span>
            <span>Ativo</span>
            <span>Máx./dia</span>
            <span />
          </div>
          <ul className="divide-y divide-neutral-800 bg-neutral-900/40">
            {groups.map((group) => (
              <li key={group.id}>
                <form
                  action={patchGroup}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_8rem_8rem_6rem] sm:gap-4"
                >
                  <input type="hidden" name="id" value={group.id} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">
                      {group.name}
                    </p>
                    <p className="truncate text-xs text-neutral-600">
                      {group.id}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={group.enabled}
                      className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 accent-emerald-600"
                    />
                    <span className="sm:hidden">Ativo</span>
                  </label>
                  <input
                    type="number"
                    name="maxPerDay"
                    min={0}
                    defaultValue={group.maxPerDay}
                    aria-label="Máximo de mensagens por dia"
                    className="w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                  >
                    Salvar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
