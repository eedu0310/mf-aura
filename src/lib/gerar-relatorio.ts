import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarClaude } from "@/lib/aura/texto-ia";

interface MetaCompromisso {
  metaFaturamento: number;
  metaClientesNovos: number;
  metaArquitetos: number;
  metaConstrutoras: number;
  metaObras: number;
  metaVisitas: number;
  metaLigacoes: number;
}

interface DadosVendedor {
  nome: string;
  prospectou: number;
  visitouArquitetos: number;
  visitouConstrutoras: number;
  visitas: number;
  ligacoes: number;
  followUps: number;
  vendas: number;
  valorVendido: number;
  vendasAVista: number;
  valorAVista: number;
  vendasParceladas: number;
  valorParcelado: number;
  clientesSemContato: { nome: string; dias: number }[];
  conversaoAtual: number;
  conversaoAnterior: number;
  metas: MetaCompromisso | null;
}

async function buscarCompromissoAprovado(
  supabase: SupabaseClient,
  vendedorId: string,
  mes: string
): Promise<MetaCompromisso | null> {
  const { data } = await supabase
    .from("compromissos_mensais")
    .select(
      "meta_faturamento, meta_clientes_novos, meta_arquitetos, meta_construtoras, meta_obras, meta_visitas, meta_ligacoes"
    )
    .eq("vendedor_id", vendedorId)
    .eq("mes", mes)
    .eq("status", "aprovado")
    .maybeSingle();

  if (!data) return null;

  return {
    metaFaturamento: Number(data.meta_faturamento),
    metaClientesNovos: Number(data.meta_clientes_novos),
    metaArquitetos: Number(data.meta_arquitetos),
    metaConstrutoras: Number(data.meta_construtoras),
    metaObras: Number(data.meta_obras),
    metaVisitas: Number(data.meta_visitas),
    metaLigacoes: Number(data.meta_ligacoes),
  };
}

async function coletarDadosVendedor(
  supabase: SupabaseClient,
  vendedorId: string,
  nome: string,
  inicioISO: string,
  fimISO: string,
  inicioAnteriorISO: string
): Promise<DadosVendedor> {
  const mesDoRelatorio = fimISO.slice(0, 7);

  const [
    { data: atividades },
    { data: vendas },
    { data: relacionamentos },
    { data: oportunidades },
    { data: oportunidadesAnterior },
    metas,
  ] = await Promise.all([
    supabase
      .from("atividades")
      .select("tipo, relacionamento_id, created_at")
      .eq("owner_id", vendedorId)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO),
    supabase
      .from("vendas")
      .select("valor, valor_fechado, forma_pagamento, quantidade_parcelas, data")
      .eq("owner_id", vendedorId)
      .gte("data", inicioISO.slice(0, 10))
      .lte("data", fimISO.slice(0, 10)),
    supabase.from("relacionamentos").select("id, nome, categoria, ultimo_contato, proximo_contato").eq("owner_id", vendedorId),
    supabase.from("oportunidades").select("etapa").eq("owner_id", vendedorId).gte("created_at", inicioISO).lte("created_at", fimISO),
    supabase
      .from("oportunidades")
      .select("etapa")
      .eq("owner_id", vendedorId)
      .gte("created_at", inicioAnteriorISO)
      .lt("created_at", inicioISO),
    buscarCompromissoAprovado(supabase, vendedorId, mesDoRelatorio),
  ]);

  const relIds = (atividades ?? []).map((a) => a.relacionamento_id).filter(Boolean);
  const categoriaPorRelId = new Map((relacionamentos ?? []).map((r) => [r.id, r.categoria as string]));

  const prospectou = (atividades ?? []).filter((a) => a.tipo === "Cadastro" || a.tipo === "Prospecção").length;
  const visitouArquitetos = relIds.filter((id) => categoriaPorRelId.get(id as string) === "Arquiteto").length;
  const visitouConstrutoras = relIds.filter((id) => categoriaPorRelId.get(id as string) === "Construtora").length;
  const visitas = (atividades ?? []).filter((a) => a.tipo?.toLowerCase().includes("visita")).length;
  const ligacoes = (atividades ?? []).filter((a) => a.tipo?.toLowerCase().includes("liga")).length;
  const followUps = (atividades ?? []).filter((a) => a.tipo === "Follow-up").length;
  const valorVendido = (vendas ?? []).reduce((s, v) => s + Number(v.valor), 0);
  const vendasAVista = (vendas ?? []).filter((v) => Number(v.quantidade_parcelas ?? 1) <= 1 || ["À vista", "Pix", "Dinheiro"].includes(String(v.forma_pagamento))).length;
  const vendasParceladas = (vendas ?? []).length - vendasAVista;
  const valorAVista = (vendas ?? []).filter((v) => Number(v.quantidade_parcelas ?? 1) <= 1 || ["À vista", "Pix", "Dinheiro"].includes(String(v.forma_pagamento))).reduce((s, v) => s + Number(v.valor_fechado ?? v.valor), 0);
  const valorParcelado = (vendas ?? []).filter((v) => !(Number(v.quantidade_parcelas ?? 1) <= 1 || ["À vista", "Pix", "Dinheiro"].includes(String(v.forma_pagamento)))).reduce((s, v) => s + Number(v.valor_fechado ?? v.valor), 0);

  const clientesSemContato = (relacionamentos ?? [])
    .filter((r) => r.proximo_contato?.toLowerCase().includes("atrasad"))
    .slice(0, 8)
    .map((r) => ({ nome: r.nome as string, dias: 0 }));

  const fechadasAtual = (oportunidades ?? []).filter((o) => o.etapa === "Fechados").length;
  const totalAtual = (oportunidades ?? []).length;
  const fechadasAnterior = (oportunidadesAnterior ?? []).filter((o) => o.etapa === "Fechados").length;
  const totalAnterior = (oportunidadesAnterior ?? []).length;

  return {
    nome,
    prospectou,
    visitouArquitetos,
    visitouConstrutoras,
    visitas,
    ligacoes,
    followUps,
    vendas: (vendas ?? []).length,
    valorVendido,
    vendasAVista,
    valorAVista,
    vendasParceladas,
    valorParcelado,
    clientesSemContato,
    conversaoAtual: totalAtual > 0 ? Math.round((fechadasAtual / totalAtual) * 100) : 0,
    conversaoAnterior: totalAnterior > 0 ? Math.round((fechadasAnterior / totalAnterior) * 100) : 0,
    metas,
  };
}

