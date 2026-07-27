import { togglePause } from "@/app/actions";
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
    <div className="border-b border-amber-800/60 bg-amber-950/60">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-10">
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">⏸️</span>
          <div>
            <p className="text-sm font-semibold text-amber-100">
              Agente pausado — nenhuma mensagem está sendo enviada
            </p>
            <p className="text-xs text-amber-200/70">
              A pausa pode ter sido automática, após uma queda de conexão do
              WhatsApp.
            </p>
          </div>
        </div>
        <form action={togglePause}>
          <input type="hidden" name="paused" value="true" />
          <button
            type="submit"
            className="rounded-lg bg-amber-200 px-4 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
          >
            Retomar envios
          </button>
        </form>
      </div>
    </div>
  );
}
