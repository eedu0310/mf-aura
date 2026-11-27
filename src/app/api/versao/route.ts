import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Qual build está no ar. O navegador compara com o build que ele carregou;
 * se forem diferentes, ele está velho e recarrega. Só devolve uma data, nada
 * de dado da empresa, por isso é pública.
 *
 * "avaliar": a última linha do deploy/avaliar-dominios.sh (endereços
 * avaliar.<loja> ligados, certificado, nginx) — para conferir de fora se o
 * link de avaliação das lojas está no ar. Só nomes de endereço públicos.
 */
export function GET() {
  let avaliar: string | null = null;
  try {
    avaliar = fs
      .readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), ".avaliar-status"), "utf8")
      .trim()
      .slice(0, 600);
  } catch {
    /* ainda não rodou */
  }
  return NextResponse.json(
    { versao: process.env.NEXT_PUBLIC_VERSAO ?? null, avaliar },
    { headers: { "Cache-Control": "no-store" } },
  );
}
