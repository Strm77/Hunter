"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, formatarData } from "@/lib/api";
import { Candidatura } from "@/lib/types";
import { Botao, Erro, Vazio } from "@/components/ui";
import CurriculoVisual from "@/components/CurriculoVisual";

/** Mostra a cópia congelada do currículo usado numa candidatura, exatamente como foi vinculado. */
export default function CurriculoEnviadoPage() {
  const { id } = useParams<{ id: string }>();
  const [candidatura, setCandidatura] = useState<Candidatura | null | undefined>(undefined);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api
      .listar<Candidatura>("candidaturas")
      .then((lista) => setCandidatura(lista.find((c) => c.id === id) ?? null))
      .catch((e) => setErro(e.message));
  }, [id]);

  if (erro) return <Erro mensagem={erro} />;
  if (candidatura === undefined) return <p className="text-sm text-tinta/50">Carregando…</p>;
  const congelado = candidatura?.curriculoEnviado;
  if (!candidatura || !congelado) return <Vazio>Essa candidatura não tem versão de currículo registrada.</Vazio>;

  return (
    <div>
      <div className="nao-imprimir mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-tinta/60 hover:underline">
            ← Candidaturas
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Currículo enviado</h1>
          <p className="text-sm text-tinta/60">
            {candidatura.cargo} na {candidatura.empresa} · versão “{congelado.curriculo.nome}” registrada em{" "}
            {formatarData(congelado.congeladoEm)}. Mudanças posteriores no perfil não aparecem aqui.
          </p>
        </div>
        <Botao onClick={() => window.print()}>Imprimir / PDF</Botao>
      </div>
      <div className="mx-auto max-w-3xl rounded-xl border border-black/10 print:border-0">
        <CurriculoVisual perfil={congelado.perfil} curriculo={congelado.curriculo} />
      </div>
    </div>
  );
}
