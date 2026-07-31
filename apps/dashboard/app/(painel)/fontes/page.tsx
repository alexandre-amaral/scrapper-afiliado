import type { Metadata } from "next";
import { submitManualUrls } from "@/app/actions";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Offer } from "@/lib/agent-api";
import { formatDateTime, formatPrice, truncate } from "@/lib/format";

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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Fontes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Adicione ofertas manualmente e acompanhe as últimas ofertas
          coletadas.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">
          Adicionar URLs manualmente
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
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
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 font-mono text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            Enviar URLs
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">
          Ofertas recentes
        </h2>
        {!result.ok ? (
          <SetupHint message={result.error} />
        ) : result.data.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma oferta coletada ainda. Use “Coletar agora” na visão geral
            ou adicione URLs acima.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Preço</th>
                  <th className="px-4 py-3 font-medium">Desconto</th>
                  <th className="px-4 py-3 font-medium">Fonte</th>
                  <th className="px-4 py-3 font-medium">Coletada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 bg-neutral-900/40">
                {result.data.map((offer) => (
                  <tr key={offer.id}>
                    <td className="px-4 py-3">
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-200 hover:underline"
                      >
                        {truncate(offer.title, 70)}
                      </a>
                      {offer.freeShipping ? (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          Frete grátis
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-neutral-200">
                        {formatPrice(offer.price)}
                      </span>
                      {offer.originalPrice != null ? (
                        <span className="ml-2 text-xs text-neutral-500 line-through">
                          {formatPrice(offer.originalPrice)}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-300">
                      {offer.discountPct != null
                        ? `${offer.discountPct}%`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                      {sourceLabels[offer.source] ?? offer.source}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
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
