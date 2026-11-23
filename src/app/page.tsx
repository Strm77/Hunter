"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ehLinkSeguro, formatarData, hojeISO } from "@/lib/api";
import { Candidatura, Curriculo, STATUS_CANDIDATURA, StatusCandidatura, Vaga } from "@/lib/types";
import { Botao, Cabecalho, Campo, Erro, Modal, Vazio, classeCampo } from "@/components/ui";
import { corStatus } from "@/components/StatusBadge";

const AGUARDANDO: StatusCandidatura[] = ["Candidatada", "Em análise"];
const COM_RETORNO: StatusCandidatura[] = ["Retorno recebido", "Entrevista", "Recusada", "Aprovada"];

type Form = Omit<Candidatura, "id" | "criadoEm" | "atualizadoEm">;

const formVazio = (): Form => ({
  empresa: "",
  cargo: "",
  data: hojeISO(),
  status: "Candidatada",
  proximaAcao: "",
  observacoes: "",
  vagaId: "",
  curriculoId: "",
});

export default function PainelPage() {
  const [itens, setItens] = useState<Candidatura[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [curriculos, setCurriculos] = useState<Curriculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<StatusCandidatura | "Todas">("Todas");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null); // "novo" | id
  const [form, setForm] = useState<Form>(formVazio());
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [c, v, cv] = await Promise.all([
      api.listar<Candidatura>("candidaturas"),
      api.listar<Vaga>("vagas"),
      api.listar<Curriculo>("curriculos"),
    ]);
    setItens(c);
    setVagas(v);
    setCurriculos(cv);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  const contadores = useMemo(
    () => ({
      total: itens.length,
      aguardando: itens.filter((i) => AGUARDANDO.includes(i.status)).length,
      comRetorno: itens.filter((i) => COM_RETORNO.includes(i.status)).length,
      entrevistas: itens.filter((i) => i.status === "Entrevista").length,
    }),
    [itens],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens
      .filter((i) => filtro === "Todas" || i.status === filtro)
      .filter((i) => !termo || `${i.empresa} ${i.cargo}`.toLowerCase().includes(termo))
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
  }, [itens, filtro, busca]);

  const vagaPorId = useMemo(() => new Map(vagas.map((v) => [v.id, v])), [vagas]);
  const cvPorId = useMemo(() => new Map(curriculos.map((c) => [c.id, c])), [curriculos]);

  function abrirNovo() {
    setForm(formVazio());
    setErro("");
    setEditando("novo");
  }

  function abrirEdicao(c: Candidatura) {
    setForm({
      empresa: c.empresa,
      cargo: c.cargo,
      data: c.data,
      status: c.status,
      proximaAcao: c.proximaAcao,
      observacoes: c.observacoes,
      vagaId: c.vagaId,
      curriculoId: c.curriculoId,
    });
    setErro("");
    setEditando(c.id);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editando === "novo") await api.criar("candidaturas", form);
      else if (editando) await api.atualizar("candidaturas", editando, form);
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function excluir(c: Candidatura) {
    if (!confirm(`Excluir a candidatura para ${c.cargo} na ${c.empresa}?`)) return;
    await api.remover("candidaturas", c.id);
    await carregar();
  }

  async function mudarStatus(c: Candidatura, status: StatusCandidatura) {
    setItens((lista) => lista.map((i) => (i.id === c.id ? { ...i, status } : i)));
    await api.atualizar("candidaturas", c.id, { status });
  }

  function escolherVaga(vagaId: string) {
    const v = vagaPorId.get(vagaId);
    setForm((f) => ({
      ...f,
      vagaId,
      empresa: f.empresa || v?.empresa || "",
      cargo: f.cargo || v?.titulo || "",
      curriculoId:
        f.curriculoId || curriculos.find((c) => c.vagaId === vagaId)?.id || "",
    }));
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Cabecalho
        titulo="Candidaturas e retornos"
        descricao="Acompanhe cada candidatura, o status e o próximo passo."
        acao={<Botao variante="primario" onClick={abrirNovo}>+ Nova candidatura</Botao>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador rotulo="Total" valor={contadores.total} />
        <Contador rotulo="Aguardando retorno" valor={contadores.aguardando} />
        <Contador rotulo="Com retorno" valor={contadores.comRetorno} />
        <Contador rotulo="Entrevistas" valor={contadores.entrevistas} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["Todas", ...STATUS_CANDIDATURA] as const).map((s) => {
            const n = s === "Todas" ? itens.length : itens.filter((i) => i.status === s).length;
            const ativo = filtro === s;
            return (
              <button
                key={s}
                onClick={() => setFiltro(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  ativo ? "border-marca bg-marca text-white" : "border-black/10 bg-white hover:bg-black/5"
                }`}
              >
                {s} <span className={ativo ? "text-white/70" : "text-tinta/40"}>{n}</span>
              </button>
            );
          })}
        </div>
        <input
          className={`${classeCampo} sm:w-64`}
          placeholder="Buscar empresa ou cargo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {!editando && <Erro mensagem={erro} />}

      {carregando ? (
        <p className="text-sm text-tinta/50">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhuma candidatura registrada ainda. Clique em “Nova candidatura” para começar.</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>Nenhuma candidatura com esse filtro.</Vazio>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((c) => {
            const vaga = vagaPorId.get(c.vagaId);
            const cv = cvPorId.get(c.curriculoId);
            return (
              <li key={c.id} className="rounded-xl border border-black/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.cargo}</p>
                    <p className="text-sm text-tinta/70">
                      {c.empresa} · candidatura em {formatarData(c.data)}
                    </p>
                  </div>
                  <select
                    aria-label="Status"
                    value={c.status}
                    onChange={(e) => mudarStatus(c, e.target.value as StatusCandidatura)}
                    className={`rounded-full border-0 px-3 py-1 text-xs font-medium ${corStatus(c.status)}`}
                  >
                    {STATUS_CANDIDATURA.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(c.proximaAcao || c.observacoes) && (
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {c.proximaAcao && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-tinta/50">Próxima ação</dt>
                        <dd>{c.proximaAcao}</dd>
                      </div>
                    )}
                    {c.observacoes && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-tinta/50">Observações</dt>
                        <dd className="whitespace-pre-line">{c.observacoes}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tinta/60">
                  {vaga && (
                    <span>
                      Vaga:{" "}
                      {ehLinkSeguro(vaga.link) ? (
                        <a href={vaga.link} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                          {vaga.titulo}
                        </a>
                      ) : (
                        vaga.titulo
                      )}
                    </span>
                  )}
                  {cv && (
                    <span>
                      Currículo enviado:{" "}
                      <Link href={`/curriculos/${cv.id}`} className="text-marca underline">
                        {cv.nome}
                      </Link>
                    </span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <Botao variante="fantasma" className="!py-1" onClick={() => abrirEdicao(c)}>
                      Editar
                    </Botao>
                    <Botao variante="fantasma" className="!py-1 text-red-700" onClick={() => excluir(c)}>
                      Excluir
                    </Botao>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        titulo={editando === "novo" ? "Nova candidatura" : "Editar candidatura"}
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
      >
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          {vagas.length > 0 && (
            <Campo rotulo="Vaga do histórico (opcional)" className="sm:col-span-2">
              <select className={classeCampo} value={form.vagaId} onChange={(e) => escolherVaga(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.titulo} · {v.empresa}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Empresa *">
            <input className={classeCampo} required value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
          </Campo>
          <Campo rotulo="Cargo *">
            <input className={classeCampo} required value={form.cargo} onChange={(e) => set("cargo", e.target.value)} />
          </Campo>
          <Campo rotulo="Data da candidatura">
            <input type="date" className={classeCampo} value={form.data} onChange={(e) => set("data", e.target.value)} />
          </Campo>
          <Campo rotulo="Status">
            <select
              className={classeCampo}
              value={form.status}
              onChange={(e) => set("status", e.target.value as StatusCandidatura)}
            >
              {STATUS_CANDIDATURA.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Próxima ação" className="sm:col-span-2">
            <input
              className={classeCampo}
              placeholder="Ex.: enviar e-mail de acompanhamento na sexta"
              value={form.proximaAcao}
              onChange={(e) => set("proximaAcao", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Observações" className="sm:col-span-2">
            <textarea
              rows={3}
              className={classeCampo}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </Campo>
          {curriculos.length > 0 && (
            <Campo rotulo="Versão do currículo enviada" className="sm:col-span-2">
              <select className={classeCampo} value={form.curriculoId} onChange={(e) => set("curriculoId", e.target.value)}>
                <option value="">— Não informado —</option>
                {curriculos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <div className="sm:col-span-2">
            <Erro mensagem={erro} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Botao onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao type="submit" variante="primario">
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Contador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tinta/50">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
