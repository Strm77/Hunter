"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ehLinkSeguro, formatarData, hojeISO } from "@/lib/api";
import { Candidatura, Curriculo, Vaga } from "@/lib/types";
import { Botao, Cabecalho, Campo, Erro, Modal, Vazio, classeCampo } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";

type Form = Pick<Vaga, "titulo" | "empresa" | "link" | "salvaEm" | "notas">;

const formVazio = (): Form => ({ titulo: "", empresa: "", link: "", salvaEm: hojeISO(), notas: "" });

export default function VagasPage() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [curriculos, setCurriculos] = useState<Curriculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio());
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [v, c, cv] = await Promise.all([
      api.listar<Vaga>("vagas"),
      api.listar<Candidatura>("candidaturas"),
      api.listar<Curriculo>("curriculos"),
    ]);
    setVagas(v);
    setCandidaturas(c);
    setCurriculos(cv);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return vagas
      .filter((v) => !t || `${v.titulo} ${v.empresa} ${v.notas}`.toLowerCase().includes(t))
      .sort((a, b) => b.salvaEm.localeCompare(a.salvaEm) || b.criadoEm.localeCompare(a.criadoEm));
  }, [vagas, busca]);

  function abrir(v?: Vaga) {
    setErro("");
    setForm(v ? { titulo: v.titulo, empresa: v.empresa, link: v.link, salvaEm: v.salvaEm, notas: v.notas } : formVazio());
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

  async function excluir(v: Vaga) {
    if (!confirm(`Excluir a vaga “${v.titulo}” do histórico? Candidaturas e currículos ligados a ela ficam sem vínculo.`))
      return;
    await api.remover("vagas", v.id);
    await carregar();
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Cabecalho
        titulo="Histórico de vagas"
        descricao="Vagas salvas, com o link da publicação original no LinkedIn."
        acao={<Botao variante="primario" onClick={() => abrir()}>+ Salvar vaga</Botao>}
      />

      <input
        className={`${classeCampo} mb-4 sm:w-72`}
        placeholder="Buscar título, empresa ou nota"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {!editando && <Erro mensagem={erro} />}

      {carregando ? (
        <p className="text-sm text-tinta/50">Carregando…</p>
      ) : vagas.length === 0 ? (
        <Vazio>Nenhuma vaga salva ainda. Cole aqui o link das vagas que interessarem no LinkedIn.</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>Nenhuma vaga encontrada.</Vazio>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visiveis.map((v) => {
            const cands = candidaturas.filter((c) => c.vagaId === v.id);
            const cvs = curriculos.filter((c) => c.vagaId === v.id);
            return (
              <li key={v.id} className="flex flex-col rounded-xl border border-black/10 bg-white p-4">
                <p className="font-semibold">{v.titulo}</p>
                <p className="text-sm text-tinta/70">
                  {v.empresa} · salva em {formatarData(v.salvaEm)}
                </p>
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
                <div className="mt-auto flex justify-end gap-1 pt-3">
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
          <Campo rotulo="Link da publicação no LinkedIn" className="sm:col-span-2">
            <input
              type="url"
              className={classeCampo}
              placeholder="https://www.linkedin.com/jobs/view/…"
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Salva em">
            <input type="date" className={classeCampo} value={form.salvaEm} onChange={(e) => set("salvaEm", e.target.value)} />
          </Campo>
          <Campo rotulo="Notas" className="sm:col-span-2">
            <textarea rows={4} className={classeCampo} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
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
    </>
  );
}
