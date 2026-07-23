import type { Metadata } from "next";
import { approveMessage, rejectMessage, updateMessage } from "@/app/actions";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Message } from "@/lib/agent-api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aprovação" };

export default async function ApprovalPage() {
  const result = await tryAgent<Message[]>("/messages?status=draft");

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Fila de aprovação
        </h1>
        <SetupHint message={result.error} />
      </div>
    );
  }

  const drafts = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Fila de aprovação
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Revise, edite e aprove as mensagens em rascunho antes do envio aos
          grupos.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-10 text-center">
          <p className="text-sm text-neutral-400">
            Nenhuma mensagem aguardando aprovação.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Novos rascunhos aparecem aqui após cada coleta (ou ative a
            aprovação automática em Configurações).
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {drafts.map((message) => (
            <li
              key={message.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
            >
              <form className="space-y-3">
                <input type="hidden" name="id" value={message.id} />
                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span>Criada em {formatDateTime(message.createdAt)}</span>
                  {message.groupId ? (
                    <span>Grupo: {message.groupId}</span>
                  ) : null}
                  {message.scheduledFor ? (
                    <span>
                      Agendada para {formatDateTime(message.scheduledFor)}
                    </span>
                  ) : null}
                </div>
                <textarea
                  name="body"
                  defaultValue={message.body}
                  rows={5}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-neutral-500"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    formAction={approveMessage}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                  >
                    Aprovar
                  </button>
                  <button
                    type="submit"
                    formAction={updateMessage}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                  >
                    Salvar edição
                  </button>
                  <button
                    type="submit"
                    formAction={rejectMessage}
                    className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    Rejeitar
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
