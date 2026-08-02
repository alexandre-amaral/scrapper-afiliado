import Link from "next/link";
import { togglePause, triggerCollect } from "@/app/actions";
import { tryAgent, type Overview } from "@/lib/agent-api";
import {
  affiliateColors,
  affiliateLabels,
  whatsappColors,
  whatsappLabels,
} from "@/lib/labels";
import { ui } from "@/lib/ui";

/**
 * Assinatura do console: faixa de status operacional no topo do painel.
 * - compact: só dots + labels (demais páginas)
 * - full: + CTAs Pausar/Retomar e Coletar agora (visão geral)
 */
export async function StatusStrip({
  variant = "compact",
}: {
  variant?: "full" | "compact";
}) {
  const result = await tryAgent<Overview>("/overview");

  if (!result.ok) {
    return (
      <div className="border-b border-border bg-surface/80">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-2.5 md:px-10">
          <span className="inline-block h-2 w-2 rounded-full bg-mute" />
          <p className="text-xs text-mute">
            Status indisponível — agente fora do ar
          </p>
        </div>
      </div>
    );
  }

  const { whatsapp, affiliateSession, paused } = result.data;

  const items = [
    {
      key: "wa",
      label: "WhatsApp",
      value: whatsappLabels[whatsapp],
      color: whatsappColors[whatsapp],
      href: "/whatsapp",
    },
    {
      key: "aff",
      label: "Afiliado",
      value: affiliateLabels[affiliateSession],
      color: affiliateColors[affiliateSession],
      href: "/credenciais",
    },
    {
      key: "dispatch",
      label: "Disparos",
      value: paused ? "Pausado" : "Ativo",
      color: paused ? "bg-warning" : "bg-success",
      href: "/",
    },
  ] as const;

  return (
    <div className="border-b border-border bg-surface/80">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 md:px-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-2 text-xs transition-colors hover:text-ink"
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${item.color}`}
              />
              <span className="text-mute">{item.label}</span>
              <span className="font-medium text-ink">{item.value}</span>
            </Link>
          ))}
        </div>

        {variant === "full" ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={togglePause}>
              <input type="hidden" name="paused" value={String(paused)} />
              <button type="submit" className={ui.btnGhost}>
                {paused ? "Retomar" : "Pausar"}
              </button>
            </form>
            <form action={triggerCollect}>
              <button type="submit" className={ui.btnPrimary}>
                Coletar agora
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