function montarPromptVendedor(d: DadosVendedor): string {
  let texto = `${d.nome}
Prospectou ${d.prospectou} clientes novos
Visitou ${d.visitouArquitetos} arquitetos e ${d.visitouConstrutoras} construtoras
Fez ${d.visitas} visitas e ${d.ligacoes} ligações registradas
Fez ${d.followUps} follow-ups
Registrou ${d.vendas} venda(s), totalizando R$ ${d.valorVendido.toLocaleString("pt-BR")}
Forma de recebimento: ${d.vendasAVista} à vista (R$ ${d.valorAVista.toLocaleString("pt-BR")}) e ${d.vendasParceladas} parcelada(s) (R$ ${d.valorParcelado.toLocaleString("pt-BR")})
Taxa de conversão do período: ${d.conversaoAtual}% (período anterior: ${d.conversaoAnterior}%)
Clientes com follow-up atrasado: ${d.clientesSemContato.length > 0 ? d.clientesSemContato.map((c) => c.nome).join(", ") : "nenhum"}`;

  if (d.metas) {
    texto += `

METAS DO MÊS QUE ELE MESMO DEFINIU E O GESTOR APROVOU (comparar com os números acima):
Faturamento: meta R$ ${d.metas.metaFaturamento.toLocaleString("pt-BR")} — vendido no período R$ ${d.valorVendido.toLocaleString("pt-BR")}
Clientes novos: meta ${d.metas.metaClientesNovos} — feito ${d.prospectou}
Arquitetos: meta ${d.metas.metaArquitetos} — feito ${d.visitouArquitetos}
Construtoras: meta ${d.metas.metaConstrutoras} — feito ${d.visitouConstrutoras}
Visitas: meta ${d.metas.metaVisitas} — feito ${d.visitas}
Ligações: meta ${d.metas.metaLigacoes} — feito ${d.ligacoes}`;
  } else {
    texto += `\n\nEsse vendedor ainda não tem um Compromisso Mensal aprovado pelo gestor pra este mês.`;
  }

  return texto;
}

