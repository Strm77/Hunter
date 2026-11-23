import { NextResponse } from "next/server";
import { criarItem, ehColecao, ErroValidacao, lerBanco } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!ehColecao(collection)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const dados = await lerBanco();
  return NextResponse.json(dados[collection]);
}

export async function POST(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!ehColecao(collection)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  try {
    const corpo = await req.json();
    const item = await criarItem(collection, corpo ?? {});
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof ErroValidacao) return NextResponse.json({ erro: e.message }, { status: 400 });
    if (e instanceof SyntaxError) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    throw e;
  }
}
