import { sair } from "@/app/login/actions";

/** Encerra a sessão do painel. Fica no rodapé da barra lateral. */
export function BotaoSair() {
  return (
    <form action={sair}>
      <button
        type="submit"
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-mute transition hover:bg-elevated hover:text-ink"
      >
        Sair
      </button>
    </form>
  );
}
