export const STATUS_CANDIDATURA = [
  "Candidatada",
  "Em análise",
  "Retorno recebido",
  "Entrevista",
  "Recusada",
  "Aprovada",
] as const;

export type StatusCandidatura = (typeof STATUS_CANDIDATURA)[number];

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
  criadoEm: string;
  atualizadoEm: string;
}

export interface Vaga {
  id: string;
  titulo: string;
  empresa: string;
  link: string;
  salvaEm: string; // AAAA-MM-DD
  notas: string;
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
}

export type Colecao = "candidaturas" | "vagas" | "curriculos";

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
