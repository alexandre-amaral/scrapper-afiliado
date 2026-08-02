import type { Metadata } from "next";
import { submitManualUrls } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Offer } from "@/lib/agent-api";
import { formatDateTime, formatPrice, truncate } from "@/lib/format";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fontes" };

const sourceLabels: Record<string, string> = {
  "ml-api": "API ML",
  scraper: "Scraper",
  manual: "Manual",
};

export default async function SourcesPage() {
  const result = await tryAgent<Offer[]>("/offers?limit=50");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fontes"
        description="Adicione ofertas manualmente e acompanhe as últimas ofertas coletadas."
      />

      <section className={ui.card}>
        <h2 className="mb-2 text-sm font-semibold text-ink">
          Adicionar URLs manualmente
        </h2>
        <p className="mb-3 text-xs text-mute">
          Cole uma URL de produto do Mercado Livre por linha. O agente gera o
          link de afiliado e cria o rascunho da mensagem.
        </p>
        <form action={submitManualUrls} className="space-y-3">
          <textarea
            name="urls"
            rows={5}
            required
            placeholder={
              "https://www.mercadolivre.com.br/produto-exemplo/p/MLB123\nhttps://produto.mercadolivre.com.br/MLB-456..."
            }
            className={`${ui.textarea} font-mono text-xs`}
          />
          <button type="submit" className={ui.btnPrimary}>
            Enviar URLs
          </button>
        </form>
      </section>

      <section>
        <h2 className={ui.sectionTitle}>Ofertas recentes</h2>
        {!result.ok ? (
          <SetupHint message={result.error} />
        ) : result.data.length === 0 ? (
          <p className="text-sm text-mute">
            Nenhuma oferta coletada ainda. Use “Coletar agora” na visão geral ou
            adicione URLs acima.
          </p>
        ) : (
          <div className={`${ui.cardFlush} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-elevated text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Preço</th>
                  <th className="px-4 py-3 font-medium">Desconto</th>
                  <th className="px-4 py-3 font-medium">Fonte</th>
                  <th className="px-4 py-3 font-medium">Coletada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((offer) => (
                  <tr key={offer.id}>
                    <td className="px-4 py-3">
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink hover:text-accent hover:underline"
                      >
                        {truncate(offer.title, 70)}
                      </a>
                      {offer.freeShipping ? (
                        <span className="ml-2 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          Frete grátis
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-ink">{formatPrice(offer.price)}</span>
                      {offer.originalPrice != null ? (
                        <span className="ml-2 text-xs text-mute line-through">
                          {formatPrice(offer.originalPrice)}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/80">
                      {offer.discountPct != null
                        ? `${offer.discountPct}%`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-mute">
                      {sourceLabels[offer.source] ?? offer.source}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-mute">
                      {formatDateTime(offer.collectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
