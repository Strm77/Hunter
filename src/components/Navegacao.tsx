"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", rotulo: "Candidaturas" },
  { href: "/vagas", rotulo: "Vagas" },
  { href: "/perfil", rotulo: "Perfil" },
  { href: "/curriculos", rotulo: "Currículos" },
];

export default function Navegacao() {
  const atual = usePathname();
  if (atual === "/entrar") return null;
  return (
    <header className="nao-imprimir border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-marca">
          Hunter
        </Link>
        <nav className="order-last flex w-full flex-wrap gap-1 text-sm sm:order-none sm:w-auto">
          {LINKS.map((l) => {
            const ativo = l.href === "/" ? atual === "/" : atual.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  ativo ? "bg-marca-claro text-marca" : "text-tinta/70 hover:bg-black/5"
                }`}
              >
                {l.rotulo}
              </Link>
            );
          })}
        </nav>
        <form method="POST" action="/api/sair" className="ml-auto">
          <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-tinta/60 hover:bg-black/5">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
