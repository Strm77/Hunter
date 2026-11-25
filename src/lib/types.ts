export const STATUS_CANDIDATURA = [
  "Candidatada",
  "Em análise",
  "Retorno recebido",
  "Entrevista",
  "Recusada",
  "Aprovada",
  "Sem retorno",
  "Desisti",
] as const;

export type StatusCandidatura = (typeof STATUS_CANDIDATURA)[number];

export const TIPOS_EVENTO = ["Status", "Envio", "Contato", "Entrevista", "Nota"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Um passo do andamento da candidatura. Mudanças de status geram eventos automaticamente. */
export interface EventoHistorico {
  id: string;
  data: string; // AAAA-MM-DD
  tipo: TipoEvento;
  de: string; // status anterior (só em eventos de status)
  para: string; // status novo (só em eventos de status)
  descricao: string;
  autor: string; // e-mail de quem registrou
  registradoEm: string; // data e hora ISO
}

/**
 * Cópia congelada da versão de currículo usada na candidatura, tirada quando ela é vinculada.
 * Mudanças posteriores no perfil ou na versão não alteram o que ficou registrado como enviado.
 * O perfil guardado contém só os itens que a versão usava.
 */
export interface CurriculoCongelado {
  curriculoId: string;
  congeladoEm: string;
  perfil: Perfil;
  curriculo: Curriculo;
}

export interface Candidatura {
  id: string;
  empresa: string;
  cargo: string;
  data: string; // AAAA-MM-DD
  status: StatusCandidatura;
  proximaAcao: string;
  observacoes: string;
  vagaId: string;
  curriculoId: string;
  historico: EventoHistorico[];
  curriculoEnviado: CurriculoCongelado | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const MODALIDADES = ["Remoto", "Híbrido", "Presencial"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

/** Tema de busca: o tipo de vaga que interessa (ex.: "comunicação"). */
export interface Tema {
  id: string;
  nome: string;
  palavrasChave: string[];
  excluir: string[]; // termos que tiram a vaga do tema
  local: string;
  modalidade: Modalidade | ""; // vazio = qualquer
  senioridade: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export const SITUACOES_VAGA = ["Nova", "Em preparação", "Pronta para enviar", "Candidatada", "Descartada"] as const;
export type SituacaoVaga = (typeof SITUACOES_VAGA)[number];

export const TIPOS_CANDIDATURA = ["Não sei", "Simplificada", "Site da empresa"] as const;
export type TipoCandidatura = (typeof TIPOS_CANDIDATURA)[number];

export const ORIGENS_VAGA = ["Colada manualmente", "Alerta de e-mail", "Outra fonte"] as const;
export type OrigemVaga = (typeof ORIGENS_VAGA)[number];

export interface Vaga {
  id: string;
  titulo: string;
  empresa: string;
  link: string;
  codigoLinkedin: string; // extraído do link; usado para evitar vaga duplicada
  salvaEm: string; // AAAA-MM-DD
  notas: string;
  temaId: string;
  descricao: string; // texto completo da publicação, colado
  local: string;
  modalidade: Modalidade | "";
  origem: OrigemVaga;
  tipoCandidatura: TipoCandidatura;
  situacao: SituacaoVaga;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Experiencia {
  id: string;
  cargo: string;
  empresa: string;
  local: string;
  inicio: string;
  fim: string;
  atual: boolean;
  descricao: string;
}

export interface Formacao {
  id: string;
  curso: string;
  instituicao: string;
  inicio: string;
  fim: string;
  observacao: string;
}

export interface Certificacao {
  id: string;
  nome: string;
  emissor: string;
  data: string;
  link: string;
}

export interface Habilidade {
  id: string;
  nome: string;
}

export interface Perfil {
  pessoais: {
    nome: string;
    titulo: string;
    email: string;
    telefone: string;
    cidade: string;
    linkedin: string;
    portfolio: string;
  };
  resumo: string;
  experiencias: Experiencia[];
  formacoes: Formacao[];
  certificacoes: Certificacao[];
  habilidades: Habilidade[];
  atualizadoEm: string;
}

/** Item do currículo-base escolhido para uma variante: só referência, ordem e destaque. */
export interface ItemSelecionado {
  refId: string;
  destaque: boolean;
}

/**
 * Variante de currículo vinculada a uma vaga. Não guarda texto próprio de conteúdo:
 * apenas referências (por id) a itens do currículo-base, em ordem, com destaque opcional.
 * Assim a variante nunca pode conter experiência, formação ou certificação que não exista no perfil.
 */
export interface Curriculo {
  id: string;
  nome: string;
  vagaId: string;
  incluirResumo: boolean;
  experiencias: ItemSelecionado[];
  formacoes: ItemSelecionado[];
  certificacoes: ItemSelecionado[];
  habilidades: ItemSelecionado[];
  enviadaEm: string; // AAAA-MM-DD; vazio = ainda não enviada
  observacoes: string; // anotação interna, não aparece no currículo
  criadoEm: string;
  atualizadoEm: string;
}

export interface BancoDeDados {
  versao: 1;
  perfil: Perfil;
  candidaturas: Candidatura[];
  vagas: Vaga[];
  curriculos: Curriculo[];
  temas: Tema[];
}

export type Colecao = "candidaturas" | "vagas" | "curriculos" | "temas";

export function perfilVazio(): Perfil {
  return {
    pessoais: {
      nome: "",
      titulo: "",
      email: "",
      telefone: "",
      cidade: "",
      linkedin: "",
      portfolio: "",
    },
    resumo: "",
    experiencias: [],
    formacoes: [],
    certificacoes: [],
    habilidades: [],
    atualizadoEm: "",
  };
}
