export function SetupHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <h2 className="mb-2 text-base font-semibold text-amber-300">
        Agente não configurado ou fora do ar
      </h2>
      <p className="text-sm leading-relaxed text-amber-100/80">{message}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-100/60">
        <li>
          Confira se o agente está rodando (localmente:{" "}
          <code className="rounded bg-black/30 px-1">pnpm dev</code> em{" "}
          <code className="rounded bg-black/30 px-1">apps/agent</code>).
        </li>
        <li>
          Defina <code className="rounded bg-black/30 px-1">AGENT_URL</code> e{" "}
          <code className="rounded bg-black/30 px-1">AGENT_TOKEN</code> no{" "}
          <code className="rounded bg-black/30 px-1">.env</code> do dashboard
          (ou nas variáveis de ambiente da Vercel).
        </li>
        <li>Recarregue esta página após ajustar a configuração.</li>
      </ul>
    </div>
  );
}
