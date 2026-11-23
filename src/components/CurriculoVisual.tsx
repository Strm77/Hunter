import { ehLinkSeguro, formatarMes } from "@/lib/api";
import type { Curriculo, ItemSelecionado, Perfil } from "@/lib/types";

/** Resolve as referências da variante contra o currículo-base, na ordem da variante. */
export function resolver<T extends { id: string }>(sel: ItemSelecionado[], base: T[]) {
  const porId = new Map(base.map((b) => [b.id, b]));
  return sel.flatMap((s) => {
    const item = porId.get(s.refId);
    return item ? [{ item, destaque: s.destaque }] : [];
  });
}

function periodo(inicio: string, fim: string, atual = false) {
  const i = formatarMes(inicio);
  const f = atual ? "atual" : formatarMes(fim);
  return [i, f].filter(Boolean).join(" – ");
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 border-b border-black/15 pb-1 text-xs font-bold uppercase tracking-widest text-marca">{titulo}</h3>
      {children}
    </section>
  );
}

export default function CurriculoVisual({ perfil, curriculo }: { perfil: Perfil; curriculo: Curriculo }) {
  const p = perfil.pessoais;
  const exps = resolver(curriculo.experiencias, perfil.experiencias);
  const forms = resolver(curriculo.formacoes, perfil.formacoes);
  const certs = resolver(curriculo.certificacoes, perfil.certificacoes);
  const habs = resolver(curriculo.habilidades, perfil.habilidades);
  const contatos = [p.email, p.telefone, p.cidade].filter(Boolean);
  const links = [p.linkedin, p.portfolio].filter(ehLinkSeguro);

  return (
    <article className="bg-white p-6 text-[13px] leading-relaxed text-tinta sm:p-8 print:p-0">
      <header>
        <h2 className="text-2xl font-bold">{p.nome || "Seu nome"}</h2>
        {p.titulo && <p className="text-base text-tinta/70">{p.titulo}</p>}
        {(contatos.length > 0 || links.length > 0) && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-tinta/70">
            {contatos.map((c) => (
              <span key={c}>{c}</span>
            ))}
            {links.map((l) => (
              <a key={l} href={l} className="underline" target="_blank" rel="noopener noreferrer">
                {l.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            ))}
          </p>
        )}
      </header>

      {curriculo.incluirResumo && perfil.resumo && (
        <Secao titulo="Resumo">
          <p className="whitespace-pre-line">{perfil.resumo}</p>
        </Secao>
      )}

      {exps.length > 0 && (
        <Secao titulo="Experiência">
          <div className="space-y-3">
            {exps.map(({ item: e, destaque }) => (
              <div key={e.id} className={destaque ? "border-l-2 border-marca pl-3" : ""}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">
                    {e.cargo}
                    {e.empresa && <span className="font-normal"> · {e.empresa}</span>}
                  </p>
                  <p className="text-xs text-tinta/60">{periodo(e.inicio, e.fim, e.atual)}</p>
                </div>
                {e.local && <p className="text-xs text-tinta/60">{e.local}</p>}
                {e.descricao.trim() && (
                  <ul className="mt-1 list-disc pl-5">
                    {e.descricao
                      .split("\n")
                      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                      .filter(Boolean)
                      .map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {forms.length > 0 && (
        <Secao titulo="Formação">
          <div className="space-y-2">
            {forms.map(({ item: f, destaque }) => (
              <div key={f.id} className={destaque ? "border-l-2 border-marca pl-3" : ""}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">
                    {f.curso}
                    {f.instituicao && <span className="font-normal"> · {f.instituicao}</span>}
                  </p>
                  <p className="text-xs text-tinta/60">{periodo(f.inicio, f.fim)}</p>
                </div>
                {f.observacao && <p className="text-xs text-tinta/70">{f.observacao}</p>}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {certs.length > 0 && (
        <Secao titulo="Certificações">
          <ul className="space-y-1">
            {certs.map(({ item: c, destaque }) => (
              <li key={c.id} className={destaque ? "font-semibold" : ""}>
                {c.nome}
                {c.emissor && <span className="font-normal text-tinta/70"> · {c.emissor}</span>}
                {c.data && <span className="font-normal text-tinta/60"> · {formatarMes(c.data)}</span>}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {habs.length > 0 && (
        <Secao titulo="Habilidades">
          <p>
            {habs.map(({ item: h, destaque }, i) => (
              <span key={h.id}>
                <span className={destaque ? "font-semibold text-marca" : ""}>{h.nome}</span>
                {i < habs.length - 1 && " · "}
              </span>
            ))}
          </p>
        </Secao>
      )}
    </article>
  );
}
