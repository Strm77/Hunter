import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  ACOES_ATIVIDADE,
  AcaoAtividade,
  Atividade,
  BancoDeDados,
  Candidatura,
  Colecao,
  Curriculo,
  CurriculoCongelado,
  EVENTOS_AUTOMATICOS,
  EventoHistorico,
  ItemSelecionado,
  MODALIDADES,
  Modalidade,
  ORIGENS_VAGA,
  OrigemVaga,
  Perfil,
  SITUACOES_VAGA,
  STATUS_CANDIDATURA,
  SituacaoVaga,
  StatusCandidatura,
  TIPOS_CANDIDATURA,
  TIPOS_EVENTO,
  Tema,
  TipoCandidatura,
  TipoEvento,
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
  return { versao: 1, perfil: perfilVazio(), candidaturas: [], vagas: [], curriculos: [], temas: [], atividades: [] };
}

function normalizar(dados: Partial<BancoDeDados> | null | undefined): BancoDeDados {
  if (!dados) return bancoVazio();
  const lista = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  // Itens gravados antes de um campo existir ganham o valor padrão, mantendo id e datas.
  const comDatas = (b: Bruto) => ({
    id: texto(b.id, 100) || randomUUID(),
    criadoEm: texto(b.criadoEm, 40),
    atualizadoEm: texto(b.atualizadoEm, 40),
  });
  return {
    versao: 1,
    perfil: sanitizarPerfil(dados.perfil ?? perfilVazio()),
    candidaturas: lista<Bruto>(dados.candidaturas).map((b) => ({
      ...(b as unknown as Candidatura),
      ...sanitizarCandidatura(b),
      historico: sanitizarHistorico(b.historico),
      curriculoEnviado: (b.curriculoEnviado as CurriculoCongelado | null) ?? null,
      ...comDatas(b),
    })),
    vagas: lista<Bruto>(dados.vagas).map((b) => ({ ...sanitizarVaga(b), ...comDatas(b) })),
    curriculos: lista<Curriculo>(dados.curriculos),
    temas: lista<Bruto>(dados.temas).map((b) => ({ ...sanitizarTema(b), ...comDatas(b) })),
    atividades: lista<Bruto>(dados.atividades).slice(-LIMITE_ATIVIDADES).map(sanitizarAtividade),
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

function sanitizarCandidatura(
  b: Bruto,
): Omit<Candidatura, "id" | "criadoEm" | "atualizadoEm" | "historico" | "curriculoEnviado"> {
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

function opcao<T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T {
  return opcoes.includes(v as T) ? (v as T) : padrao;
}

/** Lista de termos: aceita array ou texto separado por vírgula/linha; sem repetidos nem vazios. */
function termos(v: unknown): string[] {
  const brutos = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\n]/) : [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const t of brutos) {
    const limpo = texto(t, 100).trim();
    if (!limpo || vistos.has(limpo.toLowerCase())) continue;
    vistos.add(limpo.toLowerCase());
    saida.push(limpo);
    if (saida.length >= 50) break;
  }
  return saida;
}

/** Código numérico da vaga no LinkedIn (…/jobs/view/1234567890 ou ?currentJobId=1234567890). */
export function codigoLinkedin(link: string): string {
  if (!link) return "";
  try {
    const url = new URL(link);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return "";
    const doCaminho = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})\/?/);
    if (doCaminho) return doCaminho[1];
    const daBusca = url.searchParams.get("currentJobId");
    return daBusca && /^\d{6,}$/.test(daBusca) ? daBusca : "";
  } catch {
    return "";
  }
}

function sanitizarVaga(b: Bruto): Omit<Vaga, "id" | "criadoEm" | "atualizadoEm"> {
  const link = linkSeguro(b.link);
  return {
    titulo: texto(b.titulo, 200).trim(),
    empresa: texto(b.empresa, 200).trim(),
    link,
    codigoLinkedin: codigoLinkedin(link),
    salvaEm: data(b.salvaEm) || hoje(),
    notas: texto(b.notas),
    temaId: texto(b.temaId, 100),
    descricao: texto(b.descricao, 30000),
    local: texto(b.local, 200).trim(),
    modalidade: opcao<Modalidade | "">(b.modalidade, MODALIDADES, ""),
    origem: opcao<OrigemVaga>(b.origem, ORIGENS_VAGA, "Colada manualmente"),
    tipoCandidatura: opcao<TipoCandidatura>(b.tipoCandidatura, TIPOS_CANDIDATURA, "Não sei"),
    situacao: opcao<SituacaoVaga>(b.situacao, SITUACOES_VAGA, "Nova"),
  };
}

