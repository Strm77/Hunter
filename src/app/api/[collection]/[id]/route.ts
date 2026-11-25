import { NextResponse } from "next/server";
import { atualizarItem, ehColecao, ErroValidacao, removerItem } from "@/lib/db";
import { autorAtual } from "@/lib/autor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string; id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { collection, id } = await params;
  if (!ehColecao(collection)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  try {
    const corpo = await req.json();
    const item = await atualizarItem(collection, id, corpo ?? {}, await autorAtual());
    if (!item) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof ErroValidacao) return NextResponse.json({ erro: e.message }, { status: 400 });
    if (e instanceof SyntaxError) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { collection, id } = await params;
  if (!ehColecao(collection)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const ok = await removerItem(collection, id);
  if (!ok) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