export async function gerarRelatorioVendedor(
  supabase: SupabaseClient,
  vendedorId: string,
  nome: string,
  empresa: string,
  periodoInicio: Date,
  periodoFim: Date
): Promise<{ conteudo: string; dados: DadosVendedor; erro?: undefined } | { conteudo?: undefined; dados?: undefined; erro: string }> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
    const msg = "Falta a chave da IA (ANTHROPIC_API_KEY) no .env.local do servidor.";
    console.error("gerarRelatorioVendedor:", msg);
    return { erro: msg };
  }

  const periodoAnteriorInicio = new Date(periodoInicio);
  periodoAnteriorInicio.setDate(periodoAnteriorInicio.getDate() - (periodoFim.getTime() - periodoInicio.getTime()) / 86400000);

  const dados = await coletarDadosVendedor(
    supabase,
    vendedorId,
    nome,
    periodoInicio.toISOString(),
    periodoFim.toISOString(),
    periodoAnteriorInicio.toISOString()
  );

  let texto: string;
  try {
    texto = await chamarClaude({
      sistema: `Você é a AURA Coach, secretária/analista pessoal de vendedores de uma rede de lojas de lareiras e aquecimento. Escreva um relatório curto e direto sobre a semana do vendedor, em português, com EXATAMENTE esta estrutura (use os títulos literalmente):

Pontos fortes
(1-2 frases citando o que foi bom, baseado só nos dados reais)

Pontos de atenção
(1-3 frases apontando problemas reais: clientes sem contato, conversão caindo, poucas visitas etc. IMPORTANTE: se o vendedor tiver metas do mês definidas (comparação abaixo), esse é o primeiro lugar pra apontar — cite explicitamente qual item está abaixo do ritmo esperado pra essa altura do mês/semana, com os números reais dele mesmo)

Prioridades da Semana
(2-4 ações concretas e práticas pra próxima semana, como se você fosse a secretária dele: "retornar orçamento pro cliente X", "ligar pra Y", "faltam Z visitas pra bater a meta de arquitetos", etc — baseado nos dados)

Seja específico, cite nomes e números quando disponíveis, nunca invente. Se os dados forem muito escassos, diga isso com gentileza em vez de inventar.`,
      pergunta: montarPromptVendedor(dados),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.";
    console.error("gerarRelatorioVendedor: erro na chamada da IA:", err);
    return { erro: msg };
  }

  const conteudo = texto.trim();
  if (!conteudo) {
    const msg = "A IA não retornou nenhum conteúdo.";
    console.error("gerarRelatorioVendedor:", msg, nome);
    return { erro: msg };
  }

  const { error: erroInsert } = await supabase.from("relatorios_periodicos").insert({
    empresa,
    vendedor_id: vendedorId,
    tipo: "semanal_vendedor",
    periodo_inicio: periodoInicio.toISOString().slice(0, 10),
    periodo_fim: periodoFim.toISOString().slice(0, 10),
    conteudo,
    dados_json: dados,
  });
  if (erroInsert) {
    console.error("gerarRelatorioVendedor: erro ao salvar relatório:", erroInsert);
    return { erro: `Relatório gerado, mas não consegui salvar: ${erroInsert.message}` };
  }

  return { conteudo, dados };
}

export async function gerarRelatorioLoja(
  supabase: SupabaseClient,
  empresa: string,
  periodoInicio: Date,
  periodoFim: Date,
  tipo: "semanal_gestor" | "mensal_diretor"
): Promise<{ conteudo: string; erro?: undefined } | { conteudo?: undefined; erro: string }> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
    const msg = "Falta a chave da IA (ANTHROPIC_API_KEY) no .env.local do servidor.";
    console.error("gerarRelatorioLoja:", msg);
    return { erro: msg };
  }

  const { data: vendedores, error: erroVendedores } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("empresa", empresa)
    .in("cargo", ["Vendedor", "Vendedor Interno"])
    .eq("ativo", true);

  if (erroVendedores) {
    console.error("gerarRelatorioLoja: erro ao buscar vendedores:", erroVendedores);
    return { erro: `Erro ao buscar vendedores: ${erroVendedores.message}` };
  }
  if (!vendedores || vendedores.length === 0) {
    const msg = `Nenhum vendedor ativo (papel "Vendedor" ou "Vendedor Interno") encontrado em ${empresa}.`;
    console.error("gerarRelatorioLoja:", msg);
    return { erro: msg };
  }

  const relatoriosVendedores = await Promise.all(
    vendedores.map((v) =>
      coletarDadosVendedor(
        supabase,
        v.id,
        v.nome as string,
        periodoInicio.toISOString(),
        periodoFim.toISOString(),
        periodoInicio.toISOString()
      )
    )
  );

  const resumoTextual = relatoriosVendedores.map(montarPromptVendedor).join("\n\n");

  let texto: string;
  try {
    texto = await chamarClaude({
      sistema: `Você é um analista comercial sênior escrevendo o relatório ${tipo === "semanal_gestor" ? "semanal" : "mensal"} consolidado da loja ${empresa} para ${tipo === "semanal_gestor" ? "o Gestor" : "o Diretor"}. Analise os dados de cada vendedor e escreva um resumo direto em português: quem se destacou, quem precisa de atenção/conversa individual, e prioridades gerais da loja para o período seguinte. IMPORTANTE: quando um vendedor tiver metas do mês (Compromisso Mensal aprovado) e estiver claramente abaixo do combinado em algum item, aponte isso especificamente — é justamente pra isso que essas metas existem, pra dar ao gestor motivo concreto de conversa individual. Máximo 6 tópicos com "•". Cite vendedores pelo nome. Não invente dados.`,
      pergunta: resumoTextual,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.";
    console.error("gerarRelatorioLoja: erro na chamada da IA:", err);
    return { erro: msg };
  }

  const conteudo = texto.trim();
  if (!conteudo) {
    const msg = "A IA não retornou nenhum conteúdo.";
    console.error(`gerarRelatorioLoja: ${msg}`, empresa);
    return { erro: msg };
  }

  const { error: erroInsertLoja } = await supabase.from("relatorios_periodicos").insert({
    empresa,
    vendedor_id: null,
    tipo,
    periodo_inicio: periodoInicio.toISOString().slice(0, 10),
    periodo_fim: periodoFim.toISOString().slice(0, 10),
    conteudo,
    dados_json: relatoriosVendedores,
  });
  if (erroInsertLoja) {
    console.error("gerarRelatorioLoja: erro ao salvar relatório:", erroInsertLoja);
    return { erro: `Relatório gerado, mas não consegui salvar: ${erroInsertLoja.message}` };
  }

  return { conteudo };
}
