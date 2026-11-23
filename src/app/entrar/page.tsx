import { codigoConfigurado, destinoSeguro } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; proximo?: string }>;
}) {
  const { erro, proximo } = await searchParams;
  const configurado = Boolean(codigoConfigurado());

  return (
    <div className="mx-auto mt-10 max-w-sm rounded-xl border border-black/10 bg-white p-6">
      <h1 className="text-xl font-bold">Entrar no Hunter</h1>
      {!configurado ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          O código de acesso ainda não foi configurado. Defina <code>HUNTER_ACCESS_CODE</code> (mínimo 8 caracteres) no
          arquivo <code>.env.local</code> e reinicie o app. Enquanto isso, o acesso fica bloqueado.
        </p>
      ) : (
        <form method="POST" action="/api/entrar" className="mt-4 space-y-3">
          <input type="hidden" name="proximo" value={destinoSeguro(proximo)} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-tinta/80">Código de acesso</span>
            <input
              name="codigo"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
            />
          </label>
          {erro === "codigo" && <p className="text-sm text-red-700">Código incorreto.</p>}
          <button type="submit" className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca/90">
            Entrar
          </button>
        </form>
      )}
    </div>
  );
}
