import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSession, sessionCookie } from "@/lib/auth";

// Portão de entrada do painel: TUDO exige sessão, menos o que está listado
// abaixo. A lógica é deliberadamente invertida (bloqueia por padrão) — assim
// uma página nova nasce protegida, sem ninguém precisar lembrar disso.
const ROTAS_PUBLICAS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota))) {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_SESSION_SECRET;

  // Sem segredo configurado o painel ficaria aberto para qualquer um.
  // Recusar é a única opção segura: falhar fechado, nunca aberto.
  if (!secret) {
    return new NextResponse(
      "Painel sem senha configurada. Defina DASHBOARD_PASSWORD e DASHBOARD_SESSION_SECRET.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const cookie = request.cookies.get(sessionCookie.name)?.value;
  if (await isValidSession(cookie, secret)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  // Guarda para onde ele queria ir, para voltar depois de entrar.
  if (pathname !== "/") login.searchParams.set("destino", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Exclui os assets internos do Next e o favicon — não precisam de sessão e
  // passar por aqui só adicionaria latência.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
