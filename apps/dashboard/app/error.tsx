"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
      <h2 className="mb-2 text-base font-semibold text-red-300">
        Algo deu errado ao falar com o agente
      </h2>
      <p className="text-sm text-red-100/80">
        {error.message ||
          "Erro inesperado. Verifique se o agente está no ar e tente novamente."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg border border-red-400/40 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20"
      >
        Tentar novamente
      </button>
    </div>
  );
}
