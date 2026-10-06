import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient } from "@/lib/openai-client";
import { carregarFunil } from "@/lib/funil-servidor";
import { ehGanho, nomeDaChave } from "@/lib/funil";

export type SupervisorPrioridade = "urgente" | "alta" | "media" | "baixa";

interface Risco {
  codigo: string;
  titulo: string;
  detalhe: string;
  prioridade: SupervisorPrioridade;
  entidadeTipo?: string;
  entidadeId?: string;
}

interface Recomendacao {
  titulo: string;
  descricao: string;
  prioridade: SupervisorPrioridade;
  entidadeTipo?: string;
  entidadeId?: string;
}

interface Vendedor {
  id: string;
  nome: string;
  empresa: string;
}

function inicioDaJanela() {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 7);
  return inicio.toISOString();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function prioridadePorRisco(valor: number): SupervisorPrioridade {
  if (valor >= 3) return "urgente";
  if (valor >= 2) return "alta";
  return "media";
}

async function resumoComIA(nome: string, riscos: Risco[], atividades: number, oportunidades: number) {
  const cliente = getOpenAIClient();
  const fallback = riscos.length
    ? `${nome} tem ${riscos.length} ponto(s) de atenção. Priorize ${riscos[0].titulo.toLowerCase()} e registre o próximo passo no CRM.`
    : `${nome} não apresenta riscos críticos nesta rodada. Mantenha o ritmo de atividades e follow-ups.`;
  if (!cliente) return fallback;

  try {
    const resposta = await cliente.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: "Você é a AURA Supervisora. Escreva um resumo curto, direto e respeitoso em português do Brasil. Use somente os dados fornecidos. Não invente números e não ordene alterações irreversíveis no CRM.",
        },
        {
          role: "user",
          content: JSON.stringify({ vendedor: nome, atividadesUltimos7Dias: atividades, oportunidadesAbertas: oportunidades, riscos }),
        },
      ],
    });
    return resposta.choices[0]?.message?.content?.trim() || fallback;
  } catch (erro) {
    console.error("AURA Supervisor: falha no resumo da IA", erro);
    return fallback;
  }
}

