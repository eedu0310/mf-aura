import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getOpenAIClient } from "@/lib/openai-client";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { CARGOS_QUE_VENDEM } from "@/lib/types";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { diaEmSaoPaulo } from "@/lib/fuso";
import { carregarFunil } from "@/lib/funil-servidor";
import { ehFechada, type EtapaFunil } from "@/lib/funil";
import { buscarUltimaAtividade, diasParadoDaLinha, DIAS_PARA_PARADO } from "@/lib/oportunidade-parada";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!mandaNaLoja(auth)) {
    return NextResponse.json({ erro: "Só o Gestor pode gerar esse resumo." }, { status: 403 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json(
      { erro: "A chave da IA não está configurada (ANTHROPIC_API_KEY)." },
      { status: 400 },
    );
  }

  const supabase = auth.supabase;
  /*
   * Mês de Brasília, e o anterior por conta. Antes: toISOString (UTC, vira o
   * mês às 21h) e setMonth(-1), que num dia 31 cai no próprio mês ("31 de
   * dezembro menos um mês" = 1º de dezembro) e comparava o mês com ele mesmo.
   */
  const mesAtual = diaEmSaoPaulo().slice(0, 7);
  const [anoHoje, mesHoje] = mesAtual.split("-").map(Number);
  const mesPassado =
    mesHoje === 1 ? `${anoHoje - 1}-12` : `${anoHoje}-${String(mesHoje - 1).padStart(2, "0")}`;

  /*
   * Lidas até o fim, de mil em mil. As consultas simples paravam nas 1000
   * primeiras linhas — de vendas de todos os tempos, sem ordem —, e a venda do
   * mês que a IA comentava era a de uma amostra qualquer.
   */
  let vendas, oportunidades, leads, posVendas, perfis;
  try {
    [vendas, oportunidades, leads, posVendas, { data: perfis }] = await Promise.all([
      todasAsLinhas((de, ate) =>
        supabase
          .from("vendas")
          .select("empresa, valor, data")
          .gte("data", `${mesPassado}-01`)
          .order("id")
          .range(de, ate),
      ),
      todasAsLinhas((de, ate) =>
        supabase
          .from("oportunidades")
          .select("empresa, valor, etapa, relacionamento_id, created_at, updated_at")
          .order("id")
          .range(de, ate),
      ),
      todasAsLinhas((de, ate) =>
        supabase
          .from("leads_recebidos")
          .select("empresa, status, gestor_notificado, urgencia")
          .or("natureza.is.null,natureza.eq.lead")
          .order("id")
          .range(de, ate),
      ),
      todasAsLinhas((de, ate) =>
        supabase
          .from("pos_vendas")
          .select("empresa, status, reclamacao, reclamacao_resolvida, avaliou_loja, nota_avaliacao, data_agendamento")
          .order("id")
          .range(de, ate),
      ),
      supabase.from("profiles").select("empresa, cargo, ativo"),
    ]);
  } catch (e) {
    console.error("Resumo executivo: leitura dos números falhou:", e);
    return NextResponse.json({ erro: "Não consegui ler os números das lojas." }, { status: 500 });
  }

  /*
   * "Paradas": abertas há 7+ dias sem alteração nem atividade com o cliente.
   * Antes lia a coluna dias_parado, que estava em 0 em todos os negócios (e
   * ainda contava os já ganhos ou perdidos).
   */
  const funis = new Map<string, EtapaFunil[]>();
  for (const empresa of NOMES_EMPRESAS) funis.set(empresa, await carregarFunil(supabase, empresa));
  const abertaNaLoja = (o: { empresa?: unknown; etapa?: unknown }) => {
    const f = funis.get(String(o.empresa ?? ""));
    return !!f && !ehFechada(String(o.etapa ?? ""), f);
  };
  const ultimaAtividade = await buscarUltimaAtividade(
    supabase,
    (oportunidades ?? []).filter(abertaNaLoja).map((o) => o.relacionamento_id as string | null),
  );

  const linhasPorEmpresa = NOMES_EMPRESAS.map((empresa) => {
    const vendasLoja = (vendas ?? []).filter((v) => v.empresa === empresa);
    const vendasMes = vendasLoja
      .filter((v) => (v.data as string)?.startsWith(mesAtual))
      .reduce((s, v) => s + Number(v.valor), 0);
    const vendasMesAnterior = vendasLoja
      .filter((v) => (v.data as string)?.startsWith(mesPassado))
      .reduce((s, v) => s + Number(v.valor), 0);

    const oportunidadesLoja = (oportunidades ?? []).filter((o) => o.empresa === empresa);
    const pipelineAberto = oportunidadesLoja.reduce((s, o) => s + Number(o.valor), 0);
    const paradas = oportunidadesLoja.filter(
      (o) =>
        abertaNaLoja(o) &&
        diasParadoDaLinha(o, ultimaAtividade.get(o.relacionamento_id as string)) >= DIAS_PARA_PARADO,
    ).length;

    const leadsLoja = (leads ?? []).filter((l) => l.empresa === empresa);
    const leadsEscalonados = leadsLoja.filter((l) => l.gestor_notificado).length;
    const leadsPerdidos = leadsLoja.filter((l) => l.status === "perdido").length;

    const posVendaLoja = (posVendas ?? []).filter((p) => p.empresa === empresa);
    const reclamacoesAbertas = posVendaLoja.filter((p) => p.reclamacao?.trim() && !p.reclamacao_resolvida).length;
    const avaliaram = posVendaLoja.filter((p) => p.avaliou_loja);
    const notaMedia =
      avaliaram.length > 0
        ? avaliaram.reduce((s, p) => s + Number(p.nota_avaliacao ?? 0), 0) / avaliaram.length
        : null;

    const vendedoresAtivos = (perfis ?? []).filter(
      (p) => p.empresa === empresa && CARGOS_QUE_VENDEM.includes(p.cargo) && p.ativo
    ).length;

    return {
      empresa,
      vendedoresAtivos,
      vendasMes,
      vendasMesAnterior,
      pipelineAberto,
      oportunidadesParadas: paradas,
      leadsEscalonados,
      leadsPerdidos,
      reclamacoesAbertas,
      notaMedia,
    };
  });

  const resumoTextual = linhasPorEmpresa
    .map(
      (l) =>
        `${l.empresa}: ${l.vendedoresAtivos} vendedores ativos, vendeu R$ ${l.vendasMes.toLocaleString("pt-BR")} este mês (mês passado: R$ ${l.vendasMesAnterior.toLocaleString("pt-BR")}), pipeline aberto R$ ${l.pipelineAberto.toLocaleString("pt-BR")}, ${l.oportunidadesParadas} oportunidades paradas há 7+ dias, ${l.leadsEscalonados} leads sem resposta a tempo, ${l.leadsPerdidos} leads perdidos, ${l.reclamacoesAbertas} reclamações de pós-venda abertas, nota média de avaliação ${l.notaMedia !== null ? l.notaMedia.toFixed(1) : "sem avaliações ainda"}.`
    )
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um analista comercial sênior, escrevendo um resumo executivo curto para o(a) ${auth.cargo} do Grupo MF (rede de lojas de lareiras e aquecimento). Analise os números reais abaixo e escreva um resumo direto, em português, destacando o que realmente precisa de atenção — não repita todos os números, aponte os PROBLEMAS e OPORTUNIDADES mais relevantes. Use no máximo 5 tópicos curtos (bullet points com "•"), cada um com 1-2 frases. Seja específico, cite a loja pelo nome quando relevante. Não use markdown além de "•". Não invente nada além dos dados fornecidos.`,
        },
        { role: "user", content: resumoTextual },
      ],
      temperature: 0.4,
    }, { __funcao: "resumo-gestor" } as never);

    const texto = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ resumo: texto || "Não consegui gerar o resumo agora." });
  } catch (err) {
    console.error("Erro ao gerar resumo executivo:", err);
    return NextResponse.json({ erro: "Não consegui gerar o resumo agora." }, { status: 500 });
  }
}
