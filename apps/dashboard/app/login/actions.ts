"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionValue, sessionCookie, verifyPassword } from "@/lib/auth";
import { podeTentar, registrarFalha, registrarSucesso } from "@/lib/rate-limit";

/**
 * Identifica quem está tentando entrar.
 *
 * Atrás do Caddy, o IP real vem em X-Forwarded-For — o socket enxergaria só o
 * proxy. Pega o PRIMEIRO da lista: o cliente pode enviar o header forjado, mas
 * o Caddy acrescenta o IP verdadeiro ao final, e é dele que partem os demais.
 */
async function identificarOrigem(): Promise<string> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return h.get("x-real-ip") ?? "desconhecido";
}

/** Estado devolvido ao formulário (mensagem de erro para o operador). */
export interface EstadoLogin {
  erro?: string;
}

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const senha = String(formData.get("senha") ?? "");
  const destinoBruto = String(formData.get("destino") ?? "/");

  const senhaCorreta = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;

  if (!senhaCorreta || !secret) {
    return {
      erro: "O painel está sem senha configurada. Avise quem instalou.",
    };
  }

  // Trava antes de conferir a senha: sem isso um bot testaria sem limite.
  const origem = await identificarOrigem();
  const limite = podeTentar(origem);
  if (!limite.permitido) {
    const minutos = Math.ceil(limite.esperarSegundos / 60);
    return {
      erro: `Muitas tentativas. Aguarde ${minutos} minuto${minutos > 1 ? "s" : ""} e tente de novo.`,
    };
  }

  if (!(await verifyPassword(senha, senhaCorreta, secret))) {
    registrarFalha(origem);
    return { erro: "Senha incorreta. Tente de novo." };
  }

  registrarSucesso(origem);

  const store = await cookies();
  store.set(sessionCookie.name, await createSessionValue(secret), {
    httpOnly: true, // o JavaScript da página não enxerga o cookie
    secure: process.env.NODE_ENV === "production", // só trafega via HTTPS
    sameSite: "lax", // não vai junto em requisições de outros sites
    path: "/",
    maxAge: sessionCookie.maxAge,
  });

  // Só aceita caminho interno: um "destino" vindo da URL poderia apontar para
  // fora e virar redirecionamento aberto (o atacante manda o link, o usuário
  // loga e cai num site clonado). "//site.com" também é externo — daí a
  // segunda checagem.
  const destino =
    destinoBruto.startsWith("/") && !destinoBruto.startsWith("//")
      ? destinoBruto
      : "/";

  redirect(destino);
}

export async function sair(): Promise<void> {
  const store = await cookies();
  store.delete(sessionCookie.name);
  redirect("/login");
}
