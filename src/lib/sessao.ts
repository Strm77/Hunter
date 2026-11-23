/**
 * Trava de acesso da V1: um código único (HUNTER_ACCESS_CODE) compartilhado por Brunno e Carol.
 * O cookie guarda um HMAC derivado do código, nunca o código em si.
 * Funciona no runtime Edge (middleware) e no Node (rotas), via Web Crypto.
 */
export const COOKIE_SESSAO = "hunter_sessao";
export const DURACAO_SESSAO_S = 60 * 60 * 24 * 30; // 30 dias

export function codigoConfigurado(): string | null {
  const c = process.env.HUNTER_ACCESS_CODE?.trim();
  return c && c.length >= 8 ? c : null;
}

export async function tokenDaSessao(codigo: string): Promise<string> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey("raw", enc.encode(codigo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, enc.encode("hunter-sessao-v1"));
  return Array.from(new Uint8Array(assinatura), (b) => b.toString(16).padStart(2, "0")).join("");
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
