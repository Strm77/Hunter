"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ehLinkSeguro, formatarData, hojeISO } from "@/lib/api";
import {
  Candidatura,
  Curriculo,
  MODALIDADES,
  Modalidade,
  ORIGENS_VAGA,
  OrigemVaga,
  SITUACOES_VAGA,
  SituacaoVaga,
  TIPOS_CANDIDATURA,
  Tema,
  TipoCandidatura,
  Vaga,
} from "@/lib/types";
import { Botao, Cabecalho, Campo, Erro, Modal, Vazio, classeCampo } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";

type Form = Pick<
  Vaga,
  | "titulo"
  | "empresa"
  | "link"
  | "salvaEm"
  | "notas"
  | "temaId"
  | "descricao"
  | "local"
  | "modalidade"
  | "origem"
  | "tipoCandidatura"
  | "situacao"
>;

const formVazio = (temaId = ""): Form => ({
  titulo: "",
  empresa: "",
  link: "",
  salvaEm: hojeISO(),
  notas: "",
  temaId,
  descricao: "",
  local: "",
  modalidade: "",
  origem: "Colada manualmente",
  tipoCandidatura: "Não sei",
  situacao: "Nova",
});

const COR_SITUACAO: Record<SituacaoVaga, string> = {
  Nova: "bg-sky-100 text-sky-800",
  "Em preparação": "bg-amber-100 text-amber-800",
  "Pronta para enviar": "bg-violet-100 text-violet-800",
  Candidatada: "bg-emerald-100 text-emerald-800",
  Descartada: "bg-stone-100 text-stone-600",
};

type Envio = { vagaId: string; curriculoId: string; data: string; observacoes: string };

