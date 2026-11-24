import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { rodarSentinelas, ultimasRodadas } from "@/lib/sentinela";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Painel "Saúde do sistema": a última rodada de cada Sentinela.
 *
 * Só para quem enxerga as quatro lojas (o gestor mestre aprovado):
 * os achados falam de todas as lojas, de contas e de configuração do servidor.
 */
async function autorizar() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!vejoTodasAsLojas(auth)) {
    return { erro: NextResponse.json({ erro: "Só o gestor mestre vê a saúde do sistema." }, { status: 403 }) };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };
  return { sb };
}

export async function GET() {
  const { erro, sb } = await autorizar();
  if (erro) return erro;
  const rodadas = await ultimasRodadas(sb!);
  return NextResponse.json({
    rodadas: [...rodadas.values()].map((r) => ({
      sentinela: r.sentinela,
      criadoEm: r.criado_em,
      nivel: r.nivel,
      resumo: r.resumo,
      achados: r.achados,
    })),
  });
}

/** "Rodar agora": o gestor não precisa esperar o próximo horário do cron. */
export async function POST() {
  const { erro, sb } = await autorizar();
  if (erro) return erro;
  const resultado = await rodarSentinelas(sb!);
  return NextResponse.json({ ok: true, ...resultado });
}
