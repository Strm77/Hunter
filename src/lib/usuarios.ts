import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { PASTA, rpc, usaBancoHospedado } from "./db";

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tam: number, op: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export interface Usuario {
  id: string;
  email: string;
  senha_hash: string;
}

export const SENHA_MINIMA = 8;

export function normalizarEmail(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase().slice(0, 200) : "";
}

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Quem pode se cadastrar: lista em HUNTER_EMAILS_PERMITIDOS (separada por vírgula).
 * Sem a lista, o cadastro fica fechado.
 */
export function emailsPermitidos(): string[] {
  return (process.env.HUNTER_EMAILS_PERMITIDOS || "")
    .split(/[,;\s]+/)
    .map(normalizarEmail)
    .filter(Boolean);
}

export function podeCadastrar(email: string) {
  return emailsPermitidos().includes(email);
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(senha, sal, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${sal.toString("base64")}$${h.toString("base64")}`;
}

export async function senhaConfere(senha: string, guardado: string): Promise<boolean> {
  const [alg, N, r, p, salB64, hB64] = guardado.split("$");
  if (alg !== "scrypt" || !salB64 || !hB64) return false;
  const esperado = Buffer.from(hB64, "base64");
  const h = await scrypt(senha, Buffer.from(salB64, "base64"), esperado.length, { N: +N, r: +r, p: +p });
  return h.length === esperado.length && timingSafeEqual(h, esperado);
}

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails têm conta.
let hashFicticio: Promise<string> | null = null;
export function hashParaComparacaoVazia() {
  return (hashFicticio ??= gerarHash(randomBytes(16).toString("hex")));
}

// ----- Armazenamento local (sem banco): data/usuarios.json -----
const ARQUIVO = path.join(PASTA, "usuarios.json");

async function lerLocais(): Promise<Usuario[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function buscarUsuario(email: string): Promise<Usuario | null> {
  if (usaBancoHospedado) return rpc<Usuario | null>("hunter_usuario_buscar", { p_email: email });
  return (await lerLocais()).find((u) => u.email === email) ?? null;
}

/** Cria a conta. Retorna null se o e-mail já existir. */
export async function criarUsuario(email: string, senhaHash: string): Promise<{ id: string; email: string } | null> {
  if (usaBancoHospedado) {
    const id = await rpc<string | null>("hunter_usuario_criar", { p_email: email, p_senha_hash: senhaHash });
    return id ? { id, email } : null;
  }
  const lista = await lerLocais();
  if (lista.some((u) => u.email === email)) return null;
  const novo = { id: randomUUID(), email, senha_hash: senhaHash };
  await fs.mkdir(PASTA, { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify([...lista, novo], null, 2), "utf8");
  return { id: novo.id, email };
}
