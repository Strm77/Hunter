"use client";

import { useState } from "react";
import { api, formatarData, hojeISO } from "@/lib/api";
import { Candidatura, TIPOS_EVENTO, TipoEvento } from "@/lib/types";
import { Botao, Campo, Erro, classeCampo } from "./ui";

const TIPOS_MANUAIS = TIPOS_EVENTO.filter((t) => t !== "Status");

const ICONE: Record<TipoEvento, string> = {
  Status: "●",
  Envio: "➜",
  Contato: "✉",
  Entrevista: "☎",
  Nota: "✎",
};

/** Linha do tempo da candidatura, com formulário para registrar um novo passo. */
export default function Historico({
  candidatura,
  aoAtualizar,
}: {
  candidatura: Candidatura;
  aoAtualizar: (c: Candidatura) => void;
}) {
  const [tipo, setTipo] = useState<TipoEvento>("Contato");
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(corpo: Record<string, unknown>) {
    setErro("");
    setSalvando(true);
    try {
      aoAtualizar(await api.atualizar<Candidatura>("candidaturas", candidatura.id, corpo));
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (await enviar({ novoEvento: { tipo, data, descricao } })) setDescricao("");
  }

  const eventos = [...(candidatura.historico ?? [])].reverse();

  return (
    <div className="space-y-5">
      {eventos.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhum passo registrado ainda.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-black/10 pl-5">
          {eventos.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-marca ring-1 ring-black/10">
                {ICONE[ev.tipo]}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {ev.tipo === "Status"
                    ? ev.de
                      ? `Status: ${ev.de} → ${ev.para}`
                      : `Status: ${ev.para}`
                    : ev.tipo}
                </p>
                <p className="text-xs text-tinta/50">{formatarData(ev.data)}</p>
              </div>
              {ev.descricao && <p className="whitespace-pre-line text-sm text-tinta/80">{ev.descricao}</p>}
              <div className="flex items-center justify-between gap-2 text-xs text-tinta/40">
                <span>{ev.autor ? `por ${ev.autor}` : ""}</span>
                {ev.tipo !== "Status" && ev.tipo !== "Envio" && (
                  <button
                    type="button"
                    className="hover:text-red-700 hover:underline"
                    disabled={salvando}
                    onClick={() => confirm("Remover este registro do histórico?") && enviar({ removerEventoId: ev.id })}
                  >
                    remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={adicionar} className="grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-2">
        <p className="text-sm font-semibold sm:col-span-2">Registrar um passo</p>
        <Campo rotulo="Tipo">
          <select className={classeCampo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
            {TIPOS_MANUAIS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Data">
          <input type="date" className={classeCampo} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="O que aconteceu *" className="sm:col-span-2">
          <textarea
            rows={3}
            required
            className={classeCampo}
            placeholder="Ex.: recrutadora ligou e marcou entrevista para quinta, 14h"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Erro mensagem={erro} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Botao type="submit" variante="primario" disabled={salvando}>
            Registrar
          </Botao>
        </div>
      </form>
    </div>
  );
}
