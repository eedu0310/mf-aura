import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { configDoAgente } from "@/lib/meta/agente";
import { limparHorario } from "@/lib/site-mf/horario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configuração do agente de IA do Instagram, por loja. Só o gestor mestre,
 * como a conexão das contas.
 */
const LOJAS = ["MF International", "LF Lareiras", "A&G Aquecimento", "Sole Aquecimento"];

async function somenteMestre() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };
  // Mestre de verdade (cargo Gestor, aprovado e mestre), a mesma régua das outras rotas.
  if (!vejoTodasAsLojas(auth)) return { erro: NextResponse.json({ erro: "Só o gestor mestre configura o agente." }, { status: 403 }) };
  return { auth, sb };
}

export async function GET(request: Request) {
  const { erro, sb } = await somenteMestre();
  if (erro) return erro;
  const empresa = new URL(request.url).searchParams.get("empresa") ?? "";
  if (!LOJAS.includes(empresa)) return NextResponse.json({ erro: "Loja desconhecida." }, { status: 400 });
  const cfg = await configDoAgente(sb!, empresa);
  const { count } = await sb!
    .from("meta_mensagens")
    .select("id, meta_conversas!inner(empresa)", { count: "exact", head: true })
    .eq("por_ia", true)
    .eq("meta_conversas.empresa", empresa)
    .gte("criado_em", new Date(Date.now() - 7 * 86_400_000).toISOString());
  // O agente usa só o material desta loja: mostra quanto tem.
  const { count: trechos } = await sb!
    .from("aura_trechos_ativos")
    .select("empresa", { count: "exact", head: true })
    .eq("empresa", empresa);
  return NextResponse.json({ config: cfg, respostasNaSemana: count ?? 0, trechosDeMaterial: trechos ?? 0 });
}

export async function POST(request: Request) {
  const { erro, sb, auth } = await somenteMestre();
  if (erro) return erro;
  const b = await request.json().catch(() => ({}));
  const empresa = String(b.empresa ?? "");
  if (!LOJAS.includes(empresa)) return NextResponse.json({ erro: "Loja desconhecida." }, { status: 400 });
  const horas = Number(b.esperar_horas);
  if (!Number.isFinite(horas) || horas < 0.25 || horas > 20) {
    return NextResponse.json({ erro: "O tempo de espera vai de 15 minutos a 20 horas." }, { status: 400 });
  }
  const { error } = await sb!.from("meta_ia_config").upsert(
    {
      empresa,
      ativa: Boolean(b.ativa),
      esperar_horas: horas,
      fora_do_horario: b.fora_do_horario !== false,
      horario: limparHorario(b.horario),
      responder_comentarios: Boolean(b.responder_comentarios),
      instrucoes: String(b.instrucoes ?? "").slice(0, 2000),
      atualizado_em: new Date().toISOString(),
      atualizado_por: auth!.userId,
    },
    { onConflict: "empresa" },
  );
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
