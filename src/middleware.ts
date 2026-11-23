import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, codigoConfigurado, iguais, tokenDaSessao } from "@/lib/sessao";

const PUBLICAS = ["/entrar", "/api/entrar", "/api/sair"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();

  const codigo = codigoConfigurado();
  const cookie = req.cookies.get(COOKIE_SESSAO)?.value ?? "";
  // Sem código configurado, o app fica fechado para todos (falha fechada).
  if (codigo && cookie && iguais(cookie, await tokenDaSessao(codigo))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Acesso não autorizado." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = pathname === "/" ? "" : `?proximo=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo, menos arquivos estáticos do Next e o favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
