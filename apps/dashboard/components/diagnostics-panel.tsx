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
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

const textColor: Record<CheckStatus, string> = {
  ok: "text-neutral-300",
  warn: "text-amber-200",
  error: "text-red-200",
};

export function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  const { ready, errors, warnings, checks } = diagnostics;
  const pending = checks.filter((c) => c.status !== "ok");

  // Caminho feliz: uma linha discreta confirmando que está tudo certo.
  if (ready && warnings === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <p className="text-sm font-medium text-emerald-200">
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
          ? "border-red-900/60 bg-red-950/30"
          : "border-amber-900/60 bg-amber-950/20"
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-1 text-lg leading-none">{isBlocking ? "⚠️" : "ℹ️"}</span>
        <div>
          <p
            className={`text-sm font-semibold ${
              isBlocking ? "text-red-100" : "text-amber-100"
            }`}
          >
            {isBlocking
              ? errors === 1
                ? "Falta 1 configuração para funcionar"
                : `Faltam ${errors} configurações para funcionar`
              : "Funcionando, mas com pontos de atenção"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
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
              <p className="text-xs text-neutral-400">{check.detail}</p>
              {check.action ? (
                <Link
                  href={check.href}
                  className="mt-1 inline-block text-xs font-medium text-neutral-200 underline decoration-neutral-600 underline-offset-2 transition-colors hover:decoration-neutral-300"
                >
                  {check.action}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Resumo dos itens que já estão certos, sem ocupar espaço vertical. */}
      {checks.length > pending.length ? (
        <p className="mt-4 border-t border-neutral-800/60 pt-3 text-xs text-neutral-500">
          ✓ Em ordem:{" "}
          {checks
            .filter((c) => c.status === "ok")
            .map((c) => c.label)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