export default function VagasPage() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [curriculos, setCurriculos] = useState<Curriculo[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTema, setFiltroTema] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoVaga | "Todas">("Todas");
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio());
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [v, c, cv, t] = await Promise.all([
      api.listar<Vaga>("vagas"),
      api.listar<Candidatura>("candidaturas"),
      api.listar<Curriculo>("curriculos"),
      api.listar<Tema>("temas"),
    ]);
    setVagas(v);
    setCandidaturas(c);
    setCurriculos(cv);
    setTemas(t);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // Vindo da aba Temas: /vagas?tema=<id>
    const tema = new URLSearchParams(window.location.search).get("tema");
    if (tema) setFiltroTema(tema);
    carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  const temaPorId = useMemo(() => new Map(temas.map((t) => [t.id, t])), [temas]);

  const doTema = useMemo(
    () => vagas.filter((v) => !filtroTema || (filtroTema === "sem" ? !v.temaId : v.temaId === filtroTema)),
    [vagas, filtroTema],
  );

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return doTema
      .filter((v) => filtroSituacao === "Todas" || v.situacao === filtroSituacao)
      .filter((v) => !t || `${v.titulo} ${v.empresa} ${v.notas} ${v.local}`.toLowerCase().includes(t))
      .sort((a, b) => b.salvaEm.localeCompare(a.salvaEm) || b.criadoEm.localeCompare(a.criadoEm));
  }, [doTema, busca, filtroSituacao]);

  function abrir(v?: Vaga) {
    setErro("");
    setForm(
      v
        ? {
            titulo: v.titulo,
            empresa: v.empresa,
            link: v.link,
            salvaEm: v.salvaEm,
            notas: v.notas,
            temaId: v.temaId,
            descricao: v.descricao,
            local: v.local,
            modalidade: v.modalidade,
            origem: v.origem,
            tipoCandidatura: v.tipoCandidatura,
            situacao: v.situacao,
          }
        : formVazio(filtroTema && filtroTema !== "sem" ? filtroTema : ""),
    );
    setEditando(v ? v.id : "novo");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (form.link && !ehLinkSeguro(form.link.trim())) {
      setErro("O link precisa começar com https:// (copie o endereço da vaga no LinkedIn).");
      return;
    }
    try {
      if (editando === "novo") await api.criar("vagas", form);
      else if (editando) await api.atualizar("vagas", editando, form);
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function mudarSituacao(v: Vaga, situacao: SituacaoVaga) {
    setVagas((lista) => lista.map((x) => (x.id === v.id ? { ...x, situacao } : x)));
    try {
      await api.atualizar("vagas", v.id, { situacao });
    } catch (e) {
      setErro((e as Error).message);
      await carregar();
    }
  }

  async function excluir(v: Vaga) {
    if (!confirm(`Excluir a vaga “${v.titulo}” do histórico? Candidaturas e currículos ligados a ela ficam sem vínculo.`))
      return;
    await api.remover("vagas", v.id);
    await carregar();
  }

  function abrirEnvio(v: Vaga) {
    setErro("");
    const daVaga = curriculos.filter((c) => c.vagaId === v.id);
    setEnvio({ vagaId: v.id, curriculoId: daVaga[0]?.id ?? "", data: hojeISO(), observacoes: "" });
  }

  async function confirmarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!envio) return;
    try {
      const r = await fetch("/api/marcar-enviada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envio),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`);
      setEnvio(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const vagaDoEnvio = envio ? vagas.find((v) => v.id === envio.vagaId) : undefined;
  const cvsOrdenados = envio
    ? [...curriculos].sort((a, b) => Number(b.vagaId === envio.vagaId) - Number(a.vagaId === envio.vagaId))
    : [];

  return (
    <>
      <Cabecalho
        titulo="Histórico de vagas"
        descricao="Vagas salvas, com o link da publicação original e a descrição completa."
        acao={<Botao variante="primario" onClick={() => abrir()}>+ Salvar vaga</Botao>}
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={`${classeCampo} sm:w-72`}
            placeholder="Buscar título, empresa, local ou nota"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {temas.length > 0 && (
            <select
              aria-label="Tema"
              className={`${classeCampo} sm:w-56`}
              value={filtroTema}
              onChange={(e) => setFiltroTema(e.target.value)}
            >
              <option value="">Todos os temas</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
              <option value="sem">Sem tema</option>
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["Todas", ...SITUACOES_VAGA] as const).map((s) => {
            const n = s === "Todas" ? doTema.length : doTema.filter((v) => v.situacao === s).length;
            const ativo = filtroSituacao === s;
            return (
              <button
                key={s}
                onClick={() => setFiltroSituacao(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  ativo ? "border-marca bg-marca text-white" : "border-black/10 bg-white hover:bg-black/5"
                }`}
              >
                {s} <span className={ativo ? "text-white/70" : "text-tinta/40"}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!editando && !envio && <Erro mensagem={erro} />}

      {carregando ? (
        <p className="text-sm text-tinta/50">Carregando…</p>
      ) : vagas.length === 0 ? (
        <Vazio>Nenhuma vaga salva ainda. Cole aqui o link e a descrição das vagas que interessarem.</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>Nenhuma vaga com esse filtro.</Vazio>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visiveis.map((v) => {
            const cands = candidaturas.filter((c) => c.vagaId === v.id);
            const cvs = curriculos.filter((c) => c.vagaId === v.id);
            const tema = temaPorId.get(v.temaId);
            const detalhes = [v.local, v.modalidade, v.tipoCandidatura !== "Não sei" && `Candidatura ${v.tipoCandidatura.toLowerCase()}`].filter(Boolean);
            return (
              <li key={v.id} className="flex flex-col rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{v.titulo}</p>
                    <p className="text-sm text-tinta/70">
                      {v.empresa} · salva em {formatarData(v.salvaEm)}
                    </p>
                  </div>
                  <select
                    aria-label="Situação"
                    value={v.situacao}
                    onChange={(e) => mudarSituacao(v, e.target.value as SituacaoVaga)}
                    className={`shrink-0 rounded-full border-0 px-3 py-1 text-xs font-medium ${COR_SITUACAO[v.situacao]}`}
                  >
                    {SITUACOES_VAGA.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(tema || detalhes.length > 0) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tinta/70">
                    {tema && <span className="rounded-full bg-marca-claro px-2.5 py-0.5 text-marca">{tema.nome}</span>}
                    {detalhes.join(" · ")}
                  </p>
                )}
                {ehLinkSeguro(v.link) ? (
                  <a
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 truncate text-sm text-marca underline"
                    title={v.link}
                  >
                    Abrir vaga original ↗
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-tinta/40">Sem link</p>
                )}
                {v.descricao && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-tinta/70">Descrição da vaga</summary>
                    <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line rounded-md bg-black/[0.03] p-3 text-[13px]">
                      {v.descricao}
                    </p>
                  </details>
                )}
                {v.notas && <p className="mt-2 whitespace-pre-line text-sm">{v.notas}</p>}
                {(cands.length > 0 || cvs.length > 0) && (
                  <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-xs text-tinta/70">
                    {cands.map((c) => (
                      <p key={c.id} className="flex items-center gap-2">
                        Candidatura em {formatarData(c.data)} <StatusBadge status={c.status} />
                      </p>
                    ))}
                    {cvs.map((c) => (
                      <p key={c.id}>
                        Currículo:{" "}
                        <Link href={`/curriculos/${c.id}`} className="text-marca underline">
                          {c.nome}
                        </Link>
                        {c.enviadaEm && ` · enviado em ${formatarData(c.enviadaEm)}`}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap justify-end gap-1 pt-3">
                  {cands.length === 0 && v.situacao !== "Descartada" && (
                    <Botao variante="secundario" className="!py-1" onClick={() => abrirEnvio(v)}>
                      Marcar como enviada
                    </Botao>
                  )}
                  <Botao variante="fantasma" className="!py-1" onClick={() => abrir(v)}>
                    Editar
                  </Botao>
                  <Botao variante="fantasma" className="!py-1 text-red-700" onClick={() => excluir(v)}>
                    Excluir
                  </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal titulo={editando === "novo" ? "Salvar vaga" : "Editar vaga"} aberto={editando !== null} aoFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Título da vaga *">
            <input className={classeCampo} required value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
          </Campo>
          <Campo rotulo="Empresa *">
            <input className={classeCampo} required value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
          </Campo>
          <Campo rotulo="Link da publicação" className="sm:col-span-2">
            <input
              type="url"
              className={classeCampo}
              placeholder="https://www.linkedin.com/jobs/view/…"
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Tema">
            <select className={classeCampo} value={form.temaId} onChange={(e) => set("temaId", e.target.value)}>
              <option value="">— Sem tema —</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Situação">
            <select className={classeCampo} value={form.situacao} onChange={(e) => set("situacao", e.target.value as SituacaoVaga)}>
              {SITUACOES_VAGA.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Local">
            <input className={classeCampo} value={form.local} onChange={(e) => set("local", e.target.value)} />
          </Campo>
          <Campo rotulo="Modalidade">
            <select className={classeCampo} value={form.modalidade} onChange={(e) => set("modalidade", e.target.value as Modalidade | "")}>
              <option value="">Não informada</option>
              {MODALIDADES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tipo de candidatura">
            <select
              className={classeCampo}
              value={form.tipoCandidatura}
              onChange={(e) => set("tipoCandidatura", e.target.value as TipoCandidatura)}
            >
              {TIPOS_CANDIDATURA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Origem">
            <select className={classeCampo} value={form.origem} onChange={(e) => set("origem", e.target.value as OrigemVaga)}>
              {ORIGENS_VAGA.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Salva em">
            <input type="date" className={classeCampo} value={form.salvaEm} onChange={(e) => set("salvaEm", e.target.value)} />
          </Campo>
          <Campo
            rotulo="Descrição da vaga"
            dica="Cole aqui o texto completo da publicação. Ele é usado para adaptar o currículo."
            className="sm:col-span-2"
          >
            <textarea rows={8} className={classeCampo} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </Campo>
          <Campo rotulo="Notas" className="sm:col-span-2">
            <textarea rows={3} className={classeCampo} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
          </Campo>
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

      <Modal titulo="Marcar como enviada" aberto={envio !== null} aoFechar={() => setEnvio(null)}>
        {envio && vagaDoEnvio && (
          <form onSubmit={confirmarEnvio} className="grid gap-4">
            <p className="text-sm text-tinta/70">
              Registre aqui depois de enviar a candidatura para <strong>{vagaDoEnvio.titulo}</strong> ({vagaDoEnvio.empresa}) pelo
              site da vaga. A candidatura entra no painel e a versão do currículo escolhida fica guardada como foi enviada.
            </p>
            <Campo rotulo="Versão do currículo enviada">
              <select
                className={classeCampo}
                value={envio.curriculoId}
                onChange={(e) => setEnvio({ ...envio, curriculoId: e.target.value })}
              >
                <option value="">— Não informado —</option>
                {cvsOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.vagaId === envio.vagaId ? " (desta vaga)" : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Data do envio">
              <input
                type="date"
                className={classeCampo}
                value={envio.data}
                onChange={(e) => setEnvio({ ...envio, data: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Observações">
              <textarea
                rows={3}
                className={classeCampo}
                value={envio.observacoes}
                onChange={(e) => setEnvio({ ...envio, observacoes: e.target.value })}
              />
            </Campo>
            <Erro mensagem={erro} />
            <div className="flex justify-end gap-2">
              <Botao onClick={() => setEnvio(null)}>Cancelar</Botao>
              <Botao type="submit" variante="primario">
                Registrar envio
              </Botao>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
