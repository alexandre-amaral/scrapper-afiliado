import { ResumePausedButton } from "@/components/status-strip-actions";
import { tryAgent, type Overview } from "@/lib/agent-api";

/**
 * Faixa fixa no topo de TODAS as telas quando o agente está pausado.
 *
 * O estado de pausa antes só aparecia num cartão discreto da visão geral —
 * dava para ficar dias pausado sem perceber (foi o que aconteceu). Como a
 * pausa também é automática (anti-ban ao detectar desconexão), ela precisa
 * ser impossível de ignorar, com o botão de retomar ao lado.
 *
 * Falha em silêncio: se o agente estiver fora do ar, não renderiza nada —
 * quem avisa disso é a própria página, com uma mensagem melhor.
 */
export async function PausedBanner() {
  const result = await tryAgent<Overview>("/overview");
  if (!result.ok || !result.data.paused) return null;

  return (
    <div className="border-b border-warning/40 bg-warning/10">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-10">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-warning"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-warning">
              Agente pausado — nenhuma mensagem está sendo enviada
            </p>
            <p className="text-xs text-warning/70">
              A pausa pode ter sido automática, após uma queda de conexão do
              WhatsApp.
            </p>
          </div>
        </div>
        <ResumePausedButton />
      </div>
    </div>
  );
}
