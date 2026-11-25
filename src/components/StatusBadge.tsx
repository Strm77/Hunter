import type { StatusCandidatura } from "@/lib/types";

const CORES: Record<StatusCandidatura, string> = {
  Candidatada: "bg-slate-100 text-slate-700",
  "Em análise": "bg-amber-100 text-amber-800",
  "Retorno recebido": "bg-sky-100 text-sky-800",
  Entrevista: "bg-violet-100 text-violet-800",
  Recusada: "bg-red-100 text-red-700",
  Aprovada: "bg-emerald-100 text-emerald-800",
  "Sem retorno": "bg-stone-100 text-stone-600",
  Desisti: "bg-stone-100 text-stone-600",
};

export function corStatus(s: StatusCandidatura) {
  return CORES[s];
}

export default function StatusBadge({ status }: { status: StatusCandidatura }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${CORES[status]}`}>
      {status}
    </span>
  );
}
