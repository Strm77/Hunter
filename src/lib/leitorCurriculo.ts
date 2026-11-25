/**
 * Lê o texto posicionado de um PDF de currículo e separa nos campos do perfil.
 *
 * Funciona sem IA: usa posição, tamanho e fonte de cada trecho de texto para achar colunas,
 * títulos de seção (SOBRE MIM, EXPERIÊNCIAS, FORMAÇÃO...) e os itens de cada seção.
 * Nada é inventado: cada campo recebe só texto que está no PDF. O resultado é um rascunho
 * que a pessoa revisa antes de salvar.
 */
import type { Certificacao, Experiencia, Formacao, Habilidade, Perfil } from "./types";
import { perfilVazio } from "./types";

export interface TrechoPdf {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fonte: string;
}

export interface PaginaPdf {
  largura: number;
  trechos: TrechoPdf[];
  links: string[];
}

export interface ResultadoLeitura {
  perfil: Perfil;
  avisos: string[];
}

type Secao = "resumo" | "contato" | "experiencias" | "formacoes" | "certificacoes" | "habilidades" | "outro";

interface Linha {
  texto: string;
  x: number;
  xFim: number;
  y: number;
  tam: number;
  fontes: string[];
  pagina: number;
  col: number;
  secao?: Secao;
  bloco?: number;
  base?: string;
  titulo?: boolean;
}

// ---------- utilidades de texto ----------

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) =>
  semAcento(s)
    .toLowerCase()
    .replace(/[:•|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const maiusculas = (s: string) => /\p{L}/u.test(s) && s === s.toUpperCase();
const espacos = (s: string) => s.replace(/\s+/g, " ").trim();

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function nomeProprio(s: string) {
  if (!maiusculas(s)) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

let contador = 0;
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `imp-${Date.now()}-${contador++}`;

// ---------- títulos de seção ----------

const TITULOS: [Secao, string[]][] = [
  ["resumo", ["sobre mim", "resumo", "resumo profissional", "perfil", "perfil profissional", "objetivo", "objetivo profissional", "apresentacao", "summary", "about me", "profile"]],
  ["contato", ["contato", "contatos", "informacoes de contato", "dados pessoais", "informacoes pessoais", "contact"]],
  ["experiencias", ["experiencia", "experiencias", "experiencia profissional", "experiencias profissionais", "historico profissional", "experience", "work experience", "experiencia voluntaria", "trabalho voluntario", "voluntariado"]],
  ["formacoes", ["formacao", "formacao academica", "educacao", "escolaridade", "education", "formacao academica e cursos"]],
  ["certificacoes", ["certificacoes", "certificacao", "certificados", "cursos", "cursos complementares", "cursos e certificacoes", "certifications", "licencas e certificados"]],
  ["habilidades", ["habilidades", "competencias", "competencias tecnicas", "habilidades tecnicas", "skills", "ferramentas", "conhecimentos", "hard skills", "soft skills", "idiomas", "linguas", "languages"]],
];

const RAIZES: [Secao, RegExp][] = [
  ["experiencias", /experien|voluntari/],
  ["formacoes", /formacao|educacao|escolaridade/],
  ["certificacoes", /certifica|cursos/],
  ["habilidades", /habilidade|competencia|skill|idioma|ferramenta/],
  ["resumo", /resumo|sobre mim|perfil|objetivo/],
  ["contato", /contato/],
];

function secaoDoTitulo(texto: string): Secao | null {
  const n = norm(texto);
  for (const [s, lista] of TITULOS) if (lista.includes(n)) return s;
  for (const [s, re] of RAIZES) if (re.test(n)) return s;
  return null;
}

// ---------- datas ----------

const MESES: Record<string, string> = {
  jan: "01", fev: "02", feb: "02", mar: "03", abr: "04", apr: "04", mai: "05", may: "05", jun: "06",
  jul: "07", ago: "08", aug: "08", set: "09", sep: "09", out: "10", oct: "10", nov: "11", dez: "12", dec: "12",
};
const MES = "(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\\.?";
const PONTO = `(?:${MES}\\s*(?:de\\s+|/\\s*)?\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`;
const FIM_ABERTO = "(?:atual|atualmente|presente|o momento|hoje|current|present|now)";
const RE_PERIODO = new RegExp(`(${PONTO})\\s*(?:[–—-]|\\ba\\b|\\bate\\b|\\bto\\b)\\s*(${PONTO}|${FIM_ABERTO})`, "i");

function converterData(s: string): string {
  const t = semAcento(s).toLowerCase().trim();
  let m = t.match(new RegExp(`^(${MES})\\s*(?:de\\s+|/\\s*)?(\\d{4})$`));
  if (m) return `${m[2]}-${MESES[m[1].slice(0, 3)] ?? "01"}`;
  m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})$/);
  return m ? m[1] : "";
}

