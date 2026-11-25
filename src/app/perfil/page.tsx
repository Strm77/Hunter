"use client";

import { InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { api, novoId } from "@/lib/api";
import { Certificacao, Experiencia, Formacao, Perfil, perfilVazio } from "@/lib/types";
import { Botao, Cabecalho, Campo, Cartao, Erro, classeCampo } from "@/components/ui";

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil>(perfilVazio());
  const [carregando, setCarregando] = useState(true);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [novaHabilidade, setNovaHabilidade] = useState("");
  const [importando, setImportando] = useState(false);
  const [importacao, setImportacao] = useState<{ resumo: string; avisos: string[] } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .perfil<Perfil>()
      .then((p) => setPerfil(p))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  function atualizar(fn: (p: Perfil) => Perfil) {
    setPerfil(fn);
    setAlterado(true);
    setMensagem("");
  }

  const setPessoal = (k: keyof Perfil["pessoais"], v: string) =>
    atualizar((p) => ({ ...p, pessoais: { ...p.pessoais, [k]: v } }));

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const salvo = await api.salvarPerfil<Perfil>(perfil);
      setPerfil(salvo);
      setAlterado(false);
      setMensagem("Perfil salvo.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function adicionarHabilidades() {
    const nomes = novaHabilidade
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!nomes.length) return;
    atualizar((p) => {
      const existentes = new Set(p.habilidades.map((h) => h.nome.toLowerCase()));
      const novas = nomes.filter((n) => !existentes.has(n.toLowerCase())).map((nome) => ({ id: novoId(), nome }));
      return { ...p, habilidades: [...p.habilidades, ...novas] };
    });
    setNovaHabilidade("");
  }

  async function importarPdf(arquivo: File) {
    setImportando(true);
    setErro("");
    setImportacao(null);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const r = await fetch("/api/perfil/importar", { method: "POST", body: corpo });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro ?? `Erro ${r.status}`);
      const lido = dados.perfil as Perfil;
      const { perfil: novo, resumo } = mesclarPerfil(perfil, lido);
      atualizar(() => novo);
      setImportacao({ resumo, avisos: dados.avisos ?? [] });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setImportando(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  if (carregando) return <p className="text-sm text-tinta/50">Carregando…</p>;

  const p = perfil.pessoais;

  return (
    <div className="pb-24">
      <Cabecalho
        titulo="Perfil profissional"
        descricao="Este é o currículo-base. Preencha à mão ou importe do PDF do seu currículo e revise; as versões por vaga só usam o que estiver cadastrado aqui."
      />
      <Erro mensagem={erro} />

      <Cartao className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Importar do PDF do currículo</h2>
            <p className="mt-1 text-sm text-tinta/60">
              O texto do PDF é separado nos campos abaixo. Nada é salvo até você revisar e clicar em “Salvar perfil”.
            </p>
          </div>
          <label className={`cursor-pointer rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca/90 ${importando ? "pointer-events-none opacity-60" : ""}`}>
            {importando ? "Lendo o PDF…" : "Escolher PDF"}
            <input
              ref={arquivoRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={importando}
              onChange={(e) => e.target.files?.[0] && importarPdf(e.target.files[0])}
            />
          </label>
        </div>
        {importacao && (
          <div className="mt-4 rounded-md bg-marca/10 px-3 py-2 text-sm">
            <p>{importacao.resumo} Revise os campos e clique em “Salvar perfil”.</p>
            {importacao.avisos.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-tinta/70">
                {importacao.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Cartao>

      <div className="space-y-5">
        <Cartao>
          <h2 className="mb-4 font-semibold">Dados pessoais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo">
              <input className={classeCampo} value={p.nome} onChange={(e) => setPessoal("nome", e.target.value)} />
            </Campo>
            <Campo rotulo="Título profissional" dica="Ex.: Analista de Marketing">
              <input className={classeCampo} value={p.titulo} onChange={(e) => setPessoal("titulo", e.target.value)} />
            </Campo>
            <Campo rotulo="E-mail">
              <input type="email" className={classeCampo} value={p.email} onChange={(e) => setPessoal("email", e.target.value)} />
            </Campo>
            <Campo rotulo="Telefone">
              <input className={classeCampo} value={p.telefone} onChange={(e) => setPessoal("telefone", e.target.value)} />
            </Campo>
            <Campo rotulo="Cidade / Estado">
              <input className={classeCampo} value={p.cidade} onChange={(e) => setPessoal("cidade", e.target.value)} />
            </Campo>
            <Campo rotulo="LinkedIn (URL)">
              <input
                type="url"
                className={classeCampo}
                placeholder="https://www.linkedin.com/in/…"
                value={p.linkedin}
                onChange={(e) => setPessoal("linkedin", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Portfólio / site (URL)" className="sm:col-span-2">
              <input
                type="url"
                className={classeCampo}
                placeholder="https://…"
                value={p.portfolio}
                onChange={(e) => setPessoal("portfolio", e.target.value)}
              />
            </Campo>
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-4 font-semibold">Resumo profissional</h2>
          <textarea
            rows={5}
            className={classeCampo}
            value={perfil.resumo}
            onChange={(e) => atualizar((x) => ({ ...x, resumo: e.target.value }))}
          />
        </Cartao>

        <ListaEditavel<Experiencia>
          titulo="Experiências"
          itens={perfil.experiencias}
          rotuloNovo="+ Adicionar experiência"
          novo={() => ({ id: novoId(), cargo: "", empresa: "", local: "", inicio: "", fim: "", atual: false, descricao: "" })}
          aoMudar={(lista) => atualizar((x) => ({ ...x, experiencias: lista }))}
          resumoItem={(e) => [e.cargo, e.empresa].filter(Boolean).join(" · ") || "Nova experiência"}
          render={(e, set) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Cargo">
                <input className={classeCampo} value={e.cargo} onChange={(ev) => set({ cargo: ev.target.value })} />
              </Campo>
              <Campo rotulo="Empresa">
                <input className={classeCampo} value={e.empresa} onChange={(ev) => set({ empresa: ev.target.value })} />
              </Campo>
              <Campo rotulo="Local">
                <input className={classeCampo} value={e.local} onChange={(ev) => set({ local: ev.target.value })} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Início">
                  <CampoMes className={classeCampo} value={e.inicio} onChange={(ev) => set({ inicio: ev.target.value })} />
                </Campo>
                <Campo rotulo="Fim">
                  <CampoMes
                    className={classeCampo}
                    value={e.fim}
                    disabled={e.atual}
                    onChange={(ev) => set({ fim: ev.target.value })}
                  />
                </Campo>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={e.atual} onChange={(ev) => set({ atual: ev.target.checked, fim: "" })} />
                Trabalho atual
              </label>
              <Campo rotulo="Atividades e resultados" dica="Uma linha por item." className="sm:col-span-2">
                <textarea rows={4} className={classeCampo} value={e.descricao} onChange={(ev) => set({ descricao: ev.target.value })} />
              </Campo>
            </div>
          )}
        />

        <ListaEditavel<Formacao>
          titulo="Formação"
          itens={perfil.formacoes}
          rotuloNovo="+ Adicionar formação"
          novo={() => ({ id: novoId(), curso: "", instituicao: "", inicio: "", fim: "", observacao: "" })}
          aoMudar={(lista) => atualizar((x) => ({ ...x, formacoes: lista }))}
          resumoItem={(f) => [f.curso, f.instituicao].filter(Boolean).join(" · ") || "Nova formação"}
          render={(f, set) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Curso">
                <input className={classeCampo} value={f.curso} onChange={(ev) => set({ curso: ev.target.value })} />
              </Campo>
              <Campo rotulo="Instituição">
                <input className={classeCampo} value={f.instituicao} onChange={(ev) => set({ instituicao: ev.target.value })} />
              </Campo>
              <Campo rotulo="Início">
                <CampoMes className={classeCampo} value={f.inicio} onChange={(ev) => set({ inicio: ev.target.value })} />
              </Campo>
              <Campo rotulo="Conclusão (ou previsão)">
                <CampoMes className={classeCampo} value={f.fim} onChange={(ev) => set({ fim: ev.target.value })} />
              </Campo>
              <Campo rotulo="Observação" className="sm:col-span-2">
                <input className={classeCampo} value={f.observacao} onChange={(ev) => set({ observacao: ev.target.value })} />
              </Campo>
            </div>
          )}
        />

        <ListaEditavel<Certificacao>
          titulo="Certificações"
          itens={perfil.certificacoes}
          rotuloNovo="+ Adicionar certificação"
          novo={() => ({ id: novoId(), nome: "", emissor: "", data: "", link: "" })}
          aoMudar={(lista) => atualizar((x) => ({ ...x, certificacoes: lista }))}
          resumoItem={(c) => [c.nome, c.emissor].filter(Boolean).join(" · ") || "Nova certificação"}
          render={(c, set) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome">
                <input className={classeCampo} value={c.nome} onChange={(ev) => set({ nome: ev.target.value })} />
              </Campo>
              <Campo rotulo="Emissor">
                <input className={classeCampo} value={c.emissor} onChange={(ev) => set({ emissor: ev.target.value })} />
              </Campo>
              <Campo rotulo="Data">
                <CampoMes className={classeCampo} value={c.data} onChange={(ev) => set({ data: ev.target.value })} />
              </Campo>
              <Campo rotulo="Link de verificação (opcional)">
                <input type="url" className={classeCampo} value={c.link} onChange={(ev) => set({ link: ev.target.value })} />
              </Campo>
            </div>
          )}
        />

        <Cartao>
          <h2 className="mb-4 font-semibold">Habilidades</h2>
          {perfil.habilidades.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {perfil.habilidades.map((h) => (
                <li key={h.id} className="flex items-center gap-1 rounded-full bg-marca-claro py-1 pl-3 pr-1 text-sm text-marca">
                  {h.nome}
                  <button
                    aria-label={`Remover ${h.nome}`}
                    className="rounded-full px-1.5 hover:bg-marca/10"
                    onClick={() => atualizar((x) => ({ ...x, habilidades: x.habilidades.filter((y) => y.id !== h.id) }))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              className={classeCampo}
              placeholder="Digite e pressione Enter (separe várias por vírgula)"
              value={novaHabilidade}
              onChange={(e) => setNovaHabilidade(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarHabilidades();
                }
              }}
            />
            <Botao onClick={adicionarHabilidades}>Adicionar</Botao>
          </div>
        </Cartao>
      </div>

      <div className="nao-imprimir fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <span className="text-sm text-tinta/60">{alterado ? "Alterações não salvas" : mensagem}</span>
          <Botao variante="primario" onClick={salvar} disabled={!alterado || salvando}>
            {salvando ? "Salvando…" : "Salvar perfil"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function ListaEditavel<T extends { id: string }>({
  titulo,
  itens,
  novo,
  rotuloNovo,
  aoMudar,
  render,
  resumoItem,
}: {
  titulo: string;
  itens: T[];
  novo: () => T;
  rotuloNovo: string;
  aoMudar: (lista: T[]) => void;
  render: (item: T, set: (parcial: Partial<T>) => void) => React.ReactNode;
  resumoItem: (item: T) => string;
}) {
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    const copia = [...itens];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    aoMudar(copia);
  };
  return (
    <Cartao>
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      <div className="space-y-4">
        {itens.map((item, i) => (
          <div key={item.id} className="rounded-lg border border-black/10 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-tinta/70">{resumoItem(item)}</p>
              <div className="flex gap-1">
                <Botao variante="fantasma" className="!px-2 !py-1" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  ↑
                </Botao>
                <Botao
                  variante="fantasma"
                  className="!px-2 !py-1"
                  onClick={() => mover(i, 1)}
                  disabled={i === itens.length - 1}
                  aria-label="Descer"
                >
                  ↓
                </Botao>
                <Botao
                  variante="fantasma"
                  className="!py-1 text-red-700"
                  onClick={() => confirm("Remover este item do perfil?") && aoMudar(itens.filter((x) => x.id !== item.id))}
                >
                  Remover
                </Botao>
              </div>
            </div>
            {render(item, (parcial) => aoMudar(itens.map((x) => (x.id === item.id ? { ...x, ...parcial } : x))))}
          </div>
        ))}
        <Botao onClick={() => aoMudar([...itens, novo()])}>{rotuloNovo}</Botao>
      </div>
    </Cartao>
  );
}

/** Campo de mês; se o valor tiver só o ano (comum em PDFs), mostra como texto para não sumir. */
function CampoMes(props: InputHTMLAttributes<HTMLInputElement> & { value: string }) {
  const soAno = /^\d{4}$/.test(props.value);
  return <input {...props} type={soAno ? "text" : "month"} placeholder={soAno ? "AAAA" : props.placeholder} />;
}

const chave = (...partes: string[]) => partes.map((p) => p.trim().toLowerCase()).join("|");

/**
 * Junta o que veio do PDF com o perfil atual: preenche só campos vazios e acrescenta itens
 * que ainda não existem (mesmo cargo e empresa, mesmo curso, mesmo nome). Nada já cadastrado é apagado.
 */
function mesclarPerfil(atual: Perfil, lido: Perfil): { perfil: Perfil; resumo: string } {
  const pessoais = { ...atual.pessoais };
  let campos = 0;
  for (const k of Object.keys(pessoais) as (keyof Perfil["pessoais"])[]) {
    if (!pessoais[k].trim() && lido.pessoais[k]?.trim()) {
      pessoais[k] = lido.pessoais[k];
      campos++;
    }
  }
  const resumo = atual.resumo.trim() ? atual.resumo : lido.resumo;
  if (!atual.resumo.trim() && lido.resumo.trim()) campos++;

  const novos = <T,>(existentes: T[], vindos: T[], k: (x: T) => string) => {
    const vistos = new Set(existentes.map(k));
    return vindos.filter((x) => !vistos.has(k(x)));
  };
  const exp = novos(atual.experiencias, lido.experiencias, (e) => chave(e.cargo, e.empresa));
  const form = novos(atual.formacoes, lido.formacoes, (f) => chave(f.curso, f.instituicao));
  const cert = novos(atual.certificacoes, lido.certificacoes, (c) => chave(c.nome));
  const hab = novos(atual.habilidades, lido.habilidades, (h) => chave(h.nome));

  const partes = [
    campos && `${campos} campo(s) de dados pessoais e resumo`,
    exp.length && `${exp.length} experiência(s)`,
    form.length && `${form.length} formação(ões)`,
    cert.length && `${cert.length} certificação(ões)`,
    hab.length && `${hab.length} habilidade(s)`,
  ].filter(Boolean);

  return {
    perfil: {
      ...atual,
      pessoais,
      resumo,
      experiencias: [...atual.experiencias, ...exp],
      formacoes: [...atual.formacoes, ...form],
      certificacoes: [...atual.certificacoes, ...cert],
      habilidades: [...atual.habilidades, ...hab],
    },
    resumo: partes.length
      ? `Importado do PDF: ${partes.join(", ")}.`
      : "O PDF não trouxe nada novo: tudo o que foi lido já está no perfil.",
  };
}
