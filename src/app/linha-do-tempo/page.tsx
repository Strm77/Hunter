"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ehLinkSeguro, formatarData, hojeISO } from "@/lib/api";
import type { Atividade, Candidatura, EventoHistorico, StatusCandidatura, TipoEvento, Vaga } from "@/lib/types";
import { Cabecalho, Erro, Vazio, classeCampo } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";

/**
 * Linha do tempo: quantas candidaturas foram feitas por dia e tudo o que aconteceu em cada dia.
 * As cores agrupam o status ATUAL de cada candidatura em quatro estágios.
 */

type Grupo = "aguardando" | "andamento" | "aprovada" | "encerrada";

const GRUPOS: { id: Grupo; rotulo: string; cor: string; status: StatusCandidatura[] }[] = [
  { id: "aguardando", rotulo: "Aguardando retorno", cor: "#257de0", status: ["Candidatada", "Em análise"] },
  { id: "andamento", rotulo: "Retorno ou entrevista", cor: "#f47230", status: ["Retorno recebido", "Entrevista"] },
  { id: "aprovada", rotulo: "Aprovada", cor: "#00b894", status: ["Aprovada"] },
  { id: "encerrada", rotulo: "Encerrada", cor: "#6a4ce2", status: ["Recusada", "Sem retorno", "Desisti"] },
];

const grupoDe = (s: StatusCandidatura): Grupo => GRUPOS.find((g) => g.status.includes(s))?.id ?? "aguardando";

const PERIODOS = [
  { id: "14", rotulo: "14 dias", dias: 14 },
  { id: "30", rotulo: "30 dias", dias: 30 },
  { id: "90", rotulo: "90 dias", dias: 90 },
  { id: "tudo", rotulo: "Tudo", dias: 0 },
] as const;
type Periodo = (typeof PERIODOS)[number]["id"];

const ICONE: Record<TipoEvento | "atividade", string> = {
  Status: "●",
  Envio: "➜",
  Contato: "✉",
  Entrevista: "☎",
  Nota: "✎",
  Alteração: "↺",
  atividade: "◆",
};

interface Registro {
  chave: string;
  dia: string;
  hora: string; // HH:MM local, quando houver
  ordem: string;
  icone: string;
  titulo: string;
  descricao: string;
  sobre: string; // a candidatura ou vaga a que se refere
  link: string;
  autor: string;
}

interface Dados {
  candidaturas: Candidatura[];
  vagas: Vaga[];
  curriculos: { id: string; nome: string }[];
  atividades: Atividade[];
}

