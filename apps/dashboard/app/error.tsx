"use client";

import { ui } from "@/lib/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-6">
      <h2 className="mb-2 font-display text-base font-semibold text-danger">
        Algo deu errado ao falar com o agente
      </h2>
      <p className="text-sm text-ink/80">
        {error.message ||
          "Erro inesperado. Verifique se o agente está no ar e tente novamente."}
      </p>
      <button type="button" onClick={reset} className={`mt-4 ${ui.btnDanger}`}>
        Tentar novamente
      </button>
    </div>
  );
}