async function analisarVendedor(supabase: SupabaseClient, vendedor: Vendedor) {
  const inicio = inicioDaJanela();
  const agora = new Date().toISOString();
  const [relacionamentos, oportunidades, atividades] = await Promise.all([
    supabase
      .from("relacionamentos")
      .select("id,nome,temperatura,proximo_contato,ultimo_contato")
      .eq("owner_id", vendedor.id)
      .eq("empresa", vendedor.empresa),
    supabase
      .from("oportunidades")
      .select("id,cliente,etapa,dias_parado,valor")
      .eq("owner_id", vendedor.id)
      .eq("empresa", vendedor.empresa)
      .neq("etapa", nomeDaChave("fechamento", await carregarFunil(supabase, vendedor.empresa)) ?? "Fechados")
      .order("dias_parado", { ascending: false }),
    supabase
      .from("atividades")
      .select("id,titulo,contexto,created_at")
      .eq("owner_id", vendedor.id)
      .eq("empresa", vendedor.empresa)
      .gte("created_at", inicio),
  ]);

  if (relacionamentos.error) throw relacionamentos.error;
  if (oportunidades.error) throw oportunidades.error;
  if (atividades.error) throw atividades.error;

  const riscos: Risco[] = [];
  const recomendacoes: Recomendacao[] = [];
  const rels = relacionamentos.data ?? [];
  const opps = oportunidades.data ?? [];
  const acts = atividades.data ?? [];

  for (const rel of rels) {
    const proximo = String(rel.proximo_contato ?? "").toLowerCase();
    const frio = rel.temperatura === "frio" || rel.temperatura === "esfriando";
    const atrasado = proximo.includes("atrasado") || proximo.includes("hoje");
    if (frio || atrasado) {
      const prioridade = atrasado ? "alta" : "media";
      const detalhe = `${rel.nome} está ${frio ? "esfriando" : "com contato previsto para hoje/atrasado"}.`;
      riscos.push({ codigo: "follow_up", titulo: "Follow-up precisa de atenção", detalhe, prioridade, entidadeTipo: "relacionamento", entidadeId: rel.id });
      recomendacoes.push({ titulo: `Contatar ${rel.nome}`, descricao: `${detalhe} Faça o contato e registre o próximo passo no CRM.`, prioridade, entidadeTipo: "relacionamento", entidadeId: rel.id });
    }
  }

  for (const opp of opps.slice(0, 10)) {
    const diasParado = Number(opp.dias_parado ?? 0);
    if (diasParado >= 7) {
      const prioridade = prioridadePorRisco(diasParado >= 14 ? 3 : 2);
      riscos.push({ codigo: "oportunidade_parada", titulo: "Oportunidade parada", detalhe: `${opp.cliente} está há ${diasParado} dias sem avanço.`, prioridade, entidadeTipo: "oportunidade", entidadeId: opp.id });
      recomendacoes.push({ titulo: `Destravar ${opp.cliente}`, descricao: `Revise a objeção, faça o follow-up e registre o próximo passo. A oportunidade está parada há ${diasParado} dias.`, prioridade, entidadeTipo: "oportunidade", entidadeId: opp.id });
    }
  }

  if (acts.length === 0) {
    riscos.push({ codigo: "sem_atividade", titulo: "Sem atividade registrada", detalhe: "Nenhuma atividade foi registrada nos últimos 7 dias.", prioridade: "urgente" });
    recomendacoes.push({ titulo: "Registrar a rotina comercial", descricao: "Registre as visitas, ligações e reuniões realizadas e defina o próximo passo de cada contato.", prioridade: "urgente" });
  } else if (acts.length < 3) {
    riscos.push({ codigo: "ritmo_baixo", titulo: "Ritmo de execução baixo", detalhe: `Foram registradas apenas ${acts.length} atividades nos últimos 7 dias.`, prioridade: "alta" });
    recomendacoes.push({ titulo: "Aumentar o ritmo de execução", descricao: "Reserve blocos de prospecção e follow-up e registre cada interação no CRM.", prioridade: "alta" });
  }

  const score = Math.max(0, Math.min(100, 100 - riscos.reduce((total, risco) => total + (risco.prioridade === "urgente" ? 25 : risco.prioridade === "alta" ? 15 : 8), 0)));
  const resumo = await resumoComIA(vendedor.nome, riscos.slice(0, 8), acts.length, opps.length);

  const { data: supervisao, error: erroSupervisao } = await supabase
    .from("aura_supervisoes")
    .insert({ vendedor_id: vendedor.id, empresa: vendedor.empresa, janela_inicio: inicio, janela_fim: agora, score, resumo, riscos })
    .select("id")
    .single();
  if (erroSupervisao) throw erroSupervisao;

  if (recomendacoes.length) {
    const { error } = await supabase.from("aura_recomendacoes").insert(
      recomendacoes.slice(0, 12).map((recomendacao) => ({
        supervisao_id: supervisao.id,
        vendedor_id: vendedor.id,
        empresa: vendedor.empresa,
        titulo: recomendacao.titulo,
        descricao: recomendacao.descricao,
        prioridade: recomendacao.prioridade,
        origem: "supervisao_aura",
        entidade_tipo: recomendacao.entidadeTipo ?? null,
        entidade_id: recomendacao.entidadeId ?? null,
        prazo: hojeISO(),
      })),
    );
    if (error) throw error;
  }

  return { vendedor: vendedor.nome, score, riscos: riscos.length, recomendacoes: recomendacoes.length };
}

export async function executarSupervisaoAura(supabase: SupabaseClient) {
  const { data: vendedores, error } = await supabase
    .from("profiles")
    .select("id,nome,empresa")
    .eq("cargo", "Vendedor");
  if (error) throw error;

  const resultados = [];
  for (const vendedor of (vendedores ?? []) as Vendedor[]) {
    try {
      resultados.push(await analisarVendedor(supabase, vendedor));
    } catch (erro) {
      console.error(`AURA Supervisor: falha para ${vendedor.id}`, erro);
      resultados.push({ vendedor: vendedor.nome, erro: true });
    }
  }
  return resultados;
}
