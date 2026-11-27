import { NextResponse } from "next/server";
import { lerBanco } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Tudo o que a linha do tempo precisa numa leitura só (candidaturas, vagas, versões e registro de atividades). */
export async function GET() {
  const dados = await lerBanco();
  return NextResponse.json({
    candidaturas: dados.candidaturas,
    vagas: dados.vagas,
    curriculos: dados.curriculos.map((c) => ({ id: c.id, nome: c.nome })),
    atividades: dados.atividades,
  });
}
