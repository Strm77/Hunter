import { NextRequest, NextResponse } from "next/server";
import { extrairPdf } from "@/lib/extrairPdf";
import { lerCurriculo } from "@/lib/leitorCurriculo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMITE = 5 * 1024 * 1024;

/**
 * Recebe o PDF do currículo e devolve um rascunho do perfil.
 * Não salva nada: o PDF é lido em memória e descartado; quem salva é a pessoa, depois de revisar.
 */
export async function POST(req: NextRequest) {
  let arquivo: FormDataEntryValue | null;
  try {
    arquivo = (await req.formData()).get("arquivo");
  } catch {
    return NextResponse.json({ erro: "Envie o arquivo PDF do currículo." }, { status: 400 });
  }
  if (!arquivo || typeof arquivo === "string") {
    return NextResponse.json({ erro: "Envie o arquivo PDF do currículo." }, { status: 400 });
  }
  if (arquivo.size > LIMITE) {
    return NextResponse.json({ erro: "O PDF passa de 5 MB." }, { status: 413 });
  }
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  if (new TextDecoder().decode(dados.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ erro: "Este arquivo não é um PDF." }, { status: 415 });
  }
  try {
    return NextResponse.json(lerCurriculo(await extrairPdf(dados)));
  } catch {
    return NextResponse.json({ erro: "Não consegui ler este PDF. Ele pode estar protegido ou corrompido." }, { status: 422 });
  }
}
