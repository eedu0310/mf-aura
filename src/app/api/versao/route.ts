import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Qual build está no ar. O navegador compara com o build que ele carregou;
 * se forem diferentes, ele está velho e recarrega. Só devolve uma data, nada
 * de dado da empresa, por isso é pública.
 */
export function GET() {
  return NextResponse.json(
    { versao: process.env.NEXT_PUBLIC_VERSAO ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
