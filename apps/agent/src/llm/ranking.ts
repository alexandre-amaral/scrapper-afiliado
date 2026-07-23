/**
 * Ranking de ofertas via LLM.
 *
 * O modelo recebe a lista de ofertas candidatas e escolhe as topN mais
 * atrativas para um grupo de ofertas no WhatsApp. Em caso de qualquer
 * falha do LLM, cai no fallback determinístico (ordenar por desconto) —
 * o pipeline NUNCA morre por causa do LLM.
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { AgentEnv, Offer } from "@ml-agent/core";
import { getModel } from "./provider.js";

/** Schema da resposta estruturada: apenas os itemIds escolhidos, em ordem. */
const rankingSchema = z.object({
  itemIds: z.array(z.string()),
});

/** Formata uma oferta como linha compacta para o prompt. */
function offerToLine(offer: Offer): string {
  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const parts = [
    `- itemId: ${offer.itemId}`,
    `título: ${offer.title}`,
    `preço: ${brl.format(offer.price)}`,
  ];
  if (offer.originalPrice != null) {
    parts.push(`preço original: ${brl.format(offer.originalPrice)}`);
  }
  if (offer.discountPct != null) {
    parts.push(`desconto: ${offer.discountPct}%`);
  }
  parts.push(`frete grátis: ${offer.freeShipping ? "sim" : "não"}`);
  if (offer.category) {
    parts.push(`categoria: ${offer.category}`);
  }
  return parts.join(" | ");
}

/** Fallback determinístico: maior desconto primeiro, nulls por último. */
function fallbackRank(offers: Offer[], topN: number): Offer[] {
  return [...offers]
    .sort((a, b) => {
      if (a.discountPct == null && b.discountPct == null) return 0;
      if (a.discountPct == null) return 1;
      if (b.discountPct == null) return -1;
      return b.discountPct - a.discountPct;
    })
    .slice(0, topN);
}

/**
 * Escolhe as topN ofertas mais atrativas via LLM, preservando a ordem
 * retornada pelo modelo. Ids alucinados (não presentes na lista) são
 * ignorados. Em erro, retorna o fallback por desconto.
 */
export async function rankOffers(
  env: AgentEnv,
  offers: Offer[],
  topN: number,
): Promise<Offer[]> {
  if (offers.length === 0) return [];
  // Se já temos menos (ou igual) ofertas do que o pedido, não gasta tokens.
  if (offers.length <= topN) return [...offers];

  try {
    const model = getModel(env);

    const { object } = await generateObject({
      model,
      schema: rankingSchema,
      system:
        "Você é um curador de ofertas para um grupo de promoções no WhatsApp " +
        "no Brasil. Seu trabalho é escolher as ofertas com maior chance de " +
        "engajar e converter o público brasileiro.",
      prompt: [
        `Analise as ofertas abaixo e escolha as ${topN} MAIS ATRATIVAS para postar no grupo.`,
        "",
        "Critérios (pondere todos):",
        "- Percentual de desconto (quanto maior, melhor);",
        "- Atratividade do preço absoluto (preços baixos geram compra por impulso);",
        "- Apelo do produto para o público geral (eletrônicos, casa, itens desejados);",
        "- Frete grátis é um diferencial forte.",
        "",
        "Ofertas candidatas:",
        ...offers.map(offerToLine),
        "",
        `Responda APENAS com os itemIds das ${topN} ofertas escolhidas, em ordem da mais atrativa para a menos atrativa. Use exatamente os itemIds fornecidos.`,
      ].join("\n"),
    });

    // Mapeia itemIds de volta para as ofertas, preservando a ordem do modelo.
    const byItemId = new Map(offers.map((o) => [o.itemId, o]));
    const seen = new Set<string>();
    const ranked: Offer[] = [];
    for (const itemId of object.itemIds) {
      const offer = byItemId.get(itemId);
      // Ignora ids alucinados e duplicados.
      if (!offer || seen.has(itemId)) continue;
      seen.add(itemId);
      ranked.push(offer);
      if (ranked.length >= topN) break;
    }

    // Se o modelo devolveu menos ids válidos que topN, completa com o fallback.
    if (ranked.length < topN) {
      for (const offer of fallbackRank(offers, offers.length)) {
        if (ranked.length >= topN) break;
        if (!seen.has(offer.itemId)) {
          seen.add(offer.itemId);
          ranked.push(offer);
        }
      }
    }

    return ranked;
  } catch (error) {
    console.warn(
      "[llm/ranking] Falha no ranking via LLM — usando fallback por desconto:",
      error instanceof Error ? error.message : error,
    );
    return fallbackRank(offers, topN);
  }
}
