import "server-only";
import { getDocumentProxy } from "unpdf";
import type { PaginaPdf } from "./leitorCurriculo";

/** Extrai o texto com posição, tamanho e fonte de cada trecho, mais os links do PDF. */
export async function extrairPdf(dados: Uint8Array): Promise<PaginaPdf[]> {
  const pdf = await getDocumentProxy(dados);
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
    const pagina = await pdf.getPage(n);
    const { width } = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const trechos = [];
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      trechos.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: item.height || Math.abs(item.transform[3]),
        fonte: item.fontName,
      });
    }
    const anotacoes = await pagina.getAnnotations();
    const links = anotacoes
      .map((a: { url?: string }) => a.url)
      .filter((u: string | undefined): u is string => typeof u === "string");
    paginas.push({ largura: width, trechos, links });
  }
  await pdf.cleanup?.();
  return paginas;
}
