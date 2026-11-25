import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, criarSessao, opcoesCookie, sessaoConfigurada } from "@/lib/sessao";
import {
  SENHA_MINIMA,
  buscarUsuario,
  criarUsuario,
  emailValido,
  gerarHash,
  normalizarEmail,
  podeCadastrar,
  senhaConfere,
} from "@/lib/usuarios";

export const dynamic = "force-dynamic";

function voltar(req: NextRequest, erro: string, email: string) {
  const q = new URLSearchParams({ erro });
  if (email) q.set("email", email);
  return NextResponse.redirect(new URL(`/cadastro?${q}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = normalizarEmail(form.get("email"));
  const senha = String(form.get("senha") ?? "");

  if (!sessaoConfigurada()) return voltar(req, "config", email);
  if (!emailValido(email)) return voltar(req, "email", email);
  if (senha.length < SENHA_MINIMA) return voltar(req, "senha", email);
  if (!podeCadastrar(email)) return voltar(req, "nao-autorizado", email);

  let usuario = await criarUsuario(email, await gerarHash(senha));
  if (!usuario) {
    // Conta já existe (ex.: clique duplo no botão). Se a senha confere, só entra.
    const existente = await buscarUsuario(email);
    if (!existente || !(await senhaConfere(senha, existente.senha_hash))) return voltar(req, "existe", email);
    usuario = { id: existente.id, email: existente.email };
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE_SESSAO, await criarSessao(usuario), opcoesCookie);
  return res;
}
