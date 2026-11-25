import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  BancoDeDados,
  Candidatura,
  Colecao,
  Curriculo,
  ItemSelecionado,
  Perfil,
  STATUS_CANDIDATURA,
  StatusCandidatura,
  Vaga,
  perfilVazio,
} from "./types";

/**
 * Persistência. Dois modos, escolhidos pelas variáveis de ambiente:
 *
 * - Banco hospedado (Supabase): quando HUNTER_SUPABASE_URL, HUNTER_SUPABASE_KEY e HUNTER_DB_TOKEN
 *   estão definidas. Os dados ficam num único documento JSON no banco, acessado só pelas funções
 *   hunter_ler/hunter_gravar (veja supabase/migrations), que exigem o token secreto do servidor.
 *   Cada gravação confere a versão do documento, para que duas pessoas salvando ao mesmo tempo
 *   não apaguem a alteração uma da outra.
 * - Arquivo local: sem essas variáveis, usa data/hunter.json (pasta configurável por HUNTER_DATA_DIR).
 *   Serve para rodar no próprio computador; não persiste num deploy da Vercel.
 */
const SUPABASE_URL = process.env.HUNTER_SUPABASE_URL?.replace(/\/+$/, "");
const SUPABASE_KEY = process.env.HUNTER_SUPABASE_KEY;
const DB_TOKEN = process.env.HUNTER_DB_TOKEN;
export const usaBancoHospedado = Boolean(SUPABASE_URL && SUPABASE_KEY && DB_TOKEN);

export const PASTA = process.env.HUNTER_DATA_DIR || path.join(process.cwd(), "data");
const ARQUIVO = path.join(PASTA, "hunter.json");

function bancoVazio(): BancoDeDados {
  return { versao: 1, perfil: perfilVazio(), candidaturas: [], vagas: [], curriculos: [] };
}

function normalizar(dados: Partial<BancoDeDados> | null | undefined): BancoDeDados {
  if (!dados) return bancoVazio();
  return {
    versao: 1,
    perfil: sanitizarPerfil(dados.perfil ?? perfilVazio()),
    candidaturas: Array.isArray(dados.candidaturas) ? dados.candidaturas : [],
    vagas: Array.isArray(dados.vagas) ? dados.vagas : [],
    curriculos: Array.isArray(dados.curriculos) ? dados.curriculos : [],
  };
}

// ----- Banco hospedado -----

export async function rpc<T>(funcao: string, corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: DB_TOKEN, ...corpo }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Falha ao acessar o banco de dados (${r.status}).`);
  return (await r.json()) as T;
}

async function lerRemoto(): Promise<{ dados: BancoDeDados; versao: number }> {
  const r = await rpc<{ dados: Partial<BancoDeDados> | null; versao: number }>("hunter_ler", {});
  return { dados: normalizar(r.dados), versao: Number(r.versao) || 0 };
}

// ----- Arquivo local -----

async function lerArquivo(): Promise<BancoDeDados> {
  try {
    return normalizar(JSON.parse(await fs.readFile(ARQUIVO, "utf8")));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return bancoVazio();
    throw erro;
  }
}

async function gravarArquivo(dados: BancoDeDados) {
  await fs.mkdir(PASTA, { recursive: true });
  const temp = `${ARQUIVO}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(temp, ARQUIVO);
}

// ----- Interface usada pelas rotas -----

export async function lerBanco(): Promise<BancoDeDados> {
  return usaBancoHospedado ? (await lerRemoto()).dados : lerArquivo();
}

// Fila simples para serializar escritas dentro do mesmo processo.
let fila: Promise<unknown> = Promise.resolve();

