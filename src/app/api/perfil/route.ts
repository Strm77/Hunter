import { NextResponse } from "next/server";
import { lerBanco, salvarPerfil } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dados = await lerBanco();
  return NextResponse.json(dados.perfil);
}

export async function PUT(req: Request) {
  try {
    const corpo = await req.json();
    return NextResponse.json(await salvarPerfil(corpo));
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    throw e;
  }
}
