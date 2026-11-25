/**
 * Sessão de login (e-mail e senha).
 * O cookie leva { id, email, expira } assinado com HMAC-SHA256. A chave vem de HUNTER_SESSION_SECRET
 * ou, se ela não existir, é derivada de HUNTER_DB_TOKEN. Sem nenhuma das duas, ninguém entra (falha fechada).
 * Funciona no runtime Edge (middleware) e no Node (rotas), via Web Crypto.
 */
export const COOKIE_SESSAO = "hunter_sessao";
export const DURACAO_SESSAO_S = 60 * 60 * 24 * 30; // 30 dias

export interface Sessao {
  id: string;
  email: string;
  expira: number; // segundos desde 1970
}

function segredoBase(): string | null {
  const s = process.env.HUNTER_SESSION_SECRET?.trim() || process.env.HUNTER_DB_TOKEN?.trim();
  return s && s.length >= 16 ? s : null;
}

export function sessaoConfigurada() {
  return Boolean(segredoBase());
}

const enc = new TextEncoder();

async function hmac(chave: string, mensagem: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", k, enc.encode(mensagem));
  return paraBase64Url(new Uint8Array(assinatura));
}

function paraBase64Url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

export async function criarSessao(usuario: { id: string; email: string }, agoraMs = Date.now()): Promise<string> {
  const base = segredoBase();
  if (!base) throw new Error("Sessão não configurada.");
  const dados: Sessao = { id: usuario.id, email: usuario.email, expira: Math.floor(agoraMs / 1000) + DURACAO_SESSAO_S };
  const corpo = paraBase64Url(enc.encode(JSON.stringify(dados)));
  return `${corpo}.${await hmac(`hunter-sessao-v3:${base}`, corpo)}`;
}

/** Confere assinatura e validade no servidor. Retorna a sessão ou null. */
export async function lerSessao(valor: string | undefined, agoraMs = Date.now()): Promise<Sessao | null> {
  const base = segredoBase();
  if (!base || !valor) return null;
  const [corpo, assinatura = ""] = valor.split(".");
  if (!corpo || !iguais(assinatura, await hmac(`hunter-sessao-v3:${base}`, corpo))) return null;
  try {
    const s = JSON.parse(deBase64Url(corpo)) as Sessao;
    if (typeof s.id !== "string" || typeof s.email !== "string" || !(s.expira * 1000 > agoraMs)) return null;
    return s;
  } catch {
    return null;
  }
}

/** Comparação em tempo constante para strings do mesmo tamanho. */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function destinoSeguro(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export const opcoesCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACAO_SESSAO_S,
};
