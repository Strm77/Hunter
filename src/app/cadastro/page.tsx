import FormularioAcesso from "@/components/FormularioAcesso";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  email: "Digite um e-mail válido.",
  senha: "A senha precisa ter pelo menos 8 caracteres.",
  existe: "Já existe uma conta com esse e-mail. Use Entrar.",
  "nao-autorizado": "Este e-mail não está autorizado a criar conta no Hunter.",
  config: "O cadastro ainda não foi configurado no servidor.",
};

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ erro?: string; email?: string }> }) {
  const { erro, email } = await searchParams;
  return <FormularioAcesso modo="cadastro" erro={erro ? ERROS[erro] : undefined} email={email} />;
}
