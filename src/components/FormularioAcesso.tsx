import Link from "next/link";

const classe =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export default function FormularioAcesso({
  modo,
  erro,
  email,
  proximo,
}: {
  modo: "entrar" | "cadastro";
  erro?: string;
  email?: string;
  proximo?: string;
}) {
  const entrar = modo === "entrar";
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-xl border border-black/10 bg-white p-6">
      <h1 className="text-xl font-bold">{entrar ? "Entrar no Hunter" : "Criar conta"}</h1>
      <form method="POST" action={entrar ? "/api/entrar" : "/api/cadastro"} className="mt-4 space-y-3">
        {entrar && <input type="hidden" name="proximo" value={proximo ?? "/"} />}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-tinta/80">E-mail</span>
          <input name="email" type="email" required autoFocus autoComplete="email" defaultValue={email} className={classe} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-tinta/80">Senha</span>
          <input
            name="senha"
            type="password"
            required
            minLength={entrar ? undefined : 8}
            autoComplete={entrar ? "current-password" : "new-password"}
            className={classe}
          />
          {!entrar && <span className="mt-1 block text-xs text-tinta/50">Mínimo de 8 caracteres.</span>}
        </label>
        {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button type="submit" className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca/90">
          {entrar ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-tinta/60">
        {entrar ? (
          <>
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-medium text-marca underline">
              Criar conta
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/entrar" className="font-medium text-marca underline">
              Entrar
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
