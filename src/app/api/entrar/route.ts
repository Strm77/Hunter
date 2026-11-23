import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, DURACAO_SESSAO_S, codigoConfigurado, destinoSeguro, iguais, tokenDaSessao } from "@/lib/sessao";

export const dynamic = "force-dynamic";

function redirecionar(req: NextRequest, caminho: string) {
  return NextResponse.redirect(new URL(caminho, req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const tentativa = String(form.get("codigo") ?? "");
  const proximo = destinoSeguro(form.get("proximo"));
  const codigo = codigoConfigurado();

  if (!codigo) return redirecionar(req, "/entrar?erro=config");

  const [esperado, recebido] = await Promise.all([tokenDaSessao(codigo), tokenDaSessao(tentativa)]);
  if (!iguais(esperado, recebido)) {
    // Atraso fixo para desencorajar tentativas em sequência.
    await new Promise((r) => setTimeout(r, 1000));
    const q = proximo !== "/" ? `&proximo=${encodeURIComponent(proximo)}` : "";
    return redirecionar(req, `/entrar?erro=codigo${q}`);
  }

  const res = redirecionar(req, proximo);
  res.cookies.set(COOKIE_SESSAO, esperado, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SESSAO_S,
  });
  return res;
}
