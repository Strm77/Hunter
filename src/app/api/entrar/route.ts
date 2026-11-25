import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, criarSessao, destinoSeguro, opcoesCookie, sessaoConfigurada } from "@/lib/sessao";
import { buscarUsuario, hashParaComparacaoVazia, normalizarEmail, senhaConfere } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

function voltar(req: NextRequest, erro: string, email: string, proximo: string) {
  const q = new URLSearchParams({ erro });
  if (email) q.set("email", email);
  if (proximo !== "/") q.set("proximo", proximo);
  return NextResponse.redirect(new URL(`/entrar?${q}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = normalizarEmail(form.get("email"));
  const senha = String(form.get("senha") ?? "");
  const proximo = destinoSeguro(form.get("proximo"));

  if (!sessaoConfigurada()) return voltar(req, "config", email, proximo);

  const usuario = email ? await buscarUsuario(email) : null;
  const ok = await senhaConfere(senha, usuario?.senha_hash ?? (await hashParaComparacaoVazia()));
  if (!usuario || !ok) {
    await new Promise((r) => setTimeout(r, 800)); // desencoraja tentativas em sequência
    return voltar(req, "credenciais", email, proximo);
  }

  const res = NextResponse.redirect(new URL(proximo, req.url), 303);
  res.cookies.set(COOKIE_SESSAO, await criarSessao(usuario), opcoesCookie);
  return res;
}
