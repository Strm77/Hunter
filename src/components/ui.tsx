"use client";

import { ReactNode, useEffect } from "react";

export const classeCampo =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export function Campo({
  rotulo,
  children,
  dica,
  className = "",
}: {
  rotulo: string;
  children: ReactNode;
  dica?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-tinta/80">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-tinta/50">{dica}</span>}
    </label>
  );
}

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-white hover:bg-marca/90",
  secundario: "border border-black/15 bg-white hover:bg-black/5",
  perigo: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  fantasma: "text-tinta/70 hover:bg-black/5",
};

export function Botao({
  variante = "secundario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={aoFechar} className="text-2xl leading-none text-tinta/40 hover:text-tinta" aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-black/10 bg-white p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/20 bg-white/60 p-8 text-center text-sm text-tinta/60">
      {children}
    </div>
  );
}

export function Cabecalho({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-tinta/60">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Erro({ mensagem }: { mensagem: string }) {
  if (!mensagem) return null;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensagem}</p>;
}
