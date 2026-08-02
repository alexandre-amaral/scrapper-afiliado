export function SetupHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-6">
      <h2 className="mb-2 font-display text-base font-semibold text-warning">
        Agente não configurado ou fora do ar
      </h2>
      <p className="text-sm leading-relaxed text-ink/80">{message}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-mute">
        <li>
          Confira se o agente está rodando (localmente:{" "}
          <code className="rounded bg-bg/50 px-1 font-mono text-xs">pnpm dev</code>{" "}
          em{" "}
          <code className="rounded bg-bg/50 px-1 font-mono text-xs">apps/agent</code>
          ).
        </li>
        <li>
          Defina{" "}
          <code className="rounded bg-bg/50 px-1 font-mono text-xs">AGENT_URL</code>{" "}
          e{" "}
          <code className="rounded bg-bg/50 px-1 font-mono text-xs">AGENT_TOKEN</code>{" "}
          no{" "}
          <code className="rounded bg-bg/50 px-1 font-mono text-xs">.env</code> do
          dashboard (ou nas variáveis de ambiente da Vercel).
        </li>
        <li>Recarregue esta página após ajustar a configuração.</li>
      </ul>
    </div>
  );
}
