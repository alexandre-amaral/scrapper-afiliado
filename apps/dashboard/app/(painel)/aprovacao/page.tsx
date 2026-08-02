import type { Metadata } from "next";
import Link from "next/link";
import { approveMessage, rejectMessage, updateMessage } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type AgentSettings, type Message } from "@/lib/agent-api";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aprovação" };

export default async function ApprovalPage() {
  const [result, settings] = await Promise.all([
    tryAgent<Message[]>("/messages?status=draft"),
    tryAgent<AgentSettings>("/settings"),
  ]);
  const autoApprove = settings.ok ? settings.data.autoApprove : false;

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fila de aprovação" />
        <SetupHint message={result.error} />
      </div>
    );
  }

  const drafts = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de aprovação"
        description="Revise, edite e aprove as mensagens em rascunho antes do envio aos grupos."
      />

      {autoApprove ? (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-ink/90">
          <strong>Aprovação automática ligada.</strong> As mensagens novas já
          entram aprovadas e vão para o grupo sem passar por aqui — esta tela
          fica vazia de propósito. Para voltar a revisar uma a uma, desligue a
          chave em{" "}
          <Link href="/configuracoes" className="text-accent hover:underline">
            Configurações
          </Link>
          .
        </p>
      ) : null}

      {drafts.length === 0 ? (
        <div className={ui.empty}>
          <p className="text-sm text-ink/80">
            Nenhuma mensagem aguardando aprovação.
          </p>
          <p className="mt-2 text-xs text-mute">
            Novos rascunhos aparecem após cada coleta.{" "}
            <Link href="/" className="text-accent hover:underline">
              Coletar agora
            </Link>{" "}
            ou ative a aprovação automática em Configurações.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {drafts.map((message) => (
            <li key={message.id} className={ui.card}>
              <form className="space-y-3">
                <input type="hidden" name="id" value={message.id} />
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-mute">
                  <span>Criada em {formatDateTime(message.createdAt)}</span>
                  {message.groupId ? <span>Grupo: {message.groupId}</span> : null}
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
                  className={ui.textarea}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    formAction={approveMessage}
                    className={ui.btnPrimary}
                  >
                    Aprovar
                  </button>
                  <button
                    type="submit"
                    formAction={updateMessage}
                    className={ui.btnGhost}
                  >
                    Salvar edição
                  </button>
                  <button
                    type="submit"
                    formAction={rejectMessage}
                    className={ui.btnDanger}
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
