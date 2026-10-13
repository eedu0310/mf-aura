import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { executarBackup, PASTA_PADRAO, diaDoArquivo } from "@/lib/backup/executar";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Backup noturno, 22h.
 *
 * GET sem parâmetro roda o backup. GET com ?listar=1 só mostra o que já existe
 * na pasta, para conferir que a rotina está viva sem gerar arquivo novo — é o
 * jeito de descobrir que o backup parou ANTES de precisar dele.
 */
export async function GET(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  const cabecalho = request.headers.get("authorization");
  if (segredoEsperado && cabecalho !== `Bearer ${segredoEsperado}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const pasta = process.env.AURA_PASTA_BACKUP || PASTA_PADRAO;

  if (new URL(request.url).searchParams.get("listar") === "1") {
    try {
      const arquivos = fs
        .readdirSync(pasta)
        .filter((n) => diaDoArquivo(n))
        .sort()
        .reverse()
        .map((nome) => {
          const s = fs.statSync(path.join(pasta, nome));
          return { nome, mb: Math.round((s.size / 1_048_576) * 100) / 100, em: s.mtime.toISOString() };
        });
      return NextResponse.json({ ok: true, pasta, total: arquivos.length, arquivos });
    } catch (e) {
      return NextResponse.json(
        { erro: `Não consegui ler a pasta de backup: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  try {
    const r = await executarBackup(supabase, pasta);
    return NextResponse.json({
      ok: true,
      arquivo: path.basename(r.arquivo),
      mb: Math.round((r.bytes / 1_048_576) * 100) / 100,
      tabelas: r.tabelas,
      linhas: r.linhas,
      apagados: r.apagados,
    });
  } catch (e) {
    /*
     * Falha de backup precisa gritar. Devolver 200 com "ok: false" faria o
     * cron registrar sucesso no log e ninguém olharia de novo.
     */
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