function sanitizarTema(b: Bruto): Omit<Tema, "id" | "criadoEm" | "atualizadoEm"> {
  return {
    nome: texto(b.nome, 100).trim(),
    palavrasChave: termos(b.palavrasChave),
    excluir: termos(b.excluir),
    local: texto(b.local, 200).trim(),
    modalidade: opcao<Modalidade | "">(b.modalidade, MODALIDADES, ""),
    senioridade: texto(b.senioridade, 100).trim(),
    ativo: b.ativo === undefined ? true : Boolean(b.ativo),
  };
}

// ---------- Registro de atividades (rastro para a linha do tempo) ----------

const LIMITE_ATIVIDADES = 5000;

function sanitizarAtividade(b: Bruto): Atividade {
  return {
    id: texto(b.id, 100) || randomUUID(),
    data: data(b.data) || hoje(),
    registradoEm: texto(b.registradoEm, 40),
    acao: opcao<AcaoAtividade>(b.acao, ACOES_ATIVIDADE, "Vaga alterada"),
    descricao: texto(b.descricao, 2000),
    link: linkSeguro(b.link),
    itemId: texto(b.itemId, 100),
    autor: texto(b.autor, 200),
  };
}

function registrar(
  dados: BancoDeDados,
  acao: AcaoAtividade,
  descricao: string,
  extra: { link?: string; itemId?: string; autor?: string } = {},
) {
  dados.atividades.push(
    sanitizarAtividade({
      acao,
      descricao,
      link: extra.link ?? "",
      itemId: extra.itemId ?? "",
      autor: extra.autor ?? "",
      registradoEm: new Date().toISOString(),
    }),
  );
  if (dados.atividades.length > LIMITE_ATIVIDADES) dados.atividades.splice(0, dados.atividades.length - LIMITE_ATIVIDADES);
}

const rotuloVaga = (v: { titulo: string; empresa: string }) => `${v.titulo || "Sem título"} · ${v.empresa || "empresa não informada"}`;

/** Descreve em texto o que mudou nos dados principais da candidatura (empresa, cargo, data, vaga, currículo). */
function descreverAlteracoes(anterior: Candidatura, limpo: Bruto, dados: BancoDeDados): string[] {
  const nomeVaga = (id: string) => {
    const v = dados.vagas.find((x) => x.id === id);
    return v ? rotuloVaga(v) : "nenhuma";
  };
  const nomeCv = (id: string) => dados.curriculos.find((x) => x.id === id)?.nome ?? (id ? "versão removida" : "nenhum");
  const mudancas: string[] = [];
  const campo = (rotulo: string, de: string, para: string) => {
    if (de !== para) mudancas.push(`${rotulo}: “${de || "vazio"}” → “${para || "vazio"}”`);
  };
  campo("Empresa", anterior.empresa, String(limpo.empresa));
  campo("Cargo", anterior.cargo, String(limpo.cargo));
  if (anterior.data !== limpo.data)
    campo("Data da candidatura", formatarDataBR(anterior.data), formatarDataBR(String(limpo.data)));
  if (anterior.vagaId !== limpo.vagaId) campo("Vaga", nomeVaga(anterior.vagaId), nomeVaga(String(limpo.vagaId)));
  if (anterior.curriculoId !== limpo.curriculoId)
    campo("Currículo", nomeCv(anterior.curriculoId), nomeCv(String(limpo.curriculoId)));
  return mudancas;
}

function formatarDataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

function sanitizarEvento(b: Bruto, autor: string): EventoHistorico {
  return {
    id: texto(b.id, 100) || randomUUID(),
    data: data(b.data) || hoje(),
    tipo: opcao<TipoEvento>(b.tipo, TIPOS_EVENTO, "Nota"),
    de: texto(b.de, 50),
    para: texto(b.para, 50),
    descricao: texto(b.descricao, 2000).trim(),
    autor: texto(b.autor, 200) || autor,
    registradoEm: texto(b.registradoEm, 40) || new Date().toISOString(),
  };
}

function sanitizarHistorico(v: unknown): EventoHistorico[] {
  return (Array.isArray(v) ? (v as Bruto[]) : []).slice(0, 500).map((e) => sanitizarEvento(e ?? {}, ""));
}

