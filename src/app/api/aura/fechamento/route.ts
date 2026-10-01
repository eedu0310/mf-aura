/**
 * POST /api/aura/fechamento
 *
 * Chamada quando o vendedor marca um negócio como Fechado ou Perdido. A decisão
 * é dele; isto apenas analisa o que aconteceu e devolve o retorno.
 *
 * Faz uma chamada de IA que serve a dois fins: escreve o feedback para o
 * vendedor (acertos e erros à luz do manual) e colhe o aprendizado da conversa.
 * Também avisa o gestor, que pediu para saber de cada fechamento.
 *
 * Nunca devolve erro por falha da IA: o negócio já foi decidido e registrado
 * pelo cliente antes de chegar aqui. Se a análise falhar, responde 200 com
 * laudo nulo e a venda segue válida.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { textoDosMateriais } from "@/lib/aura/materiais";
import { textoDoAprendizado } from "@/lib/aura/aprendizado";
import { analisarFechamento, registrarLaudo, type Fala, type Resultado } from "@/lib/aura/fechamento";
import { getChats, getMessages } from "@/lib/whatsapp/live-manager";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Só os dígitos, para comparar telefone que vem formatado de jeitos diferentes. */
function digitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Acha a conversa de WhatsApp daquele cliente pelo telefone. Compara pelos
 * últimos 8 dígitos porque o cadastro às vezes tem o 9 extra ou o 55 e o JID
 * não — e o contrário também acontece.
 */
function falasDoCliente(userId: string, telefone: string | null): Fala[] {
  const alvo = digitos(telefone);
  if (alvo.length < 8) return [];
  const sufixo = alvo.slice(-8);

  try {
    const chat = getChats(userId).find((c) => digitos(c.phone).endsWith(sufixo));
    if (!chat) return [];
    return getMessages(userId, chat.id)
      .filter((m) => !!m.text?.trim())
      .map((m) => ({ deMim: m.fromMe, texto: m.text!.trim() }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const s = await sessaoAura();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  const { sb, userId, dados } = s;

  let corpo: {
    oportunidadeId?: string;
    resultado?: Resultado;
    motivo?: string | null;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { oportunidadeId, resultado } = corpo;
  if (!oportunidadeId || (resultado !== "fechado" && resultado !== "perdido")) {
    return NextResponse.json(
      { error: "Informe oportunidadeId e resultado ('fechado' ou 'perdido')." },
      { status: 400 },
    );
  }

  // A oportunidade tem de ser visível para quem chamou — a RLS garante isso,
  // então um id de outra loja simplesmente não é encontrado.
  const { data: op } = await sb
    .from("oportunidades")
    .select("id, cliente, valor, etapa, empresa, owner_id, relacionamento_id, origem_lead")
    .eq("id", oportunidadeId)
    .maybeSingle();

  if (!op) {
    return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });
  }

  // Não refaz laudo do mesmo negócio: o vendedor pode arrastar o card duas
  // vezes, e cada refação é uma chamada de IA paga que diria o mesmo.
  const { data: jaTem } = await sb
    .from("aura_feedback_fechamento")
    .select("id")
    .eq("oportunidade_id", oportunidadeId)
    .limit(1);
  if (jaTem?.length) {
    return NextResponse.json({ ok: true, jaAnalisado: true });
  }

  const { data: rel } = op.relacionamento_id
    ? await sb
        .from("relacionamentos")
        .select("telefone")
        .eq("id", op.relacionamento_id)
        .maybeSingle()
    : { data: null };

  const [manual, aprendizado] = await Promise.all([
    textoDosMateriais(sb, op.empresa).catch(() => ""),
    textoDoAprendizado(sb, op.empresa).catch(() => ""),
  ]);

  // As mensagens vivem no processo do WhatsApp, não no banco. Se o dono da
  // oportunidade for outra pessoa, buscamos na sessão dele.
  const falas = falasDoCliente(op.owner_id ?? userId, rel?.telefone ?? null);

  // Etapas que este negócio realmente visitou, para a IA julgar aderência ao
  // funil em vez de supor. O histórico está nas atividades do relacionamento.
  const { data: hist } = op.relacionamento_id
    ? await sb
        .from("atividades")
        .select("tipo, titulo, created_at")
        .eq("relacionamento_id", op.relacionamento_id)
        .order("created_at", { ascending: true })
        .limit(50)
    : { data: null };
  const etapasVisitadas = [
    ...new Set((hist ?? []).map((h: { tipo: string }) => h.tipo).filter(Boolean)),
  ];

  const laudo = await analisarFechamento({
    resultado,
    cliente: op.cliente ?? "Cliente",
    valor: op.valor ?? null,
    etapasVisitadas,
    motivoInformado: corpo.motivo ?? null,
    manual,
    aprendizado,
    falas,
    userId,
    empresa: op.empresa,
  });

  if (!laudo) {
    // Sem IA disponível ou chamada falhou. Não é erro para o cliente: a venda
    // já está registrada e o vendedor não pode ficar travado por isto.
    return NextResponse.json({ ok: true, laudo: null });
  }

  // Quem avisar: os gestores da loja.
  const gestores = (dados.perfis ?? [])
    .filter(
      (p: { id: string; cargo: string | null; empresa: string | null }) =>
        p.empresa === op.empresa && /gestor/i.test(p.cargo ?? ""),
    )
    .map((p: { id: string }) => p.id);

  const vendedor = (dados.perfis ?? []).find((p: { id: string }) => p.id === op.owner_id);

  // ATENÇÃO: a gravação vai pelo cliente de SERVIÇO, não pelo do usuário.
  //
  // O laudo é escrito pelo servidor, não pela pessoa: aura_feedback_fechamento
  // tem política de SELECT e de DELETE, e nenhuma de INSERT — de propósito,
  // para ninguém forjar laudo a mão. Com o cliente do usuário o insert era
  // recusado pela RLS e a falha era só um console.error: o negócio fechava, o
  // aprendizado entrava, e o laudo sumia sem ninguém notar. Foi exatamente o
  // que aconteceu em produção na primeira perda depois do deploy.
  //
  // O mesmo vale para o aprendizado: a política de insert de aura_aprendizado
  // só cobre Gestor, então um vendedor comum fechando negócio também não
  // conseguiria gravar.
  //
  // A autorização continua vindo do cliente do usuário: a oportunidade acima
  // foi lida com RLS, então um id de outra loja nem chega até aqui.
  const sbServico = getSupabaseServiceClient() ?? sb;

  await registrarLaudo(sbServico, {
    laudo,
    empresa: op.empresa,
    vendedorId: op.owner_id ?? userId,
    vendedorNome: vendedor?.nome ?? dados.perfil.nome,
    oportunidadeId: op.id,
    relacionamentoId: op.relacionamento_id ?? null,
    cliente: op.cliente ?? "Cliente",
    resultado,
    valor: op.valor ?? null,
    motivoInformado: corpo.motivo ?? null,
    gestores,
  });

  return NextResponse.json({ ok: true, laudo });
}
