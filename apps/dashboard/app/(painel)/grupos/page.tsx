import type { Metadata } from "next";
import { patchGroup, syncGroups } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { SyncGroupsButton } from "@/components/sync-groups-button";
import { tryAgent, type Group } from "@/lib/agent-api";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const result = await tryAgent<Group[]>("/groups");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Grupos" />
        <SetupHint message={result.error} />
      </div>
    );
  }

  const groups = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos"
        description="Grupos de WhatsApp que recebem as ofertas. Controle quais estão ativos e o limite diário de mensagens por grupo."
        actions={<SyncGroupsButton action={syncGroups} />}
      />

      {groups.length === 0 ? (
        <div className={ui.empty}>
          <p className="text-sm text-ink/80">Nenhum grupo encontrado.</p>
          <p className="mt-2 text-xs text-mute">
            Conecte o WhatsApp e clique em “Sincronizar grupos” para o agente
            descobrir os grupos do número.
          </p>
        </div>
      ) : (
        <div className={ui.cardFlush}>
          <div className="hidden grid-cols-[1fr_8rem_8rem_6rem] gap-4 bg-elevated px-4 py-3 text-xs font-medium uppercase tracking-wide text-mute sm:grid">
            <span>Grupo</span>
            <span>Ativo</span>
            <span>Máx./dia</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {groups.map((group) => (
              <li key={group.id}>
                <form
                  action={patchGroup}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_8rem_8rem_6rem] sm:gap-4"
                >
                  <input type="hidden" name="id" value={group.id} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{group.name}</p>
                    <p className="truncate font-mono text-xs text-mute">
                      {group.id}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={group.enabled}
                      className="h-4 w-4 rounded border-border bg-elevated accent-accent"
                    />
                    <span className="sm:hidden">Ativo</span>
                  </label>
                  <input
                    type="number"
                    name="maxPerDay"
                    min={0}
                    defaultValue={group.maxPerDay}
                    aria-label="Máximo de mensagens por dia"
                    className={`${ui.input} w-24`}
                  />
                  <button type="submit" className={ui.btnGhost}>
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