/** Congela a versão do currículo com só os itens do perfil que ela usa. */
function congelarCurriculo(curriculo: Curriculo, perfil: Perfil): CurriculoCongelado {
  const usados = (sel: ItemSelecionado[]) => new Set(sel.map((s) => s.refId));
  const filtrar = <T extends { id: string }>(lista: T[], sel: ItemSelecionado[]) => {
    const ids = usados(sel);
    return lista.filter((x) => ids.has(x.id));
  };
  return {
    curriculoId: curriculo.id,
    congeladoEm: new Date().toISOString(),
    perfil: JSON.parse(
      JSON.stringify({
        ...perfil,
        resumo: curriculo.incluirResumo ? perfil.resumo : "",
        experiencias: filtrar(perfil.experiencias, curriculo.experiencias),
        formacoes: filtrar(perfil.formacoes, curriculo.formacoes),
        certificacoes: filtrar(perfil.certificacoes, curriculo.certificacoes),
        habilidades: filtrar(perfil.habilidades, curriculo.habilidades),
      }),
    ),
    curriculo: JSON.parse(JSON.stringify(curriculo)),
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

export const COLECOES: Colecao[] = ["candidaturas", "vagas", "curriculos", "temas"];

export function ehColecao(v: string): v is Colecao {
  return (COLECOES as string[]).includes(v);
}

export class ErroValidacao extends Error {}

function validar(colecao: Colecao, item: Bruto, dados: BancoDeDados, itemId?: string) {
  if (colecao === "candidaturas" && (!item.empresa || !item.cargo))
    throw new ErroValidacao("Informe empresa e cargo.");
  if (colecao === "vagas") {
    if (!item.titulo || !item.empresa) throw new ErroValidacao("Informe título e empresa.");
    const igual = dados.vagas.find(
      (v) =>
        v.id !== itemId &&
        ((item.codigoLinkedin && v.codigoLinkedin === item.codigoLinkedin) || (item.link && v.link === item.link)),
    );
    if (igual) throw new ErroValidacao(`Essa vaga já está no histórico: “${igual.titulo}” (${igual.empresa}).`);
  }
  if (colecao === "curriculos" && !item.nome) throw new ErroValidacao("Dê um nome à versão.");
  if (colecao === "temas") {
    if (!item.nome) throw new ErroValidacao("Dê um nome ao tema.");
    const nome = String(item.nome).toLowerCase();
    if (dados.temas.some((t) => t.id !== itemId && t.nome.toLowerCase() === nome))
      throw new ErroValidacao("Já existe um tema com esse nome.");
  }
}

function sanitizar(colecao: Colecao, b: Bruto, dados: BancoDeDados) {
  switch (colecao) {
    case "candidaturas":
      return sanitizarCandidatura(b);
    case "vagas":
      return sanitizarVaga(b);
    case "curriculos":
      return sanitizarCurriculo(b, dados.perfil);
    case "temas":
      return sanitizarTema(b);
  }
}

/**
 * Regras próprias da candidatura, aplicadas no servidor:
 * - o histórico nunca vem pronto do navegador; só se acrescenta (novoEvento) ou remove (removerEventoId) um evento;
 * - mudança de status vira evento automático;
 * - ao vincular uma versão de currículo, ela é congelada (curriculoEnviado).
 */
function aplicarRegrasCandidatura(
  limpo: Bruto,
  corpo: Bruto,
  anterior: Candidatura | null,
  dados: BancoDeDados,
  autor: string,
) {
  const historico = anterior ? [...sanitizarHistorico(anterior.historico)] : [];
  const statusNovo = String(limpo.status);
  if (!anterior) {
    historico.push(
      sanitizarEvento(
        { tipo: "Status", data: limpo.data, para: statusNovo, descricao: "Candidatura registrada." },
        autor,
      ),
    );
  } else {
    if (anterior.status !== statusNovo)
      historico.push(sanitizarEvento({ tipo: "Status", de: anterior.status, para: statusNovo }, autor));
    const mudancas = descreverAlteracoes(anterior, limpo, dados);
    if (mudancas.length)
      historico.push(sanitizarEvento({ tipo: "Alteração", descricao: mudancas.join("\n") }, autor));
  }
  const novo = corpo.novoEvento as Bruto | undefined;
  if (novo && typeof novo === "object") {
    const evento = sanitizarEvento({ ...novo, id: "", autor: "", registradoEm: "", de: "", para: "" }, autor);
    if (EVENTOS_AUTOMATICOS.includes(evento.tipo)) evento.tipo = "Nota";
    if (!evento.descricao) throw new ErroValidacao("Descreva o que aconteceu.");
    historico.push(evento);
  }
  // Só registros feitos à mão podem sair; status, envio e alterações ficam para sempre.
  // A remoção em si fica no registro de atividades, com o texto do que foi removido.
  const removerId = texto(corpo.removerEventoId, 100);
  const alvo = removerId ? historico.find((e) => e.id === removerId) : undefined;
  if (alvo && EVENTOS_AUTOMATICOS.includes(alvo.tipo))
    throw new ErroValidacao("Esse registro é automático e não pode ser removido.");
  if (alvo && anterior)
    registrar(
      dados,
      "Registro removido",
      `${alvo.tipo} de ${formatarDataBR(alvo.data)} em “${anterior.cargo} · ${anterior.empresa}”: ${alvo.descricao}`,
      { itemId: anterior.id, autor },
    );
  const final = alvo ? historico.filter((e) => e.id !== alvo.id) : historico;
  final.sort((a, b) => a.data.localeCompare(b.data) || a.registradoEm.localeCompare(b.registradoEm));

  let curriculoEnviado = anterior?.curriculoEnviado ?? null;
  const cvId = String(limpo.curriculoId || "");
  if (!cvId) curriculoEnviado = null;
  else if (!curriculoEnviado || curriculoEnviado.curriculoId !== cvId) {
    const cv = dados.curriculos.find((c) => c.id === cvId);
    curriculoEnviado = cv ? congelarCurriculo(cv, dados.perfil) : null;
  }
  return { ...limpo, historico: final, curriculoEnviado };
}

export async function criarItem(colecao: Colecao, corpo: Bruto, autor = "") {
  return alterarBanco((dados) => {
    let limpo = sanitizar(colecao, corpo, dados) as Bruto;
    validar(colecao, limpo, dados);
    if (colecao === "candidaturas") limpo = aplicarRegrasCandidatura(limpo, corpo, null, dados, autor);
    const agora = new Date().toISOString();
    const novo = { id: randomUUID(), ...limpo, criadoEm: agora, atualizadoEm: agora };
    (dados[colecao] as unknown as Bruto[]).push(novo);
    if (colecao === "vagas") {
      const v = novo as unknown as Vaga;
      registrar(dados, "Vaga salva", `${rotuloVaga(v)} (situação: ${v.situacao})`, { link: v.link, itemId: v.id, autor });
    }
    if (colecao === "curriculos")
      registrar(dados, "Currículo criado", String(limpo.nome), { itemId: novo.id, autor });
    return novo;
  });
}

export async function atualizarItem(colecao: Colecao, itemId: string, corpo: Bruto, autor = "") {
  return alterarBanco((dados) => {
    const lista = dados[colecao] as unknown as Bruto[];
    const i = lista.findIndex((x) => x.id === itemId);
    if (i < 0) return null;
    let limpo = sanitizar(colecao, { ...lista[i], ...corpo }, dados) as Bruto;
    validar(colecao, limpo, dados, itemId);
    if (colecao === "candidaturas")
      limpo = aplicarRegrasCandidatura(limpo, corpo, lista[i] as unknown as Candidatura, dados, autor);
    if (colecao === "vagas") {
      const antes = lista[i] as unknown as Vaga;
      const depois = limpo as unknown as Vaga;
      const m: string[] = [];
      if (antes.situacao !== depois.situacao) m.push(`situação: ${antes.situacao} → ${depois.situacao}`);
      if (antes.titulo !== depois.titulo || antes.empresa !== depois.empresa) m.push(`antes: ${rotuloVaga(antes)}`);
      if (antes.link !== depois.link) m.push("link alterado");
      if (m.length)
        registrar(dados, "Vaga alterada", `${rotuloVaga(depois)} (${m.join("; ")})`, {
          link: depois.link,
          itemId: itemId,
          autor,
        });
    }
    lista[i] = {
      ...limpo,
      id: itemId,
      criadoEm: lista[i].criadoEm,
      atualizadoEm: new Date().toISOString(),
    };
    return lista[i];
  });
}

export async function removerItem(colecao: Colecao, itemId: string, autor = "") {
  return alterarBanco((dados) => {
    const lista = dados[colecao] as unknown as Bruto[];
    const item = lista.find((x) => x.id === itemId);
    if (item && colecao === "vagas") {
      const v = item as unknown as Vaga;
      registrar(dados, "Vaga removida", rotuloVaga(v), { link: v.link, itemId, autor });
    }
    if (item && colecao === "candidaturas") {
      // Guarda o resumo e o histórico em texto: a candidatura some, o rastro fica.
      const c = item as unknown as Candidatura;
      const vaga = dados.vagas.find((v) => v.id === c.vagaId);
      const passos = (c.historico ?? [])
        .map((e) => `${formatarDataBR(e.data)} ${e.tipo}${e.para ? ` (${e.para})` : ""}${e.descricao ? `: ${e.descricao}` : ""}`)
        .join("\n");
      registrar(
        dados,
        "Candidatura removida",
        `${c.cargo} · ${c.empresa}, candidatura de ${formatarDataBR(c.data)}, último status ${c.status}.${passos ? `\nHistórico:\n${passos}` : ""}`,
        { link: vaga?.link ?? "", itemId, autor },
      );
    }
    if (item && colecao === "curriculos")
      registrar(dados, "Currículo removido", String((item as unknown as Curriculo).nome), { itemId, autor });
    const antes = lista.length;
    (dados as unknown as Record<Colecao, Bruto[]>)[colecao] = lista.filter((x) => x.id !== itemId);
    const removido = antes !== (dados[colecao] as unknown[]).length;
    if (removido) {
      // Desfaz vínculos para não deixar referências quebradas.
      if (colecao === "vagas") {
        dados.candidaturas.forEach((c) => c.vagaId === itemId && (c.vagaId = ""));
        dados.curriculos.forEach((c) => c.vagaId === itemId && (c.vagaId = ""));
      }
      // A candidatura guarda a cópia congelada; perder a versão viva não apaga o registro do que foi enviado.
      if (colecao === "curriculos") {
        dados.candidaturas.forEach((c) => c.curriculoId === itemId && (c.curriculoId = ""));
      }
      if (colecao === "temas") {
        dados.vagas.forEach((v) => v.temaId === itemId && (v.temaId = ""));
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

/**
 * "Marcar como enviada": a titular enviou a candidatura pelo site da vaga e registra aqui.
 * Cria a candidatura ligada à vaga e à versão do currículo (que fica congelada) e marca a vaga como Candidatada.
 */
export async function marcarComoEnviada(corpo: Bruto, autor: string) {
  return alterarBanco((dados) => {
    const vaga = dados.vagas.find((v) => v.id === texto(corpo.vagaId, 100));
    if (!vaga) throw new ErroValidacao("Vaga não encontrada.");
    if (dados.candidaturas.some((c) => c.vagaId === vaga.id))
      throw new ErroValidacao("Essa vaga já tem candidatura registrada. Atualize por lá.");
    const curriculoId = texto(corpo.curriculoId, 100);
    const cv = curriculoId ? dados.curriculos.find((c) => c.id === curriculoId) : undefined;
    if (curriculoId && !cv) throw new ErroValidacao("Versão de currículo não encontrada.");
    const dataEnvio = data(corpo.data) || hoje();

    let limpo = sanitizarCandidatura({
      empresa: vaga.empresa,
      cargo: vaga.titulo,
      data: dataEnvio,
      status: "Candidatada",
      proximaAcao: corpo.proximaAcao,
      observacoes: corpo.observacoes,
      vagaId: vaga.id,
      curriculoId: cv?.id ?? "",
    }) as unknown as Bruto;
    validar("candidaturas", limpo, dados);
    limpo = aplicarRegrasCandidatura(limpo, {}, null, dados, autor);
    (limpo.historico as EventoHistorico[]).push(
      sanitizarEvento(
        {
          tipo: "Envio",
          data: dataEnvio,
          descricao: cv ? `Enviada com o currículo “${cv.nome}”.` : "Enviada (versão do currículo não informada).",
        },
        autor,
      ),
    );
    const agora = new Date().toISOString();
    const nova = { id: randomUUID(), ...limpo, criadoEm: agora, atualizadoEm: agora } as unknown as Candidatura;
    dados.candidaturas.push(nova);
    vaga.situacao = "Candidatada";
    vaga.atualizadoEm = agora;
    if (cv && !cv.enviadaEm) {
      cv.enviadaEm = dataEnvio;
      cv.atualizadoEm = agora;
    }
    return nova;
  });
}
