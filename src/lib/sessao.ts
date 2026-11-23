/**
 * Trava de acesso da V1: um código único (HUNTER_ACCESS_CODE) compartilhado por Brunno e Carol.
 * O cookie guarda a data de expiração assinada com HMAC-SHA256 (chave = código), nunca o código em si.
 * Funciona no runtime Edge (middleware) e no Node (rotas), via Web Crypto.
 */
export const COOKIE_SESSAO = "hunter_sessao";
export const DURACAO_SESSAO_S = 60 * 60 * 24 * 30; // 30 dias

export function codigoConfigurado(): string | null {
  const c = process.env.HUNTER_ACCESS_CODE?.trim();
  return c && c.length >= 8 ? c : null;
}

async function hmac(codigo: string, mensagem: string): Promise<string> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey("raw", enc.encode(codigo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, enc.encode(mensagem));
  return Array.from(new Uint8Array(assinatura), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cria o valor do cookie: "<expira-em-segundos>.<HMAC-SHA256(código, expiração)>". */
export async function criarSessao(codigo: string, agoraMs = Date.now()): Promise<string> {
  const expira = Math.floor(agoraMs / 1000) + DURACAO_SESSAO_S;
  return `${expira}.${await hmac(codigo, `hunter-sessao-v2:${expira}`)}`;
}

/** Valida assinatura e expiração no servidor. Qualquer alteração no cookie invalida a assinatura. */
export async function sessaoValida(codigo: string, valor: string, agoraMs = Date.now()): Promise<boolean> {
  const [expiraTxt, assinatura = ""] = valor.split(".");
  const expira = Number(expiraTxt);
  if (!/^\d+$/.test(expiraTxt ?? "") || expira * 1000 <= agoraMs) return false;
  return iguais(assinatura, await hmac(codigo, `hunter-sessao-v2:${expira}`));
}

/** Usado só para comparar a tentativa de código com o código certo sem vazar tempo. */
export async function resumoDoCodigo(codigo: string): Promise<string> {
  return hmac(codigo, "hunter-comparacao");
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
