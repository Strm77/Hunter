"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MODALIDADES, Modalidade, Tema, Vaga } from "@/lib/types";
import { Botao, Cabecalho, Campo, Erro, Modal, Vazio, classeCampo } from "@/components/ui";

type Form = {
  nome: string;
  palavrasChave: string;
  excluir: string;
  local: string;
  modalidade: Modalidade | "";
  senioridade: string;
  ativo: boolean;
};

const formVazio = (): Form => ({
  nome: "",
  palavrasChave: "",
  excluir: "",
  local: "",
  modalidade: "",
  senioridade: "",
  ativo: true,
});

export default function TemasPage() {
  const [temas, setTemas] = useState<Tema[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio());
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [t, v] = await Promise.all([api.listar<Tema>("temas"), api.listar<Vaga>("vagas")]);
    setTemas(t);
    setVagas(v);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  function abrir(t?: Tema) {
    setErro("");
    setForm(
      t
        ? {
            nome: t.nome,
            palavrasChave: t.palavrasChave.join(", "),
            excluir: t.excluir.join(", "),
            local: t.local,
            modalidade: t.modalidade,
            senioridade: t.senioridade,
            ativo: t.ativo,
          }
        : formVazio(),
    );
    setEditando(t ? t.id : "novo");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editando === "novo") await api.criar("temas", form);
      else if (editando) await api.atualizar("temas", editando, form);
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function alternar(t: Tema) {
    setTemas((lista) => lista.map((x) => (x.id === t.id ? { ...x, ativo: !t.ativo } : x)));
    try {
      await api.atualizar("temas", t.id, { ativo: !t.ativo });
    } catch (e) {
      setErro((e as Error).message);
      await carregar();
    }
  }

  async function excluir(t: Tema) {
    if (!confirm(`Excluir o tema “${t.nome}”? As vagas dele continuam no histórico, só sem tema.`)) return;
    await api.remover("temas", t.id);
    await carregar();
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ordenados = [...temas].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return (
    <>
      <Cabecalho
        titulo="Temas de busca"
        descricao="Os tipos de vaga que interessam. Cada vaga salva pode ser ligada a um tema."
        acao={<Botao variante="primario" onClick={() => abrir()}>+ Novo tema</Botao>}
      />

      {!editando && <Erro mensagem={erro} />}

      {carregando ? (
        <p className="text-sm text-tinta/50">Carregando…</p>
      ) : temas.length === 0 ? (
        <Vazio>Nenhum tema ainda. Crie um, por exemplo “Comunicação”, com as palavras que costumam aparecer nessas vagas.</Vazio>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {ordenados.map((t) => {
            const n = vagas.filter((v) => v.temaId === t.id).length;
            const filtros = [t.modalidade, t.local, t.senioridade].filter(Boolean);
            return (
              <li
                key={t.id}
                className={`flex flex-col rounded-xl border border-black/10 bg-white p-4 ${t.ativo ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.nome}</p>
                    {filtros.length > 0 && <p className="text-sm text-tinta/70">{filtros.join(" · ")}</p>}
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-tinta/70">
                    <input type="checkbox" checked={t.ativo} onChange={() => alternar(t)} />
                    {t.ativo ? "Ativo" : "Pausado"}
                  </label>
                </div>
                {t.palavrasChave.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.palavrasChave.map((p) => (
                      <span key={p} className="rounded-full bg-marca-claro px-2.5 py-0.5 text-xs text-marca">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {t.excluir.length > 0 && (
                  <p className="mt-2 text-xs text-tinta/60">Sem: {t.excluir.join(", ")}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-1 pt-3">
                  <Link href={`/vagas?tema=${t.id}`} className="text-sm text-marca underline">
                    {n === 1 ? "1 vaga" : `${n} vagas`}
                  </Link>
                  <span className="flex gap-1">
                    <Botao variante="fantasma" className="!py-1" onClick={() => abrir(t)}>
                      Editar
                    </Botao>
                    <Botao variante="fantasma" className="!py-1 text-red-700" onClick={() => excluir(t)}>
                      Excluir
                    </Botao>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal titulo={editando === "novo" ? "Novo tema" : "Editar tema"} aberto={editando !== null} aoFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do tema *" className="sm:col-span-2">
            <input
              className={classeCampo}
              required
              placeholder="Ex.: Comunicação"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Palavras-chave" dica="Separe por vírgula. Ex.: comunicação interna, assessoria de imprensa" className="sm:col-span-2">
            <input className={classeCampo} value={form.palavrasChave} onChange={(e) => set("palavrasChave", e.target.value)} />
          </Campo>
          <Campo rotulo="Termos a evitar" dica="Vagas com esses termos não interessam. Separe por vírgula." className="sm:col-span-2">
            <input className={classeCampo} value={form.excluir} onChange={(e) => set("excluir", e.target.value)} />
          </Campo>
          <Campo rotulo="Local">
            <input className={classeCampo} placeholder="Ex.: São Paulo" value={form.local} onChange={(e) => set("local", e.target.value)} />
          </Campo>
          <Campo rotulo="Modalidade">
            <select className={classeCampo} value={form.modalidade} onChange={(e) => set("modalidade", e.target.value as Modalidade | "")}>
              <option value="">Qualquer</option>
              {MODALIDADES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Senioridade">
            <input className={classeCampo} placeholder="Ex.: Pleno" value={form.senioridade} onChange={(e) => set("senioridade", e.target.value)} />
          </Campo>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            Tema ativo
          </label>
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
