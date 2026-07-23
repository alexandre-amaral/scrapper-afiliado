/**
 * Compositor de mensagens de oferta via LLM.
 *
 * Gera o texto final para o WhatsApp a partir dos fatos da oferta.
 * Garantias:
 * - a mensagem SEMPRE contém o link de afiliado (anexado se o modelo esquecer);
 * - em qualquer falha do LLM, cai no template determinístico (fallbackTemplate).
 */

import { generateText } from "ai";
import type { AgentEnv, Offer } from "@ml-agent/core";
import { getModel } from "./provider.js";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Prompt padrão do compositor — usado quando settings.composerPrompt está vazio. */
const DEFAULT_COMPOSER_PROMPT = [
  "Você é um vendedor experiente de um grupo de ofertas no WhatsApp no Brasil.",
  "Escreva uma mensagem CURTA de promoção, pronta para enviar no grupo.",
  "Regras:",
  "- Use emojis com moderação (2 a 4 no máximo);",
  "- Destaque o preço e o percentual de desconto quando houver;",
  "- Crie um senso de urgência leve (ex.: 'corre que acaba'), sem exagero;",
  "- Mencione frete grátis apenas se a oferta tiver;",
  "- NUNCA invente dados (cupons, avaliações, estoque, prazos);",
  "- Use apenas os fatos fornecidos;",
  "- SEMPRE termine a mensagem com o link de afiliado em uma linha própria;",
  "- Não use markdown além dos suportados pelo WhatsApp (*negrito*, ~riscado~).",
].join("\n");

/**
 * Template determinístico em pt-BR — fallback quando o LLM falha
 * (e base de comparação para o texto gerado).
 */
export function fallbackTemplate(offer: Offer, affiliateUrl: string): string {
  const lines: string[] = [`🔥 ${offer.title}`, ""];

  if (offer.originalPrice != null && offer.discountPct != null) {
    lines.push(
      `💰 ${brl.format(offer.price)} ~${brl.format(offer.originalPrice)}~ (${offer.discountPct}% OFF)`,
    );
  } else if (offer.originalPrice != null) {
    lines.push(`💰 ${brl.format(offer.price)} ~${brl.format(offer.originalPrice)}~`);
  } else if (offer.discountPct != null) {
    lines.push(`💰 ${brl.format(offer.price)} (${offer.discountPct}% OFF)`);
  } else {
    lines.push(`💰 ${brl.format(offer.price)}`);
  }

  if (offer.freeShipping) {
    lines.push("🚚 Frete grátis!");
  }

  lines.push("", `👉 ${affiliateUrl}`);
  return lines.join("\n");
}

/**
 * Compõe a mensagem de oferta via LLM.
 * Usa o composerPrompt das settings quando não vazio; senão, o prompt padrão.
 * Garante o link de afiliado no final e cai no template em caso de erro.
 */
export async function composeMessage(
  env: AgentEnv,
  offer: Offer,
  affiliateUrl: string,
  composerPrompt: string,
): Promise<string> {
  try {
    const model = getModel(env);

    const system = composerPrompt.trim() !== "" ? composerPrompt : DEFAULT_COMPOSER_PROMPT;

    const facts: string[] = [
      "Fatos da oferta (use apenas estes dados):",
      `- Produto: ${offer.title}`,
      `- Preço atual: ${brl.format(offer.price)}`,
    ];
    if (offer.originalPrice != null) {
      facts.push(`- Preço original: ${brl.format(offer.originalPrice)}`);
    }
    if (offer.discountPct != null) {
      facts.push(`- Desconto: ${offer.discountPct}%`);
    }
    facts.push(`- Frete grátis: ${offer.freeShipping ? "sim" : "não"}`);
    facts.push(`- Link de afiliado (obrigatório no final): ${affiliateUrl}`);

    const { text } = await generateText({
      model,
      system,
      prompt: facts.join("\n"),
    });

    const message = text.trim();
    if (message === "") {
      // Modelo devolveu vazio — trata como falha e usa o template.
      throw new Error("LLM retornou texto vazio");
    }

    // Garantia dura: a mensagem precisa conter o link de afiliado.
    if (!message.includes(affiliateUrl)) {
      return `${message}\n${affiliateUrl}`;
    }

    return message;
  } catch (error) {
    console.warn(
      "[llm/composer] Falha na composição via LLM — usando template fallback:",
      error instanceof Error ? error.message : error,
    );
    return fallbackTemplate(offer, affiliateUrl);
  }
}
