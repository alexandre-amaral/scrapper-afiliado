import Link from "next/link";
import type { Diagnostics, CheckStatus } from "@/lib/agent-api";

/**
 * Painel "está tudo pronto?" no topo da visão geral.
 *
 * Quando tudo está ok, encolhe para uma única linha verde — não rouba
 * espaço no uso diário. Quando falta algo, expande e mostra exatamente o
 * que fazer e para onde ir, para o operador resolver sozinho.
 */

const dotColor: Record<CheckStatus, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-danger",
};

const textColor: Record<CheckStatus, string> = {
  ok: "text-ink",
  warn: "text-warning",
  error: "text-danger",
};

export function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  const { ready, errors, warnings, checks } = diagnostics;
  const pending = checks.filter((c) => c.status !== "ok");

  if (ready && warnings === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" />
        <p className="text-sm font-medium text-success">
          Tudo pronto — o agente está operando normalmente.
        </p>
      </div>
    );
  }

  const isBlocking = errors > 0;

  return (
    <div
      className={`rounded-xl border p-5 ${
        isBlocking
          ? "border-danger/40 bg-danger/10"
          : "border-warning/40 bg-warning/10"
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
            isBlocking ? "bg-danger" : "bg-warning"
          }`}
          aria-hidden
        />
        <div>
          <p
            className={`text-sm font-semibold ${
              isBlocking ? "text-danger" : "text-warning"
            }`}
          >
            {isBlocking
              ? errors === 1
                ? "Falta 1 configuração para funcionar"
                : `Faltam ${errors} configurações para funcionar`
              : "Funcionando, mas com pontos de atenção"}
          </p>
          <p className="mt-0.5 text-xs text-mute">
            {isBlocking
              ? "Enquanto isso não for resolvido, nenhuma mensagem será enviada."
              : "O agente opera assim, mas vale revisar os itens abaixo."}
          </p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {pending.map((check) => (
          <li key={check.id} className="flex items-start gap-3">
            <span
              className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${dotColor[check.status]}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${textColor[check.status]}`}>
                {check.label}
              </p>
              <p className="text-xs text-mute">{check.detail}</p>
              {check.action ? (
                <Link
                  href={check.href}
                  className="mt-1 inline-block text-xs font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
                >
                  {check.action}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {checks.length > pending.length ? (
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-mute">
          Em ordem:{" "}
          {checks
            .filter((c) => c.status === "ok")
            .map((c) => c.label)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
