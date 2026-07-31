import { sair } from "@/app/login/actions";

/** Encerra a sessão do painel. Fica no rodapé da barra lateral. */
export function BotaoSair() {
  return (
    <form action={sair}>
      <button
        type="submit"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-300"
      >
        Sair
      </button>
    </form>
  );
}
