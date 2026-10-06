/**
 * As etapas do funil, editáveis pelo gestor.
 *
 * GET  — o funil da loja.
 * PUT  — grava a lista inteira: nomes, ordem, cor, papel e o que conta no
 *        pipeline.
 *
 * RENOMEAR UMA ETAPA MOVE OS NEGÓCIOS JUNTO. A etapa é gravada como texto em
 * cada negócio; se o nome mudasse só na tabela de etapas, os 23 negócios que
 * estão em "Proposta" ficariam numa etapa que não existe mais — sem coluna
 * onde aparecer, invisíveis no quadro, e fora de toda conta. Por isso o
 * rename aqui é uma transação: muda a etapa e muda os negócios dela.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { esquecerFunil } from "@/lib/funil-servidor";
import { FUNIL_PADRAO } from "@/lib/funil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["aberta", "ganho", "perda", "posvenda"];
const PROBS = ["Baixa", "Média", "Alta"];

interface EtapaEnviada {
  id?: string | null;
  nome?: string;
  nomeAntigo?: string | null;
  ordem?: number;
  tipo?: string;
  contaNoPipeline?: boolean;
  probabilidade?: string;
  cor?: string;
  ativa?: boolean;
  chave?: string | null;
}

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (auth.cargo !== "Gestor" || !auth.gestorAprovado) {
    return { erro: NextResponse.json({ erro: "Só um gestor aprovado edita o funil." }, { status: 403 }) };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };
  return { auth, sb };
}

export async function GET(req: NextRequest) {
  const { erro, auth, sb } = await somenteGestor();
  if (erro) return erro;

  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = auth!.gestorMestre && pedida ? pedida : auth!.empresa;

  const { data } = await sb!
    .from("etapas_funil")
    .select("id, nome, ordem, tipo, conta_no_pipeline, probabilidade, cor, ativa, chave")
    .eq("empresa", loja)
    .order("ordem");

  // Quantos negócios há em cada etapa: é o que o gestor precisa ver antes de
  // desligar ou renomear uma delas.
  const { data: ops } = await sb!
    .from("oportunidades")
    .select("etapa")
    .eq("empresa", loja);

  const quantos: Record<string, number> = {};
  for (const o of ops ?? []) {
    const e = String(o.etapa ?? "");
    quantos[e] = (quantos[e] ?? 0) + 1;
  }

  return NextResponse.json({
    loja,
    souMestre: auth!.gestorMestre,
    etapas: data ?? [],
    quantos,
    padrao: FUNIL_PADRAO,
    tipos: TIPOS,
    probabilidades: PROBS,
  });
}

export async function PUT(req: NextRequest) {
  const { erro, auth, sb } = await somenteGestor();
  if (erro) return erro;

  let corpo: { loja?: string; etapas?: EtapaEnviada[] };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const loja = auth!.gestorMestre && corpo.loja ? corpo.loja : auth!.empresa;
  const etapas = (corpo.etapas ?? []).filter((e) => (e.nome ?? "").trim());

  if (!etapas.length) {
    return NextResponse.json({ erro: "O funil precisa de pelo menos uma etapa." }, { status: 400 });
  }

  const nomes = etapas.map((e) => e.nome!.trim());
  if (new Set(nomes).size !== nomes.length) {
    return NextResponse.json({ erro: "Há duas etapas com o mesmo nome." }, { status: 400 });
  }

  /**
   * Sem etapa de ganho não há onde registrar venda; sem a de perda não há
   * onde encerrar negócio. O sistema inteiro depende das duas: é a etapa de
   * ganho que cria a venda do mês quando o vendedor arrasta o card.
   */
  const ativas = etapas.filter((e) => e.ativa !== false);
  if (!ativas.some((e) => e.tipo === "ganho")) {
    return NextResponse.json(
      { erro: "Falta a etapa de fechamento: é ela que registra a venda quando o card é arrastado." },
      { status: 400 },
    );
  }
  if (!ativas.some((e) => e.tipo === "perda")) {
    return NextResponse.json(
      { erro: "Falta a etapa de perdidos: é onde o negócio é encerrado sem venda." },
      { status: 400 },
    );
  }
  if (ativas.filter((e) => e.tipo === "ganho").length > 1) {
    return NextResponse.json(
      { erro: "Só pode haver uma etapa de fechamento — senão a venda do mês entraria duas vezes." },
      { status: 400 },
    );
  }

  const { data: atuais } = await sb!
    .from("etapas_funil")
    .select("id, nome")
    .eq("empresa", loja);
  const nomeAtualPorId = new Map((atuais ?? []).map((e) => [e.id as string, e.nome as string]));

  const renomeadas: { de: string; para: string; negocios: number }[] = [];

  for (const [i, e] of etapas.entries()) {
    const nome = e.nome!.trim();
    const linha = {
      empresa: loja,
      nome,
      ordem: Number.isFinite(Number(e.ordem)) ? Number(e.ordem) : i + 1,
      tipo: TIPOS.includes(String(e.tipo)) ? String(e.tipo) : "aberta",
      conta_no_pipeline: e.contaNoPipeline === true,
      probabilidade: PROBS.includes(String(e.probabilidade)) ? String(e.probabilidade) : "Baixa",
      cor: /^#[0-9a-fA-F]{6}$/.test(String(e.cor)) ? String(e.cor) : "#8696a0",
      ativa: e.ativa !== false,
      chave: e.chave || null,
      atualizado_em: new Date().toISOString(),
    };

    if (e.id) {
      const antigo = nomeAtualPorId.get(e.id);
      const { error } = await sb!.from("etapas_funil").update(linha).eq("id", e.id).eq("empresa", loja);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

      // O rename arrasta os negócios junto, senão eles ficam órfãos de etapa.
      if (antigo && antigo !== nome) {
        const { count } = await sb!
          .from("oportunidades")
          .update({ etapa: nome, updated_at: new Date().toISOString() }, { count: "exact" })
          .eq("empresa", loja)
          .eq("etapa", antigo);
        renomeadas.push({ de: antigo, para: nome, negocios: count ?? 0 });

        // A etiqueta que o vendedor vê no WhatsApp também é o nome da etapa.
        await sb!
          .from("whatsapp_ia_leads")
          .update({ etapa: nome, updated_at: new Date().toISOString() })
          .eq("empresa", loja)
          .eq("etapa", antigo);
      }
    } else {
      const { error } = await sb!.from("etapas_funil").insert(linha);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    }
  }

  esquecerFunil(loja);

  return NextResponse.json({ ok: true, renomeadas });
}
