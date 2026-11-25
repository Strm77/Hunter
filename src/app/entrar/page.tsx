import FormularioAcesso from "@/components/FormularioAcesso";
import { destinoSeguro } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  config: "O login ainda não foi configurado no servidor (falta HUNTER_DB_TOKEN ou HUNTER_SESSION_SECRET).",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; email?: string; proximo?: string }>;
}) {
  const { erro, email, proximo } = await searchParams;
  return <FormularioAcesso modo="entrar" erro={erro ? ERROS[erro] : undefined} email={email} proximo={destinoSeguro(proximo)} />;
}