// ---------- datas (sempre no fuso de quem está vendo) ----------

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const somarDias = (s: string, n: number) => {
  const d = deISO(s);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
const diaDe = (registradoEm: string) => (registradoEm ? isoLocal(new Date(registradoEm)) : "");
const horaDe = (registradoEm: string) => {
  if (!registradoEm) return "";
  const d = new Date(registradoEm);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (s: string) => SEMANA[deISO(s).getDay()];
const nomeDia = (s: string) => {
  const t = deISO(s).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function tituloEvento(ev: EventoHistorico) {
  if (ev.tipo === "Status") return ev.de ? `Status: ${ev.de} → ${ev.para}` : `Status: ${ev.para}`;
  if (ev.tipo === "Alteração") return "Dados alterados";
  return ev.tipo;
}

export default function LinhaDoTempoPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [busca, setBusca] = useState("");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [dica, setDica] = useState<{ dia: string; x: number; largura: number } | null>(null);

  useEffect(() => {
    fetch("/api/linha-do-tempo", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`);
        return r.json();
      })
      .then(setDados)
      .catch((e) => setErro(e.message));
  }, []);

  const hoje = hojeISO();
  const rolagem = useRef<HTMLDivElement>(null);

  const vagaPorId = useMemo(() => new Map((dados?.vagas ?? []).map((v) => [v.id, v])), [dados]);
  const cvPorId = useMemo(() => new Map((dados?.curriculos ?? []).map((c) => [c.id, c])), [dados]);

  const candidaturas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.candidaturas ?? []).filter(
      (c) => !termo || `${c.empresa} ${c.cargo}`.toLowerCase().includes(termo),
    );
  }, [dados, busca]);

  // Todos os registros (histórico das candidaturas + registro geral), agrupados por dia.
  const registrosPorDia = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    const add = (r: Registro) => {
      if (!r.dia) return;
      mapa.set(r.dia, [...(mapa.get(r.dia) ?? []), r]);
    };
    const termo = busca.trim().toLowerCase();
    for (const c of candidaturas) {
      const vaga = vagaPorId.get(c.vagaId);
      for (const ev of c.historico ?? []) {
        add({
          chave: `${c.id}-${ev.id}`,
          dia: ev.data,
          hora: horaDe(ev.registradoEm),
          ordem: ev.registradoEm,
          icone: ICONE[ev.tipo],
          titulo: tituloEvento(ev),
          descricao: ev.descricao,
          sobre: `${c.cargo} · ${c.empresa}`,
          link: vaga?.link ?? "",
          autor: ev.autor,
        });
      }
    }
    for (const a of dados?.atividades ?? []) {
      if (termo && !a.descricao.toLowerCase().includes(termo)) continue;
      add({
        chave: a.id,
        dia: diaDe(a.registradoEm) || a.data,
        hora: horaDe(a.registradoEm),
        ordem: a.registradoEm,
        icone: ICONE.atividade,
        titulo: a.acao,
        descricao: a.descricao,
        sobre: "",
        link: a.link,
        autor: a.autor,
      });
    }
    mapa.forEach((lista) => lista.sort((x, y) => x.ordem.localeCompare(y.ordem)));
    return mapa;
  }, [candidaturas, dados, vagaPorId, busca]);

  const inscricoesPorDia = useMemo(() => {
    const mapa = new Map<string, Candidatura[]>();
    for (const c of candidaturas) mapa.set(c.data, [...(mapa.get(c.data) ?? []), c]);
    mapa.forEach((l) => l.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)));
    return mapa;
  }, [candidaturas]);

  // Dias do período, do mais antigo ao mais recente (inclui dias sem nada, para a régua ficar contínua).
  const dias = useMemo(() => {
    const p = PERIODOS.find((x) => x.id === periodo)!;
    let inicio: string;
    if (p.dias) inicio = somarDias(hoje, -(p.dias - 1));
    else {
      const todas = [...inscricoesPorDia.keys(), ...registrosPorDia.keys()].sort();
      inicio = todas[0] && todas[0] < hoje ? todas[0] : somarDias(hoje, -13);
    }
    const lista: string[] = [];
    for (let d = inicio; d <= hoje && lista.length < 1000; d = somarDias(d, 1)) lista.push(d);
    return lista;
  }, [periodo, hoje, inscricoesPorDia, registrosPorDia]);

  const porDia = useMemo(
    () =>
      dias.map((dia) => {
        const lista = inscricoesPorDia.get(dia) ?? [];
        const contagem = Object.fromEntries(GRUPOS.map((g) => [g.id, 0])) as Record<Grupo, number>;
        lista.forEach((c) => contagem[grupoDe(c.status)]++);
        return { dia, total: lista.length, contagem, registros: registrosPorDia.get(dia)?.length ?? 0 };
      }),
    [dias, inscricoesPorDia, registrosPorDia],
  );

  const resumo = useMemo(() => {
    const total = porDia.reduce((s, d) => s + d.total, 0);
    const ativos = porDia.filter((d) => d.total > 0).length;
    const melhor = porDia.reduce((m, d) => (d.total > (m?.total ?? 0) ? d : m), null as (typeof porDia)[number] | null);
    const registros = porDia.reduce((s, d) => s + d.registros, 0);
    return { total, ativos, melhor, registros, media: porDia.length ? total / porDia.length : 0 };
  }, [porDia]);

  const maximo = Math.max(1, ...porDia.map((d) => d.total));
  const escala = escalaEixo(maximo);

  const diasNaLista = useMemo(
    () =>
      [...porDia]
        .reverse()
        .filter((d) => d.total > 0 || d.registros > 0)
        .filter((d) => !diaSelecionado || d.dia === diaSelecionado),
    [porDia, diaSelecionado],
  );

  function selecionar(dia: string) {
    setDiaSelecionado((atual) => (atual === dia ? null : dia));
  }

  function mostrarDica(barra: HTMLElement, dia: string) {
    const pai = barra.closest("[data-grafico]")!.getBoundingClientRect();
    const r = barra.getBoundingClientRect();
    setDica({ dia, x: r.left - pai.left + r.width / 2, largura: pai.width });
  }

  function alternar(id: string) {
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // No celular o gráfico rola de lado: começa mostrando os dias mais recentes.
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [dias.length, dados]);

  const dicaDia = dica && porDia.find((d) => d.dia === dica.dia);
  const larguraBarra = dias.length <= 14 ? 36 : dias.length <= 31 ? 20 : 10;

  return (
    <>
      <Cabecalho
        titulo="Linha do tempo"
        descricao="Quantas candidaturas foram feitas por dia e tudo o que foi registrado em cada dia."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map((p) => {
            const ativo = periodo === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPeriodo(p.id);
                  setDiaSelecionado(null);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  ativo ? "border-marca bg-marca text-white" : "border-black/10 bg-white hover:bg-black/5"
                }`}
              >
                {p.rotulo}
              </button>
            );
          })}
        </div>
        <input
          className={`${classeCampo} sm:w-64`}
          placeholder="Filtrar por empresa ou cargo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Erro mensagem={erro} />

      {!dados && !erro ? (
        <p className="text-sm text-tinta/50">Carregando…</p>
      ) : dados ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Contador rotulo="Candidaturas no período" valor={String(resumo.total)} />
            <Contador
              rotulo="Média por dia"
              valor={resumo.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            />
            <Contador
              rotulo="Melhor dia"
              valor={resumo.melhor ? String(resumo.melhor.total) : "—"}
              detalhe={resumo.melhor ? formatarData(resumo.melhor.dia) : ""}
            />
            <Contador
              rotulo="Dias com candidatura"
              valor={String(resumo.ativos)}
              detalhe={`${resumo.registros} registros no período`}
            />
          </div>

          <section className="mb-6 rounded-xl border border-black/10 bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Candidaturas por dia</h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta/70">
                {GRUPOS.map((g) => (
                  <li key={g.id} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.cor }} />
                    {g.rotulo}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mb-3 text-xs text-tinta/50">
              Cor = status atual de cada candidatura. Clique num dia para ver só ele na lista abaixo.
            </p>

            <div className="relative mt-7" data-grafico onMouseLeave={() => setDica(null)}>
              <div className="flex">
                {/* eixo */}
                <div className="relative mr-2 h-44 w-6 shrink-0 text-right text-[10px] tabular-nums text-tinta/40">
                  {escala.map((v) => (
                    <span key={v} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(v / escala.at(-1)!) * 100}%` }}>
                      {v}
                    </span>
                  ))}
                </div>
                <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto pb-1">
                  <div className="relative" style={{ minWidth: dias.length * (larguraBarra + 4) }}>
                    {/* grade */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-44">
                      {escala.map((v) => (
                        <div
                          key={v}
                          className={`absolute inset-x-0 border-t ${v === 0 ? "border-black/20" : "border-black/5"}`}
                          style={{ bottom: `${(v / escala.at(-1)!) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="relative flex h-44 items-end gap-1">
                      {porDia.map((d) => {
                        const altura = (d.total / escala.at(-1)!) * 100;
                        const selecionado = diaSelecionado === d.dia;
                        const apagado = diaSelecionado && !selecionado;
                        return (
                          <button
                            key={d.dia}
                            type="button"
                            aria-label={`${formatarData(d.dia)}: ${d.total} candidatura(s), ${d.registros} registro(s)`}
                            onClick={() => selecionar(d.dia)}
                            onMouseEnter={(e) => mostrarDica(e.currentTarget, d.dia)}
                            onFocus={(e) => mostrarDica(e.currentTarget, d.dia)}
                            onBlur={() => setDica(null)}
                            className={`group relative flex h-full shrink-0 flex-col justify-end rounded-t-md transition ${
                              selecionado ? "bg-marca-claro" : "hover:bg-black/[0.04]"
                            } ${apagado ? "opacity-35" : ""}`}
                            style={{ flex: "1 1 0", minWidth: larguraBarra, maxWidth: 56 }}
                          >
                            {d.total > 0 && larguraBarra >= 20 && (
                              <span
                                className="absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums text-tinta/70"
                                style={{ bottom: `calc(${altura}% + 2px)` }}
                              >
                                {d.total}
                              </span>
                            )}
                            <span
                              className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                              style={{ height: `${altura}%` }}
                            >
                              {GRUPOS.filter((g) => d.contagem[g.id] > 0).map((g) => (
                                <span key={g.id} style={{ flexGrow: d.contagem[g.id], background: g.cor }} />
                              ))}
                            </span>
                            {d.total === 0 && d.registros > 0 && (
                              <span className="mx-auto mb-[-3px] h-1.5 w-1.5 rounded-full bg-tinta/30" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* datas */}
                    <div className="mt-1 flex gap-1 text-[10px] text-tinta/50">
                      {porDia.map((d, i) => {
                        const passo = dias.length <= 14 ? 1 : dias.length <= 31 ? 3 : 7;
                        const mostrar = (dias.length - 1 - i) % passo === 0;
                        return (
                          <span
                            key={d.dia}
                            className="whitespace-nowrap text-center"
                            style={{ flex: "1 1 0", minWidth: larguraBarra, maxWidth: 56 }}
                          >
                            {mostrar ? (
                              <>
                                {d.dia.slice(8)}/{d.dia.slice(5, 7)}
                                {dias.length <= 14 && <span className="block text-tinta/35">{diaSemana(d.dia)}</span>}
                              </>
                            ) : (
                              ""
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {dicaDia && dica && (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-black/10 bg-white p-3 text-xs shadow-lg"
                  style={{ left: dica.x + 232 < dica.largura ? dica.x + 20 : dica.x - 228 }}
                >
                  <p className="font-semibold ">{nomeDia(dicaDia.dia)}</p>
                  <p className="mt-1 text-tinta/70">
                    {dicaDia.total} candidatura{dicaDia.total === 1 ? "" : "s"} · {dicaDia.registros} registro
                    {dicaDia.registros === 1 ? "" : "s"}
                  </p>
                  {dicaDia.total > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {GRUPOS.filter((g) => dicaDia.contagem[g.id] > 0).map((g) => (
                        <li key={g.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: g.cor }} />
                            {g.rotulo}
                          </span>
                          <span className="tabular-nums">{dicaDia.contagem[g.id]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Dia a dia</h2>
            {diaSelecionado && (
              <button onClick={() => setDiaSelecionado(null)} className="text-sm text-marca underline">
                Mostrar todos os dias do período
              </button>
            )}
          </div>

          {diasNaLista.length === 0 ? (
            <Vazio>
              {dados.candidaturas.length === 0 && dados.atividades.length === 0
                ? "Nada registrado ainda. As candidaturas e os passos de cada uma aparecem aqui, dia a dia."
                : "Nada registrado nesse período."}
            </Vazio>
          ) : (
            <ol className="relative space-y-6 border-l-2 border-marca/20 pl-6 sm:pl-8">
              {diasNaLista.map((d) => {
                const inscricoes = inscricoesPorDia.get(d.dia) ?? [];
                const registros = registrosPorDia.get(d.dia) ?? [];
                return (
                  <li key={d.dia} className="relative">
                    <span
                      className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-marca ring-4 ring-papel sm:-left-[41px]"
                      aria-hidden
                    />
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-semibold ">{nomeDia(d.dia)}</h3>
                      {d.dia === hoje && <span className="text-xs font-medium text-marca">hoje</span>}
                      <span className="rounded-full bg-marca px-2.5 py-0.5 text-xs font-semibold text-white">
                        {d.total} candidatura{d.total === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-tinta/50">
                        {d.registros} registro{d.registros === 1 ? "" : "s"}
                      </span>
                    </div>

                    {inscricoes.length > 0 && (
                      <ul className="mb-3 space-y-2">
                        {inscricoes.map((c) => {
                          const vaga = vagaPorId.get(c.vagaId);
                          const cvVivo = cvPorId.get(c.curriculoId);
                          const grupo = GRUPOS.find((g) => g.id === grupoDe(c.status))!;
                          const aberta = abertas.has(c.id);
                          return (
                            <li
                              key={c.id}
                              className="rounded-xl border border-black/10 border-l-4 bg-white p-3 sm:p-4"
                              style={{ borderLeftColor: grupo.cor }}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold">{c.cargo}</p>
                                  <p className="text-sm text-tinta/70">{c.empresa}</p>
                                </div>
                                <StatusBadge status={c.status} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta/60">
                                {vaga && ehLinkSeguro(vaga.link) ? (
                                  <a
                                    href={vaga.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-marca underline"
                                  >
                                    Abrir vaga{vaga.codigoLinkedin ? " no LinkedIn" : ""}
                                  </a>
                                ) : (
                                  <span>Sem link da vaga</span>
                                )}
                                {c.curriculoEnviado ? (
                                  <Link href={`/candidaturas/${c.id}/curriculo`} className="text-marca underline">
                                    Currículo enviado: {c.curriculoEnviado.curriculo.nome}
                                  </Link>
                                ) : cvVivo ? (
                                  <Link href={`/curriculos/${cvVivo.id}`} className="text-marca underline">
                                    Currículo: {cvVivo.nome}
                                  </Link>
                                ) : (
                                  <span>Currículo não informado</span>
                                )}
                                {c.proximaAcao && <span>Próxima ação: {c.proximaAcao}</span>}
                                <button
                                  type="button"
                                  onClick={() => alternar(c.id)}
                                  className="ml-auto font-medium text-tinta/70 hover:text-tinta"
                                  aria-expanded={aberta}
                                >
                                  {aberta ? "Esconder" : "Ver"} histórico completo ({c.historico?.length ?? 0})
                                </button>
                              </div>
                              {aberta && (
                                <ol className="mt-3 space-y-2 border-t border-black/10 pt-3">
                                  {(c.historico ?? []).map((ev) => (
                                    <li key={ev.id} className="flex gap-2 text-sm">
                                      <span className="w-4 shrink-0 text-center text-marca">{ICONE[ev.tipo]}</span>
                                      <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap justify-between gap-x-2">
                                          <span className="font-medium">{tituloEvento(ev)}</span>
                                          <span className="text-xs text-tinta/50">
                                            {formatarData(ev.data)}
                                            {horaDe(ev.registradoEm) && ` · registrado ${formatarData(diaDe(ev.registradoEm))} ${horaDe(ev.registradoEm)}`}
                                          </span>
                                        </p>
                                        {ev.descricao && (
                                          <p className="whitespace-pre-line text-tinta/75">{ev.descricao}</p>
                                        )}
                                        {ev.autor && <p className="text-xs text-tinta/40">por {ev.autor}</p>}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {registros.length > 0 && (
                      <details className="rounded-xl border border-black/10 bg-white/70" open={Boolean(diaSelecionado) || inscricoes.length === 0}>
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-tinta/80 sm:px-4">
                          Tudo o que foi feito neste dia ({registros.length})
                        </summary>
                        <ol className="space-y-2 px-3 pb-3 sm:px-4">
                          {registros.map((r) => (
                            <li key={r.chave} className="flex gap-2 text-sm">
                              <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-tinta/40">{r.hora}</span>
                              <span className="w-4 shrink-0 text-center text-marca">{r.icone}</span>
                              <div className="min-w-0 flex-1">
                                <p>
                                  <span className="font-medium">{r.titulo}</span>
                                  {r.sobre && <span className="text-tinta/60"> · {r.sobre}</span>}
                                </p>
                                {r.descricao && <p className="whitespace-pre-line text-tinta/70">{r.descricao}</p>}
                                <p className="flex flex-wrap gap-x-3 text-xs text-tinta/40">
                                  {r.autor && <span>por {r.autor}</span>}
                                  {ehLinkSeguro(r.link) && (
                                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                                      link da vaga
                                    </a>
                                  )}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}
    </>
  );
}

/** Marcas do eixo: 0 e mais 2 a 4 valores inteiros, terminando num número redondo acima do máximo. */
function escalaEixo(maximo: number): number[] {
  const passo = maximo <= 4 ? 1 : maximo <= 10 ? 2 : maximo <= 25 ? 5 : Math.ceil(maximo / 4 / 5) * 5;
  const topo = Math.ceil(maximo / passo) * passo;
  const marcas: number[] = [];
  for (let v = 0; v <= topo; v += passo) marcas.push(v);
  return marcas;
}

function Contador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tinta/50">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{valor}</p>
      {detalhe && <p className="text-xs text-tinta/50">{detalhe}</p>}
    </div>
  );
}