function lerPeriodo(texto: string) {
  const m = semAcento(texto).match(RE_PERIODO);
  if (!m || m.index === undefined) return null;
  const aberto = new RegExp(`^${FIM_ABERTO}$`, "i").test(m[2].trim());
  return {
    inicio: converterData(m[1]),
    fim: aberto ? "" : converterData(m[2]),
    atual: aberto,
    antes: texto.slice(0, m.index),
    depois: texto.slice(m.index + m[0].length),
  };
}

const limparSeparadores = (s: string) => espacos(s.replace(/^[\s•|·,–—-]+|[\s•|·,–—-]+$/g, ""));

// ---------- montagem das linhas ----------

function montarLinhas(pagina: PaginaPdf, numero: number): Linha[] {
  const trechos = pagina.trechos.filter((t) => t.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const fileiras: TrechoPdf[][] = [];
  for (const t of trechos) {
    const f = fileiras.find((r) => Math.abs(r[0].y - t.y) <= Math.max(2, r[0].h * 0.4));
    if (f) f.push(t);
    else fileiras.push([t]);
  }
  const linhas: Linha[] = [];
  for (const f of fileiras) {
    f.sort((a, b) => a.x - b.x);
    let atual: Linha | null = null;
    for (const t of f) {
      const tam = Math.round(t.h);
      const vao = atual ? t.x - atual.xFim : 0;
      if (atual && vao < Math.max(tam, atual.tam) * 2.5) {
        atual.texto += vao > tam * 0.15 && !atual.texto.endsWith(" ") ? " " + t.str : t.str;
        atual.xFim = Math.max(atual.xFim, t.x + t.w);
        atual.tam = Math.max(atual.tam, tam);
        atual.fontes.push(t.fonte);
      } else {
        atual = { texto: t.str, x: t.x, xFim: t.x + t.w, y: t.y, tam, fontes: [t.fonte], pagina: numero, col: 0 };
        linhas.push(atual);
      }
    }
  }
  for (const l of linhas) l.texto = espacos(l.texto);
  return linhas.filter((l) => l.texto);
}

function tamanhoDoCorpo(linhas: Linha[]) {
  const peso = new Map<number, number>();
  for (const l of linhas) peso.set(l.tam, (peso.get(l.tam) ?? 0) + l.texto.length);
  return [...peso.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
}

function pareceTitulo(l: Linha, corpo: number) {
  return l.texto.length <= 45 && (maiusculas(l.texto) || l.tam >= corpo * 1.3);
}

/** Procura um vão vertical que divida a página em duas colunas. */
function corteDeColunas(linhas: Linha[], largura: number, corpo: number, exigirTitulos: boolean): number | null {
  const inicios = [...new Set(linhas.map((l) => Math.round(l.x)))].sort((a, b) => a - b);
  for (let i = 1; i < inicios.length; i++) {
    const a = inicios[i - 1];
    const b = inicios[i];
    if (b - a < largura * 0.15 || a > largura * 0.6 || b < largura * 0.2) continue;
    const corte = b - 2;
    if (exigirTitulos) {
      const titulos = linhas.filter((l) => pareceTitulo(l, corpo) && secaoDoTitulo(l.texto));
      if (!titulos.some((l) => l.x < corte) || !titulos.some((l) => l.x >= corte)) continue;
    }
    if (colunaValida(linhas, corte)) return corte;
  }
  return null;
}

function colunaValida(linhas: Linha[], corte: number) {
  const cruzam = linhas.filter((l) => l.x < corte && l.xFim > corte + 5).length;
  const esquerda = linhas.filter((l) => l.x < corte).length;
  return cruzam <= linhas.length * 0.05 && esquerda >= linhas.length * 0.1 && esquerda <= linhas.length * 0.9;
}

/** Junta títulos quebrados em duas linhas (ex.: "EXPERIÊNCIA" + "VOLUNTÁRIA"). */
function juntarTitulosQuebrados(linhas: Linha[], corpo: number) {
  for (let i = 0; i < linhas.length - 1; i++) {
    const a = linhas[i];
    const b = linhas[i + 1];
    if (
      a.col === b.col &&
      a.pagina === b.pagina &&
      a.tam === b.tam &&
      a.tam >= corpo * 1.3 &&
      maiusculas(a.texto) &&
      maiusculas(b.texto) &&
      a.y - b.y < a.tam * 1.6 &&
      (a.texto + b.texto).length <= 45
    ) {
      a.texto = `${a.texto} ${b.texto}`;
      linhas.splice(i + 1, 1);
      i--;
    }
  }
}

// ---------- agrupamento de texto corrido ----------

function fonteDominante(linhas: Linha[]) {
  const peso = new Map<string, number>();
  for (const l of linhas) for (const f of l.fontes) peso.set(f, (peso.get(f) ?? 0) + l.texto.length / l.fontes.length);
  return [...peso.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

// A fonte "normal" é calculada por página e seção (PDFs exportados trocam o nome das fontes a cada página).
const temDestaque = (l: Linha, base: string) => l.fontes.some((f) => f !== (l.base ?? base));
const todaDestaque = (l: Linha, base: string) => l.fontes.every((f) => f !== (l.base ?? base));

/** Junta linhas quebradas pela largura da coluna em frases/itens. */
function juntarParagrafos(linhas: Linha[]): string[] {
  if (!linhas.length) return [];
  const base = fonteDominante(linhas);
  const larguraMax = Math.max(...linhas.map((l) => l.xFim - l.x));
  const saida: string[] = [];
  let ant: Linha | null = null;
  for (const l of linhas) {
    const t = l.texto;
    const novo =
      !ant ||
      /^[•▪●◦·\-–*]\s/.test(t) ||
      /^\d+%/.test(t) ||
      maiusculas(t) ||
      maiusculas(ant.texto) ||
      Math.abs(l.x - ant.x) > 3 ||
      l.pagina !== ant.pagina ||
      (/[.!?;:]$/.test(ant.texto) && /^[\p{Lu}\d]/u.test(t)) ||
      (ant.xFim - ant.x < larguraMax * 0.6 && /^[\p{Lu}\d]/u.test(t)) ||
      (temDestaque(ant, base) && !temDestaque(l, base));
    if (novo) saida.push(t.replace(/^[•▪●◦·*]\s*/, ""));
    else saida[saida.length - 1] += " " + t;
    ant = l;
  }
  return saida.map(espacos);
}

// ---------- seções ----------

function lerExperiencias(linhas: Linha[], corpo: number): Experiencia[] {
  // Junta datas quebradas: "Analista • Nov 2020 – Mai" + "2021"
  for (let i = 0; i < linhas.length - 1; i++) {
    const a = linhas[i];
    const b = linhas[i + 1];
    if (
      !lerPeriodo(a.texto) &&
      a.tam === b.tam &&
      lerPeriodo(`${a.texto} ${b.texto}`) &&
      b.texto.length <= 20 &&
      a.pagina === b.pagina
    ) {
      a.texto = `${a.texto} ${b.texto}`;
      linhas.splice(i + 1, 1);
    }
  }

  const temDatas = linhas.some((l) => lerPeriodo(l.texto));
  const base = fonteDominante(linhas);
  const lista: Experiencia[] = [];
  let atual: (Experiencia & { linhas: Linha[] }) | null = null;
  let empresaPendente = "";
  let ultimaEmpresa = "";
  let ant: Linha | null = null;

  const fechar = () => {
    if (!atual) return;
    const { linhas: ls, ...e } = atual;
    e.descricao = juntarParagrafos(ls).join("\n");
    lista.push(e);
    atual = null;
  };
  const nova = (): Experiencia & { linhas: Linha[] } => ({
    id: id(), cargo: "", empresa: "", local: "", inicio: "", fim: "", atual: false, descricao: "", linhas: [],
  });

  for (const l of linhas) {
    const periodo = lerPeriodo(l.texto);
    const cabecalho =
      !periodo &&
      l.texto.length <= 70 &&
      (l.tam >= corpo * 1.25 || (todaDestaque(l, base) && !(ant && temDestaque(ant, base))));

    if (periodo) {
      fechar();
      atual = nova();
      atual.inicio = periodo.inicio;
      atual.fim = periodo.fim;
      atual.atual = periodo.atual;
      const resto = limparSeparadores(`${periodo.antes} ${periodo.depois}`);
      if (resto) atual.cargo = resto;
      if (empresaPendente) {
        const partes = empresaPendente.split(/\s+[|–—]\s+/);
        if (!atual.cargo && partes.length === 2) {
          atual.empresa = partes[0];
          atual.cargo = partes[1];
        } else if (!atual.cargo) {
          atual.cargo = empresaPendente;
          atual.empresa = ultimaEmpresa;
        } else atual.empresa = empresaPendente;
      } else atual.empresa = ultimaEmpresa;
      if (atual.empresa) ultimaEmpresa = atual.empresa;
      empresaPendente = "";
    } else if (cabecalho && (temDatas || !atual)) {
      if (!temDatas) {
        fechar();
        atual = nova();
        const partes = l.texto.split(/\s+[|–—]\s+/);
        atual.empresa = partes[0];
        atual.cargo = partes.slice(1).join(" – ");
      } else {
        fechar();
        empresaPendente = empresaPendente ? `${empresaPendente} | ${l.texto}` : l.texto;
      }
    } else if (atual) {
      atual.linhas.push(l);
    }
    ant = l;
  }
  fechar();
  return lista;
}

function lerFormacoes(linhas: Linha[]): Formacao[] {
  const menor = Math.min(...linhas.map((l) => l.tam));
  const base = fonteDominante(linhas);
  const variaTamanho = linhas.some((l) => l.tam > menor);
  const lista: Formacao[] = [];
  let atual: Formacao | null = null;
  const nova = (): Formacao => ({ id: id(), curso: "", instituicao: "", inicio: "", fim: "", observacao: "" });

  for (const l of linhas) {
    const periodo = lerPeriodo(l.texto);
    const soAno = l.texto.match(/^\s*(\d{4})\s*$/);
    if (periodo || soAno) {
      if (!atual || (atual.curso && (atual.inicio || atual.fim || atual.instituicao))) {
        if (atual) lista.push(atual);
        atual = nova();
      }
      if (periodo) {
        atual.inicio = periodo.inicio;
        atual.fim = periodo.fim;
        const resto = limparSeparadores(`${periodo.antes} ${periodo.depois}`);
        if (resto && !atual.curso) atual.curso = resto;
        else if (resto) atual.instituicao = resto;
      } else atual.fim = soAno![1];
      continue;
    }
    const titulo = variaTamanho ? l.tam > menor : todaDestaque(l, base) && l.fontes.length > 0 && base !== l.fontes[0];
    if (titulo || !atual || (!variaTamanho && atual.curso && atual.instituicao)) {
      if (atual?.curso) {
        lista.push(atual);
        atual = nova();
      }
      atual = atual ?? nova();
      if (!atual.curso) {
        const partes = l.texto.split(/\s+[|–—-]\s+/);
        atual.curso = partes[0];
        if (partes.length > 1 && !atual.instituicao) atual.instituicao = partes.slice(1).join(" – ");
        continue;
      }
    }
    if (!atual.instituicao) atual.instituicao = l.texto;
    else atual.observacao = espacos(`${atual.observacao} ${l.texto}`);
  }
  if (atual) lista.push(atual);
  return lista.filter((f) => f.curso || f.instituicao);
}

const EMISSORES =
  /^(scrum\.?org|people ?cert|axelos|pmi|exin|microsoft|aws|amazon|google|coursera|udemy|alura|fgv|senai|senac|sebrae|ibm|oracle|cisco|linkedin( learning)?|fundacao bradesco|scrum alliance|kanban university|comptia|isaca|itil|dio|rocketseat|hubspot|sap)\b/i;

function lerCertificacoes(linhas: Linha[]): Certificacao[] {
  const larguraMax = Math.max(...linhas.map((l) => l.xFim - l.x));
  const lista: Certificacao[] = [];
  let nome = "";
  let partes = 0;
  let ant: Linha | null = null;
  const ehLinhaEmissor = (t: string) =>
    (EMISSORES.test(semAcento(t)) || /\.(org|com|br|io)\b/i.test(t)) && t.split(" ").length <= 4;
  const comTraco = (t: string) => t.match(/^(.*?)\s+[-–—|]\s+([^-–—|]+)$/);
  // Se a maioria dos certificados traz o emissor, um nome sem emissor continua na linha seguinte.
  const comEmissor = linhas.filter((l) => ehLinhaEmissor(l.texto) || comTraco(l.texto)).length;
  const modoEmissor = comEmissor >= 2 && comEmissor >= linhas.length * 0.3;

  const fechar = (emissor = "") => {
    if (!nome) return;
    const ano = nome.match(/\b(19|20)\d{2}\b/);
    const nomeLimpo = limparSeparadores(nome.replace(/\(?\b(19|20)\d{2}\b\)?/, ""));
    lista.push({ id: id(), nome: nomeLimpo, emissor: emissor.trim(), data: ano ? ano[0] : "", link: "" });
    nome = "";
    partes = 0;
  };

  for (const l of linhas) {
    const t = l.texto;
    const traco = comTraco(t);
    const ehEmissor = !!nome && ehLinhaEmissor(t);
    const continua =
      !!nome && ant !== null && (ant.xFim - ant.x >= larguraMax * 0.85 || (modoEmissor && partes < 2));

    if (ehEmissor) {
      fechar(t);
    } else if (traco && (EMISSORES.test(semAcento(traco[2])) || traco[2].split(" ").length <= 3)) {
      if (!continua) fechar();
      nome = espacos(`${nome} ${traco[1]}`);
      fechar(traco[2]);
      ant = l;
      continue;
    } else if (continua) {
      nome = `${nome} ${t}`;
      partes++;
    } else {
      fechar();
      nome = t;
      partes = 1;
    }
    ant = l;
  }
  fechar();
  return lista;
}

function lerHabilidades(linhas: Linha[]): string[] {
  const itens: string[] = [];
  let anteriorSeparado = false;
  for (const l of linhas) {
    const t = l.texto;
    const comSeparador = /[•;|·▪]/.test(t) || (t.match(/,/g)?.length ?? 0) >= 3;
    if (comSeparador) {
      const re = /[•;|·▪]/.test(t) ? /[•;|·▪]/ : /,/;
      const partes = t.split(re).map((p) => p.trim());
      // continuação de item quebrado: "Miro • SharePoint • Micr" + "osoft Planner"
      if (anteriorSeparado && itens.length && /^\p{Ll}/u.test(partes[0])) itens[itens.length - 1] += " " + partes.shift();
      itens.push(...partes.filter(Boolean));
      anteriorSeparado = true;
      continue;
    }
    const ant = itens[itens.length - 1];
    const umaPalavra = !t.includes(" ");
    if (
      ant &&
      !anteriorSeparado &&
      (/^\p{Ll}/u.test(t) || (umaPalavra && ant.split(" ").length >= 3 && !/[.,]$/.test(ant)))
    ) {
      itens[itens.length - 1] = `${ant} ${t}`;
    } else itens.push(t);
    anteriorSeparado = false;
  }
  return itens.map((s) => limparSeparadores(s)).filter((s) => s && s.length <= 80);
}

// ---------- contato ----------

const RE_EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const RE_TELEFONE = /(\+\s?\d{1,3}\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[\s.-]?\d{4}/;
const RE_URL = /(https?:\/\/[^\s]+|www\.[^\s]+|linkedin\.com\/in\/[^\s]+)/i;
const RE_CIDADE = /^[\p{Lu}][\p{L} ]+\s?[,/–-]\s?[A-Z]{2}$/u;

// ---------- leitura principal ----------

export function lerCurriculo(paginas: PaginaPdf[]): ResultadoLeitura {
  const perfil = perfilVazio();
  const avisos: string[] = [];

  // Colunas: primeiro nas páginas com títulos dos dois lados; o mesmo corte vale para as outras páginas.
  const porPagina = paginas.map((p, i) => montarLinhas(p, i));
  const cortes = porPagina.map((ls, i) => corteDeColunas(ls, paginas[i].largura, tamanhoDoCorpo(ls), true));
  const corteConhecido = cortes.find((c) => c !== null) ?? null;
  const todas: Linha[] = [];
  porPagina.forEach((linhas, i) => {
    let corte = cortes[i];
    if (corte === null && corteConhecido !== null && colunaValida(linhas, corteConhecido)) corte = corteConhecido;
    if (corte !== null) for (const l of linhas) l.col = l.x >= corte ? 1 : 0;
    linhas.sort((a, b) => a.col - b.col || b.y - a.y || a.x - b.x);
    todas.push(...linhas);
  });
  if (!todas.length) {
    return { perfil, avisos: ["Não encontrei texto neste PDF. Se ele for uma imagem escaneada, preencha o perfil à mão."] };
  }

  const corpo = tamanhoDoCorpo(todas);
  juntarTitulosQuebrados(todas, corpo);

  // Nome: maior fonte da primeira página; título profissional logo abaixo.
  const primeira = todas.filter((l) => l.pagina === 0);
  const maior = Math.max(...primeira.map((l) => l.tam));
  const usadas = new Set<Linha>();
  if (maior >= corpo * 1.6) {
    const linhasNome = primeira.filter((l) => l.tam === maior && !secaoDoTitulo(l.texto));
    if (linhasNome.length && linhasNome.length <= 3) {
      perfil.pessoais.nome = nomeProprio(espacos(linhasNome.map((l) => l.texto).join(" ")));
      linhasNome.forEach((l) => usadas.add(l));
      const ultima = linhasNome[linhasNome.length - 1];
      const idx = todas.indexOf(ultima);
      const tit: Linha[] = [];
      for (let i = idx + 1; i < todas.length && tit.length < 3; i++) {
        const l = todas[i];
        if (l.col !== ultima.col || l.pagina !== ultima.pagina) break;
        if (ultima.y - l.y > maior * 6) break;
        if (pareceTitulo(l, corpo) && secaoDoTitulo(l.texto)) break;
        if (RE_EMAIL.test(l.texto) || RE_TELEFONE.test(l.texto)) break;
        tit.push(l);
      }
      if (tit.length) {
        perfil.pessoais.titulo = espacos(tit.map((l) => l.texto).join(" ").replace(/\s*\|\s*/g, " | "));
        tit.forEach((l) => usadas.add(l));
      }
    }
  }

  // Tamanho típico dos títulos reconhecidos; um título desconhecido precisa ter esse tamanho.
  const tamanhosTitulo = todas.filter((l) => pareceTitulo(l, corpo) && maiusculas(l.texto) && secaoDoTitulo(l.texto)).map((l) => l.tam);
  const tamTitulo = tamanhosTitulo.length ? Math.min(...tamanhosTitulo) : corpo * 1.3;

  // Seções: cada linha herda o último título da mesma coluna (inclusive da página anterior).
  const secaoPorColuna = new Map<number, { s: Secao; bloco: number }>();
  let blocos = 0;
  const desconhecidas = new Set<string>();
  for (const l of todas) {
    if (usadas.has(l)) continue;
    if (pareceTitulo(l, corpo)) {
      const s = secaoDoTitulo(l.texto);
      const destacado = l.tam >= tamTitulo * 0.95 && (maiusculas(l.texto) || l.tam >= corpo * 1.3);
      if ((s && (maiusculas(l.texto) || l.tam >= corpo * 1.3)) || (destacado && maiusculas(l.texto) && l.tam >= tamTitulo)) {
        l.titulo = true;
        secaoPorColuna.set(l.col, { s: s ?? "outro", bloco: ++blocos });
        if (!s) desconhecidas.add(l.texto);
        continue;
      }
    }
    l.secao = secaoPorColuna.get(l.col)?.s;
    l.bloco = secaoPorColuna.get(l.col)?.bloco;
  }
  const grupos = new Map<string, Linha[]>();
  for (const l of todas) {
    if (!l.secao) continue;
    const k = `${l.bloco}-${l.pagina}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  for (const ls of grupos.values()) {
    const base = fonteDominante(ls);
    for (const l of ls) l.base = base;
  }
  const daSecao = (s: Secao) => todas.filter((l) => !l.titulo && !usadas.has(l) && l.secao === s);

  // Contato: procura no PDF inteiro (e-mail, telefone, links) e cidade na seção de contato.
  const textoTodo = todas.map((l) => l.texto).join("\n");
  perfil.pessoais.email = textoTodo.match(RE_EMAIL)?.[0] ?? "";
  perfil.pessoais.telefone = espacos(textoTodo.match(RE_TELEFONE)?.[0] ?? "");
  const urls = [
    ...paginas.flatMap((p) => p.links),
    ...todas.map((l) => l.texto.match(RE_URL)?.[0]).filter((u): u is string => !!u),
  ].filter((u) => !/^(mailto|tel):/i.test(u));
  const linkedin = urls.find((u) => /linkedin\.com/i.test(u));
  if (linkedin) perfil.pessoais.linkedin = linkedin.startsWith("http") ? linkedin : `https://${linkedin.replace(/^\/+/, "")}`;
  const site = urls.find((u) => !/linkedin\.com/i.test(u));
  if (site) perfil.pessoais.portfolio = site.startsWith("http") ? site : `https://${site}`;
  const cidade = [...daSecao("contato"), ...todas.filter((l) => !l.secao && !usadas.has(l) && !l.titulo)].find((l) =>
    RE_CIDADE.test(l.texto),
  );
  if (cidade) perfil.pessoais.cidade = cidade.texto;

  perfil.resumo = juntarParagrafos(daSecao("resumo")).join("\n");

  const exp = daSecao("experiencias");
  for (const b of [...new Set(exp.map((l) => l.bloco))]) {
    perfil.experiencias.push(...lerExperiencias(exp.filter((l) => l.bloco === b), corpo));
  }
  const form = daSecao("formacoes");
  if (form.length) perfil.formacoes = lerFormacoes(form);
  const cert = daSecao("certificacoes");
  if (cert.length) perfil.certificacoes = lerCertificacoes(cert);

  const vistas = new Set<string>();
  const habilidades: Habilidade[] = [];
  for (const nome of lerHabilidades(daSecao("habilidades"))) {
    const chave = norm(nome);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    habilidades.push({ id: id(), nome });
  }
  perfil.habilidades = habilidades;

  for (const t of desconhecidas) avisos.push(`A seção “${t}” não tem campo correspondente no perfil e não foi importada.`);
  if (!perfil.pessoais.nome) avisos.push("Não identifiquei o nome. Preencha à mão.");
  if (!perfil.experiencias.length) avisos.push("Não identifiquei experiências profissionais.");
  return { perfil, avisos };
}
