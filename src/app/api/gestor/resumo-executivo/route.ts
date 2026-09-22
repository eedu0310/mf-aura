import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getOpenAIClient } from "@/lib/openai-client";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!["Gestor", "Diretor"].includes(auth.cargo)) {
    return NextResponse.json({ erro: "Só Gestor ou Diretor podem gerar esse resumo." }, { status: 403 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ erro: "Configure OPENAI_API_KEY no .env.local." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const mesAtual = new Date().toISOString().slice(0, 7);
  const mesPassadoDate = new Date();
  mesPassadoDate.setMonth(mesPassadoDate.getMonth() - 1);
  const mesPassado = mesPassadoDate.toISOString().slice(0, 7);

  const [
    { data: vendas },
    { data: oportunidades },
    { data: leads },
    { data: posVendas },
    { data: perfis },
  ] = await Promise.all([
    supabase.from("vendas").select("empresa, valor, data"),
    supabase.from("oportunidades").select("empresa, valor, etapa, dias_parado"),
    supabase.from("leads_recebidos").select("empresa, status, gestor_notificado, urgencia"),
    supabase.from("pos_vendas").select("empresa, status, reclamacao, reclamacao_resolvida, avaliou_loja, nota_avaliacao, data_agendamento"),
    supabase.from("profiles").select("empresa, cargo, ativo"),
  ]);

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
    const paradas = oportunidadesLoja.filter((o) => Number(o.dias_parado) >= 7).length;

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
      (p) => p.empresa === empresa && p.cargo === "Vendedor" && p.ativo
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
    });

    const texto = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ resumo: texto || "Não consegui gerar o resumo agora." });
  } catch (err) {
    console.error("Erro ao gerar resumo executivo:", err);
    return NextResponse.json({ erro: "Não consegui gerar o resumo agora." }, { status: 500 });
  }
}
