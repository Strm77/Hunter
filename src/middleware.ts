import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

const PUBLICAS = ["/entrar", "/cadastro", "/api/entrar", "/api/cadastro", "/api/sair"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();

  // Sessão conferida no servidor: assinatura e validade. Sem segredo configurado, ninguém entra.
  if (await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Faça login para continuar." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = pathname === "/" ? "" : `?proximo=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
