import "server-only";
import { cookies } from "next/headers";
import { COOKIE_SESSAO, lerSessao } from "./sessao";

/** E-mail de quem está logado, para registrar quem fez cada passo do histórico. */
export async function autorAtual(): Promise<string> {
  const sessao = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  return sessao?.email ?? "";
}
