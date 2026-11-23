"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatarData } from "@/lib/api";
import { Candidatura, Curriculo, ItemSelecionado, Perfil, Vaga } from "@/lib/types";
import { Botao, Cabecalho, Campo, Erro, Modal, Vazio, classeCampo } from "@/components/ui";

const todos = (lista: { id: string }[]): ItemSelecionado[] => lista.map((x) => ({ refId: x.id, destaque: false }));

export default function CurriculosPage() {
  const router = useRouter();
  const [curriculos, setCurriculos] = useState<Curriculo[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [vagaId, setVagaId] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [c, v, ca, p] = await Promise.all([
      api.listar<Curriculo>("curriculos"),
      api.listar<Vaga>("vagas"),
      api.listar<Candidatura>("candidaturas"),
      api.perfil<Perfil>(),
    ]);
    setCurriculos(c);
    setVagas(v);
    setCandidaturas(ca);
    setPerfil(p);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  const vagaPorId = useMemo(() => new Map(vagas.map((v) => [v.id, v])), [vagas]);

  const perfilVazio =
    perfil &&
    !perfil.pessoais.nome &&
    !perfil.resumo &&
    perfil.experiencias.length + perfil.formacoes.length + perfil.certificacoes.length + perfil.habilidades.length === 0;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    try {
      const novo = await api.criar<Curriculo>("curriculos", {
        nome,
        vagaId,
        incluirResumo: true,
        experiencias: todos(perfil.experiencias),
        formacoes: todos(perfil.formacoes),
        certificacoes: todos(perfil.certificacoes),
        habilidades: todos(perfil.habilidades),
      });
      router.push(`/curriculos/${novo.id}`);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function excluir(c: Curriculo) {
    if (!confirm(`Excluir a versão “${c.nome}”?`)) return;
    await api.remover("curriculos", c.id);
    await carregar();
  }

  function abrirCriacao() {
    setErro("");
    setNome("");
    setVagaId("");
    setCriando(true);
  }

  function escolherVaga(id: string) {
    setVagaId(id);
    const v = vagaPorId.get(id);
    if (v && !nome) setNome(`${v.titulo} · ${v.empresa}`);
  }

  return (
    <>
      <Cabecalho
        titulo="Currículos por vaga"
        descricao="Versões do currículo-base para cada vaga. Elas só escolhem, reordenam e destacam o que já está no perfil."
        acao={
          <Botao variante="primario" onClick={abrirCriacao} disabled={!perfil}>
            + Nova versão
          </Botao>
        }
      />

      {perfilVazio && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          O perfil ainda está vazio. <Link href="/perfil" className="underline">Preencha o currículo-base</Link> antes de criar
          versões.
        </p>
      )}

      {!criando && <Erro mensagem={erro} />}

      {curriculos.length === 0 ? (
        <Vazio>Nenhuma versão criada ainda.</Vazio>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {curriculos
            .slice()
            .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
            .map((c) => {
              const vaga = vagaPorId.get(c.vagaId);
              const usadas = candidaturas.filter((x) => x.curriculoId === c.id);
              return (
                <li key={c.id} className="flex flex-col rounded-xl border border-black/10 bg-white p-4">
                  <Link href={`/curriculos/${c.id}`} className="font-semibold hover:underline">
                    {c.nome}
                  </Link>
                  <p className="text-sm text-tinta/70">
                    {vaga ? `Vaga: ${vaga.titulo} · ${vaga.empresa}` : "Sem vaga vinculada"}
                  </p>
                  <p className="mt-2 text-xs">
                    {c.enviadaEm ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                        Enviada em {formatarData(c.enviadaEm)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Ainda não enviada</span>
                    )}
                    {usadas.length > 0 && (
                      <span className="ml-2 text-tinta/60">
                        usada em {usadas.length} candidatura{usadas.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <div className="mt-auto flex justify-end gap-1 pt-3">
                    <Link href={`/curriculos/${c.id}`} className="rounded-md px-3 py-1 text-sm font-medium hover:bg-black/5">
                      Abrir
                    </Link>
                    <Botao variante="fantasma" className="!py-1 text-red-700" onClick={() => excluir(c)}>
                      Excluir
                    </Botao>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <Modal titulo="Nova versão do currículo" aberto={criando} aoFechar={() => setCriando(false)}>
        <form onSubmit={criar} className="space-y-4">
          <Campo rotulo="Vaga">
            <select className={classeCampo} value={vagaId} onChange={(e) => escolherVaga(e.target.value)}>
              <option value="">— Sem vaga (genérica) —</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo} · {v.empresa}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Nome da versão *">
            <input className={classeCampo} required value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <p className="text-xs text-tinta/60">
            A versão começa com todos os itens do currículo-base. Depois você escolhe o que entra, em que ordem e o que destacar.
          </p>
          <Erro mensagem={erro} />
          <div className="flex justify-end gap-2">
            <Botao onClick={() => setCriando(false)}>Cancelar</Botao>
            <Botao type="submit" variante="primario">
              Criar e editar
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
