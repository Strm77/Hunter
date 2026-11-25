import { NextResponse } from "next/server";
import { ErroValidacao, marcarComoEnviada } from "@/lib/db";
import { autorAtual } from "@/lib/autor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const item = await marcarComoEnviada(corpo ?? {}, await autorAtual());
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof ErroValidacao) return NextResponse.json({ erro: e.message }, { status: 400 });
    if (e instanceof SyntaxError) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    throw e;
  }
}
