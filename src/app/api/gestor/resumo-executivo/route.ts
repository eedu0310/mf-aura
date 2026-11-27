import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getOpenAIClient } from "@/lib/openai-client";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { CARGOS_QUE_VENDEM } from "@/lib/types";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { diaEmSaoPaulo, mesEmSaoPaulo } from "@/lib/fuso";
import { carregarFunil } from "@/lib/funil-servidor";
import type { EtapaFunil } from "@/lib/funil";
import { buscarUltimaAtividade, diasParadoDaLinha, DIAS_PARA_PARADO } from "@/lib/oportunidade-parada";
import { negocioEmAberto, notaMedia, pipelineAberto, totalVendido, vendasDoMes } from "@/lib/kpis";

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
  const mesPassado = mesEmSaoPaulo(-1);

  /*
   * Só as lojas que esta pessoa enxerga. O gestor de uma loja recebia as
   * quatro: a RLS zerava as outras três e a IA escrevia que elas "não
   * venderam nada este mês". O mestre continua vendo o grupo inteiro.
   */
  const lojas = vejoTodasAsLojas(auth) ? NOMES_EMPRESAS : [auth.empresa];

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
          .select("empresa, valor, valor_fechado, data")
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
          .select("empresa, origem, status, reclamacao, reclamacao_resolvida, avaliou_loja, nota_avaliacao, data_agendamento")
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
  for (const empresa of lojas) funis.set(empresa, await carregarFunil(supabase, empresa));
  // Em aberto pela régua de src/lib/kpis.ts: pós-venda e lead frio não são
  // negócio parado.
  const abertaNaLoja = (o: { empresa?: unknown; etapa?: unknown }) => {
    const f = funis.get(String(o.empresa ?? ""));
    return !!f && negocioEmAberto(String(o.etapa ?? ""), f);
  };
  const ultimaAtividade = await buscarUltimaAtividade(
    supabase,
    (oportunidades ?? []).filter(abertaNaLoja).map((o) => o.relacionamento_id as string | null),
  );

  const linhasPorEmpresa = lojas.map((empresa) => {
    // Valor fechado (com desconto), não o valor de tabela: é o que as telas
    // de Vendas e o ranking mostram.
    const vendasLoja = (vendas ?? []).filter((v) => v.empresa === empresa);
    const vendasMes = totalVendido(vendasDoMes(vendasLoja, mesAtual));
    const vendasMesAnterior = totalVendido(vendasDoMes(vendasLoja, mesPassado));

    // Antes somava TODOS os negócios — ganhos, perdidos e pós-venda junto —
    // e a IA comentava um "pipeline aberto" maior que o do quadro do Pipeline.
    const oportunidadesLoja = (oportunidades ?? []).filter((o) => o.empresa === empresa);
    const pipelineAbertoLoja = pipelineAberto(oportunidadesLoja, funis.get(empresa) ?? []).valor;
    const paradas = oportunidadesLoja.filter(
      (o) =>
        abertaNaLoja(o) &&
        diasParadoDaLinha(o, ultimaAtividade.get(o.relacionamento_id as string)) >= DIAS_PARA_PARADO,
    ).length;

    const leadsLoja = (leads ?? []).filter((l) => l.empresa === empresa);
    // Os que AINDA esperam (a mesma conta do cartão "Leads sem resposta"):
    // lead escalado que depois foi atendido, esfriou ou se perdeu não conta.
    const leadsEscalonados = leadsLoja.filter((l) => l.gestor_notificado && l.status === "repassado_vendedor").length;
    const leadsPerdidos = leadsLoja.filter((l) => l.status === "perdido").length;

    const posVendaLoja = (posVendas ?? []).filter((p) => p.empresa === empresa);
    const reclamacoesAbertas = posVendaLoja.filter((p) => p.reclamacao?.trim() && !p.reclamacao_resolvida).length;
    // A régua da tela de pós-venda: cliente antigo não é venda, e quem
    // avaliou sem dar nota não entra na média (antes entrava como zero).
    const notaMediaLoja = notaMedia(
      posVendaLoja
        .filter((p) => p.origem !== "cliente_antigo" && p.avaliou_loja)
        .map((p) => p.nota_avaliacao as number | null),
    );

    const vendedoresAtivos = (perfis ?? []).filter(
      (p) => p.empresa === empresa && CARGOS_QUE_VENDEM.includes(p.cargo) && p.ativo
    ).length;

    return {
      empresa,
      vendedoresAtivos,
      vendasMes,
      vendasMesAnterior,
      pipelineAberto: pipelineAbertoLoja,
      oportunidadesParadas: paradas,
      leadsEscalonados,
      leadsPerdidos,
      reclamacoesAbertas,
      notaMedia: notaMediaLoja,
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
