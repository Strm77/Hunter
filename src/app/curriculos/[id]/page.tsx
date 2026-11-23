"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, formatarData, hojeISO } from "@/lib/api";
import { Candidatura, Curriculo, ItemSelecionado, Perfil, Vaga } from "@/lib/types";
import { Botao, Campo, Cartao, Erro, classeCampo } from "@/components/ui";
import CurriculoVisual from "@/components/CurriculoVisual";
import StatusBadge from "@/components/StatusBadge";


export default function EditorCurriculoPage() {
  const { id } = useParams<{ id: string }>();
  const [curriculo, setCurriculo] = useState<Curriculo | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([
      api.listar<Curriculo>("curriculos"),
      api.perfil<Perfil>(),
      api.listar<Vaga>("vagas"),
      api.listar<Candidatura>("candidaturas"),
    ])
      .then(([cs, p, v, ca]) => {
        const c = cs.find((x) => x.id === id);
        if (!c) setNaoEncontrado(true);
        setCurriculo(c ?? null);
        setPerfil(p);
        setVagas(v);
        setCandidaturas(ca);
      })
      .catch((e) => setErro(e.message));
  }, [id]);

  const vaga = useMemo(() => vagas.find((v) => v.id === curriculo?.vagaId), [vagas, curriculo]);

  if (naoEncontrado)
    return (
      <p className="text-sm">
        Versão não encontrada. <Link href="/curriculos" className="text-marca underline">Voltar</Link>
      </p>
    );
  if (!curriculo || !perfil) return <p className="text-sm text-tinta/50">{erro || "Carregando…"}</p>;

  function mudar(parcial: Partial<Curriculo>) {
    setCurriculo((c) => (c ? { ...c, ...parcial } : c));
    setAlterado(true);
    setMensagem("");
  }

  async function salvar() {
    if (!curriculo) return;
    setErro("");
    try {
      const salvo = await api.atualizar<Curriculo>("curriculos", curriculo.id, curriculo);
      setCurriculo(salvo);
      setAlterado(false);
      setMensagem("Versão salva.");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const usadaEm = candidaturas.filter((c) => c.curriculoId === curriculo.id);

  return (
    <div>
      <div className="nao-imprimir mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/curriculos" className="text-sm text-tinta/60 hover:underline">
            ← Currículos
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{curriculo.nome || "Versão sem nome"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-tinta/60">{alterado ? "Alterações não salvas" : mensagem}</span>
          <Botao onClick={() => window.print()}>Imprimir / PDF</Botao>
          <Botao variante="primario" onClick={salvar} disabled={!alterado}>
            Salvar versão
          </Botao>
        </div>
      </div>
      <div className="nao-imprimir">
        <Erro mensagem={erro} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="nao-imprimir space-y-4">
          <Cartao>
            <h2 className="mb-3 font-semibold">Dados da versão</h2>
            <div className="grid gap-3">
              <Campo rotulo="Nome da versão">
                <input className={classeCampo} value={curriculo.nome} onChange={(e) => mudar({ nome: e.target.value })} />
              </Campo>
              <Campo rotulo="Vaga vinculada">
                <select className={classeCampo} value={curriculo.vagaId} onChange={(e) => mudar({ vagaId: e.target.value })}>
                  <option value="">— Sem vaga —</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.titulo} · {v.empresa}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Enviada para a vaga em" dica="Registre quando esta versão foi enviada. Deixe vazio se ainda não foi.">
                <div className="flex gap-2">
                  <input
                    type="date"
                    className={classeCampo}
                    value={curriculo.enviadaEm}
                    onChange={(e) => mudar({ enviadaEm: e.target.value })}
                  />
                  {!curriculo.enviadaEm && <Botao onClick={() => mudar({ enviadaEm: hojeISO() })}>Hoje</Botao>}
                </div>
              </Campo>
              <Campo rotulo="Anotações internas" dica="Não aparecem no currículo.">
                <textarea
                  rows={2}
                  className={classeCampo}
                  value={curriculo.observacoes}
                  onChange={(e) => mudar({ observacoes: e.target.value })}
                />
              </Campo>
              {(vaga || usadaEm.length > 0) && (
                <div className="space-y-1 text-xs text-tinta/70">
                  {vaga && (
                    <p>
                      Vaga: {vaga.titulo} · {vaga.empresa}
                      {vaga.link && (
                        <>
                          {" · "}
                          <a href={vaga.link} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                            ver vaga ↗
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {usadaEm.map((c) => (
                    <p key={c.id} className="flex items-center gap-2">
                      Candidatura {c.cargo} · {c.empresa} em {formatarData(c.data)} <StatusBadge status={c.status} />
                    </p>
                  ))}
                </div>
              )}
            </div>
          </Cartao>

          <Cartao>
            <h2 className="font-semibold">Conteúdo</h2>
            <p className="mb-3 mt-1 text-xs text-tinta/60">
              Escolha o que entra, a ordem e o que destacar (★). O texto vem do{" "}
              <Link href="/perfil" className="text-marca underline">perfil</Link>: para corrigir ou acrescentar algo real, edite
              o perfil.
            </p>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={curriculo.incluirResumo}
                onChange={(e) => mudar({ incluirResumo: e.target.checked })}
                disabled={!perfil.resumo}
              />
              Incluir resumo profissional {!perfil.resumo && <span className="text-tinta/50">(vazio no perfil)</span>}
            </label>
            <Seletor
              titulo="Experiências"
              base={perfil.experiencias.map((e) => ({ id: e.id, rotulo: [e.cargo, e.empresa].filter(Boolean).join(" · ") }))}
              selecao={curriculo.experiencias}
              aoMudar={(s) => mudar({ experiencias: s })}
            />
            <Seletor
              titulo="Formação"
              base={perfil.formacoes.map((f) => ({ id: f.id, rotulo: [f.curso, f.instituicao].filter(Boolean).join(" · ") }))}
              selecao={curriculo.formacoes}
              aoMudar={(s) => mudar({ formacoes: s })}
            />
            <Seletor
              titulo="Certificações"
              base={perfil.certificacoes.map((c) => ({ id: c.id, rotulo: [c.nome, c.emissor].filter(Boolean).join(" · ") }))}
              selecao={curriculo.certificacoes}
              aoMudar={(s) => mudar({ certificacoes: s })}
            />
            <Seletor
              titulo="Habilidades"
              base={perfil.habilidades.map((h) => ({ id: h.id, rotulo: h.nome }))}
              selecao={curriculo.habilidades}
              aoMudar={(s) => mudar({ habilidades: s })}
            />
          </Cartao>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="nao-imprimir mb-2 text-xs font-medium uppercase tracking-wide text-tinta/50">Pré-visualização</p>
          <div className="rounded-xl border border-black/10 shadow-sm print:border-0 print:shadow-none">
            <CurriculoVisual perfil={perfil} curriculo={curriculo} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Seletor({
  titulo,
  base,
  selecao,
  aoMudar,
}: {
  titulo: string;
  base: { id: string; rotulo: string }[];
  selecao: ItemSelecionado[];
  aoMudar: (s: ItemSelecionado[]) => void;
}) {
  const rotulo = new Map(base.map((b) => [b.id, b.rotulo || "(sem título)"]));
  const incluidos = selecao.filter((s) => rotulo.has(s.refId));
  const fora = base.filter((b) => !incluidos.some((s) => s.refId === b.id));

  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= incluidos.length) return;
    const c = [...incluidos];
    [c[i], c[j]] = [c[j], c[i]];
    aoMudar(c);
  };

  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-sm font-medium text-tinta/80">
        {titulo} <span className="text-tinta/40">{incluidos.length}/{base.length}</span>
      </h3>
      {base.length === 0 ? (
        <p className="text-xs text-tinta/50">Nada cadastrado no perfil.</p>
      ) : (
        <ul className="space-y-1">
          {incluidos.map((s, i) => (
            <li key={s.refId} className="flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-sm">
              <button
                title={s.destaque ? "Remover destaque" : "Destacar"}
                aria-pressed={s.destaque}
                onClick={() => aoMudar(incluidos.map((x) => (x.refId === s.refId ? { ...x, destaque: !x.destaque } : x)))}
                className={`px-1 text-base ${s.destaque ? "text-amber-500" : "text-tinta/25 hover:text-tinta/50"}`}
              >
                ★
              </button>
              <span className="min-w-0 flex-1 truncate">{rotulo.get(s.refId)}</span>
              <button onClick={() => mover(i, -1)} disabled={i === 0} className="px-1 text-tinta/50 disabled:opacity-30" aria-label="Subir">
                ↑
              </button>
              <button
                onClick={() => mover(i, 1)}
                disabled={i === incluidos.length - 1}
                className="px-1 text-tinta/50 disabled:opacity-30"
                aria-label="Descer"
              >
                ↓
              </button>
              <button
                onClick={() => aoMudar(incluidos.filter((x) => x.refId !== s.refId))}
                className="px-1 text-xs text-red-700 hover:underline"
              >
                tirar
              </button>
            </li>
          ))}
          {fora.map((b) => (
            <li key={b.id} className="flex items-center gap-2 rounded-md border border-dashed border-black/15 px-2 py-1 text-sm text-tinta/50">
              <span className="min-w-0 flex-1 truncate line-through">{b.rotulo || "(sem título)"}</span>
              <button
                onClick={() => aoMudar([...incluidos, { refId: b.id, destaque: false }])}
                className="px-1 text-xs text-marca hover:underline"
              >
                incluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