export function alterarBanco<T>(fn: (dados: BancoDeDados) => T | Promise<T>): Promise<T> {
  const tarefa = fila.then(async () => {
    if (!usaBancoHospedado) {
      const dados = await lerArquivo();
      const resultado = await fn(dados);
      await gravarArquivo(dados);
      return resultado;
    }
    // Banco hospedado: lê, aplica e grava só se ninguém gravou no meio; senão, tenta de novo.
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { dados, versao } = await lerRemoto();
      const resultado = await fn(dados);
      const nova = await rpc<number>("hunter_gravar", { p_dados: dados, p_versao: versao });
      if (Number(nova) > 0) return resultado;
    }
    throw new Error("Outra alteração foi salva ao mesmo tempo. Tente de novo.");
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}

// ---------- Sanitização ----------

type Bruto = Record<string, unknown>;

function texto(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function data(v: unknown): string {
  const s = texto(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** Só aceita links http(s); qualquer outra coisa vira string vazia. */
export function linkSeguro(v: unknown): string {
  const s = texto(v, 2000).trim();
  if (!s) return "";
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function id(v: unknown) {
  const s = texto(v, 100);
  return s || randomUUID();
}

function sanitizarCandidatura(b: Bruto): Omit<Candidatura, "id" | "criadoEm" | "atualizadoEm"> {
  const status = STATUS_CANDIDATURA.includes(b.status as StatusCandidatura)
    ? (b.status as StatusCandidatura)
    : "Candidatada";
  return {
    empresa: texto(b.empresa, 200).trim(),
    cargo: texto(b.cargo, 200).trim(),
    data: data(b.data) || hoje(),
    status,
    proximaAcao: texto(b.proximaAcao, 500),
    observacoes: texto(b.observacoes),
    vagaId: texto(b.vagaId, 100),
    curriculoId: texto(b.curriculoId, 100),
  };
}

function sanitizarVaga(b: Bruto): Omit<Vaga, "id" | "criadoEm" | "atualizadoEm"> {
  return {
    titulo: texto(b.titulo, 200).trim(),
    empresa: texto(b.empresa, 200).trim(),
    link: linkSeguro(b.link),
    salvaEm: data(b.salvaEm) || hoje(),
    notas: texto(b.notas),
  };
}

function itens(v: unknown, idsValidos: Set<string>): ItemSelecionado[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>();
  const saida: ItemSelecionado[] = [];
  for (const item of v as Bruto[]) {
    const refId = texto(item?.refId, 100);
    // Só referências a itens que existem no currículo-base são aceitas.
    if (!idsValidos.has(refId) || vistos.has(refId)) continue;
    vistos.add(refId);
    saida.push({ refId, destaque: Boolean(item?.destaque) });
  }
  return saida;
}

function sanitizarCurriculo(
  b: Bruto,
  perfil: Perfil,
): Omit<Curriculo, "id" | "criadoEm" | "atualizadoEm"> {
  const ids = (lista: { id: string }[]) => new Set(lista.map((x) => x.id));
  return {
    nome: texto(b.nome, 200).trim(),
    vagaId: texto(b.vagaId, 100),
    incluirResumo: b.incluirResumo === undefined ? true : Boolean(b.incluirResumo),
    experiencias: itens(b.experiencias, ids(perfil.experiencias)),
    formacoes: itens(b.formacoes, ids(perfil.formacoes)),
    certificacoes: itens(b.certificacoes, ids(perfil.certificacoes)),
    habilidades: itens(b.habilidades, ids(perfil.habilidades)),
    enviadaEm: data(b.enviadaEm),
    observacoes: texto(b.observacoes),
  };
}

export function sanitizarPerfil(b: unknown): Perfil {
  const p = (b ?? {}) as Bruto;
  const pes = (p.pessoais ?? {}) as Bruto;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Bruto[]) : []);
  return {
    pessoais: {
      nome: texto(pes.nome, 200),
      titulo: texto(pes.titulo, 200),
      email: texto(pes.email, 200),
      telefone: texto(pes.telefone, 50),
      cidade: texto(pes.cidade, 200),
      linkedin: linkSeguro(pes.linkedin),
      portfolio: linkSeguro(pes.portfolio),
    },
    resumo: texto(p.resumo),
    experiencias: lista(p.experiencias).map((e) => ({
      id: id(e.id),
      cargo: texto(e.cargo, 200),
      empresa: texto(e.empresa, 200),
      local: texto(e.local, 200),
      inicio: texto(e.inicio, 7),
      fim: texto(e.fim, 7),
      atual: Boolean(e.atual),
      descricao: texto(e.descricao),
    })),
    formacoes: lista(p.formacoes).map((f) => ({
      id: id(f.id),
      curso: texto(f.curso, 200),
      instituicao: texto(f.instituicao, 200),
      inicio: texto(f.inicio, 7),
      fim: texto(f.fim, 7),
      observacao: texto(f.observacao, 500),
    })),
    certificacoes: lista(p.certificacoes).map((c) => ({
      id: id(c.id),
      nome: texto(c.nome, 200),
      emissor: texto(c.emissor, 200),
      data: texto(c.data, 7),
      link: linkSeguro(c.link),
    })),
    habilidades: lista(p.habilidades)
      .map((h) => ({ id: id(h.id), nome: texto(h.nome, 100).trim() }))
      .filter((h) => h.nome),
    atualizadoEm: texto(p.atualizadoEm, 40),
  };
}

export const COLECOES: Colecao[] = ["candidaturas", "vagas", "curriculos"];

export function ehColecao(v: string): v is Colecao {
  return (COLECOES as string[]).includes(v);
}

export class ErroValidacao extends Error {}

function validar(colecao: Colecao, item: Bruto) {
  if (colecao === "candidaturas" && (!item.empresa || !item.cargo))
    throw new ErroValidacao("Informe empresa e cargo.");
  if (colecao === "vagas" && (!item.titulo || !item.empresa))
    throw new ErroValidacao("Informe título e empresa.");
  if (colecao === "curriculos" && !item.nome) throw new ErroValidacao("Dê um nome à versão.");
}

function sanitizar(colecao: Colecao, b: Bruto, dados: BancoDeDados) {
  switch (colecao) {
    case "candidaturas":
      return sanitizarCandidatura(b);
    case "vagas":
      return sanitizarVaga(b);
    case "curriculos":
      return sanitizarCurriculo(b, dados.perfil);
  }
}

export async function criarItem(colecao: Colecao, corpo: Bruto) {
  return alterarBanco((dados) => {
    const limpo = sanitizar(colecao, corpo, dados) as Bruto;
    validar(colecao, limpo);
    const agora = new Date().toISOString();
    const novo = { id: randomUUID(), ...limpo, criadoEm: agora, atualizadoEm: agora };
    (dados[colecao] as unknown as Bruto[]).push(novo);
    return novo;
  });
}

export async function atualizarItem(colecao: Colecao, itemId: string, corpo: Bruto) {
  return alterarBanco((dados) => {
    const lista = dados[colecao] as unknown as Bruto[];
    const i = lista.findIndex((x) => x.id === itemId);
    if (i < 0) return null;
    const limpo = sanitizar(colecao, { ...lista[i], ...corpo }, dados) as Bruto;
    validar(colecao, limpo);
    lista[i] = {
      ...limpo,
      id: itemId,
      criadoEm: lista[i].criadoEm,
      atualizadoEm: new Date().toISOString(),
    };
    return lista[i];
  });
}

export async function removerItem(colecao: Colecao, itemId: string) {
  return alterarBanco((dados) => {
    const lista = dados[colecao] as unknown as Bruto[];
    const antes = lista.length;
    (dados as unknown as Record<Colecao, Bruto[]>)[colecao] = lista.filter((x) => x.id !== itemId);
    const removido = antes !== (dados[colecao] as unknown[]).length;
    if (removido) {
      // Desfaz vínculos para não deixar referências quebradas.
      if (colecao === "vagas") {
        dados.candidaturas.forEach((c) => c.vagaId === itemId && (c.vagaId = ""));
        dados.curriculos.forEach((c) => c.vagaId === itemId && (c.vagaId = ""));
      }
      if (colecao === "curriculos") {
        dados.candidaturas.forEach((c) => c.curriculoId === itemId && (c.curriculoId = ""));
      }
    }
    return removido;
  });
}

export async function salvarPerfil(corpo: unknown) {
  return alterarBanco((dados) => {
    const perfil = sanitizarPerfil(corpo);
    perfil.atualizadoEm = new Date().toISOString();
    dados.perfil = perfil;
    // Remove das variantes referências a itens que deixaram de existir no currículo-base.
    dados.curriculos = dados.curriculos.map((c) => ({
      ...c,
      ...sanitizarCurriculo(c as unknown as Bruto, perfil),
    }));
    return perfil;
  });
}
