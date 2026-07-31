import type { ReactNode } from "react";
import { NavLinks } from "@/components/nav-links";
import { PausedBanner } from "@/components/paused-banner";
import { BotaoSair } from "@/components/botao-sair";

// Layout de quem já entrou. O <html>/<body> e o globals.css vivem no layout
// raiz; a tela de login está fora deste grupo e por isso não herda a navegação
// nem o aviso de pausa daqui.
export default function PainelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 p-4 md:flex">
        <div className="mb-6 px-3">
          <p className="text-sm font-semibold tracking-tight text-neutral-100">
            Agente ML Afiliados
          </p>
          <p className="text-xs text-neutral-500">Painel de controle</p>
        </div>
        <NavLinks />
        {/* mt-auto empurra o botão para o rodapé da barra lateral. */}
        <div className="mt-auto pt-4">
          <BotaoSair />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Aviso de pausa: precede o conteúdo em todas as telas. */}
        <PausedBanner />
        <main className="min-w-0 flex-1 p-6 md:p-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
