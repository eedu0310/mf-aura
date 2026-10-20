import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { executarBackup, PASTA_PADRAO, diaDoArquivo, diaDasSessoes, BUCKET_NUVEM } from "@/lib/backup/executar";

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
        .filter((n) => diaDoArquivo(n) || diaDasSessoes(n))
        .sort()
        .reverse()
        .map((nome) => {
          const s = fs.statSync(path.join(pasta, nome));
          return { nome, mb: Math.round((s.size / 1_048_576) * 100) / 100, em: s.mtime.toISOString() };
        });
      /* O que está na nuvem também, para a conferência ser uma só. */
      const sb = getSupabaseServiceClient();
      const nuvem = sb
        ? await sb.storage.from(BUCKET_NUVEM).list("", { limit: 1000, sortBy: { column: "name", order: "desc" } })
        : { data: null, error: { message: "Supabase não configurado." } };
      return NextResponse.json({
        ok: true,
        pasta,
        total: arquivos.length,
        arquivos,
        nuvem: nuvem.error
          ? { erro: nuvem.error.message }
          : (nuvem.data ?? []).map((o) => ({
              nome: o.name,
              mb: Math.round((Number(o.metadata?.size ?? 0) / 1_048_576) * 100) / 100,
              em: o.updated_at,
            })),
      });
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
    /*
     * Nuvem falhou? O backup local existe, então não é erro 500 — mas o log
     * do cron precisa mostrar "nuvem: <motivo>" em vez de um "ok" liso.
     */
    return NextResponse.json({
      ok: true,
      arquivo: path.basename(r.arquivo),
      mb: Math.round((r.bytes / 1_048_576) * 100) / 100,
      tabelas: r.tabelas,
      linhas: r.linhas,
      esquema_kb: Math.round(r.esquemaBytes / 1024),
      migracoes: r.migracoes,
      sessoes: r.sessoes ? path.basename(r.sessoes) : null,
      apagados: r.apagados,
      nuvem: r.nuvem.erro ? `FALHOU: ${r.nuvem.erro}` : `ok: ${r.nuvem.enviados.join(", ")}`,
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
