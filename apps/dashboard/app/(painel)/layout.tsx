import type { ReactNode } from "react";
import { NavLinks } from "@/components/nav-links";
import { PausedBanner } from "@/components/paused-banner";
import { StatusStrip } from "@/components/status-strip";
import { BottomNav } from "@/components/bottom-nav";
import { BotaoSair } from "@/components/botao-sair";

// Layout de quem já entrou. O <html>/<body> e o globals.css vivem no layout
// raiz; a tela de login está fora deste grupo e por isso não herda a navegação
// nem o aviso de pausa daqui.
export default function PainelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="mb-6 px-3">
          <p className="font-display text-sm font-semibold tracking-tight text-ink">
            Agente ML Afiliados
          </p>
          <p className="mt-0.5 text-xs text-mute">Console de disparos</p>
        </div>
        <NavLinks />
        <div className="mt-auto pt-4">
          <BotaoSair />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <PausedBanner />
        <StatusStrip variant="full" />
        <main className="min-w-0 flex-1 p-6 pb-24 md:p-10 md:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
