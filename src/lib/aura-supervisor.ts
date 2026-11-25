import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient } from "@/lib/openai-client";
import { carregarFunil } from "@/lib/funil-servidor";
import { ehFechada, ehGanho, nomesDasEtapas } from "@/lib/funil";
import { CARGOS_QUE_VENDEM } from "@/lib/types";
import { diaEmSaoPaulo, inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { buscarUltimaAtividade, diasParadoDaLinha, DIAS_PARA_PARADO } from "@/lib/oportunidade-parada";
import { diasSemContato, esfriando, followupVencido } from "@/lib/relacionamento-atencao";
import { negocioEmAberto } from "@/lib/kpis";

/** Quantos contatos de cada tipo viram recomendação, para sobrar vaga aos negócios parados. */
const MAX_FOLLOWUP_VENCIDO = 6;
const MAX_ESFRIANDO = 4;
const ORDEM_PRIORIDADE: Record<SupervisorPrioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

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
  return diaEmSaoPaulo(); // UTC marcava o prazo para amanhã depois das 21h
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
      // Sem isto a ponte anotava o custo como "chat" e o painel misturava a
      // supervisão com as conversas do Coach.
    }, { __funcao: "supervisao" } as never);
    return resposta.choices[0]?.message?.content?.trim() || fallback;
  } catch (erro) {
    console.error("AURA Supervisor: falha no resumo da IA", erro);
    return fallback;
  }
}

async function analisarVendedor(supabase: SupabaseClient, vendedor: Vendedor) {
  const inicio = inicioDaJanela();
  const agora = new Date().toISOString();
  /**
   * "Negócio ainda em aberto" = toda etapa que não é de ganho nem de perda,
   * segundo o funil DESTA loja.
   *
   * Antes era `.neq("etapa", <nome do ganho> ?? "Fechados")` — um nome só. Isso
   * deixava os PERDIDOS entrarem na lista de negócios a cobrar (a AURA ficava
   * pedindo follow-up de quem já tinha dito não) e, para o negócio gravado com
   * o nome antigo, deixava passar também o que já estava fechado.
   */
  const funilDaLoja = await carregarFunil(supabase, vendedor.empresa);
  const etapasDecididas = nomesDasEtapas(funilDaLoja).filter((n) =>
    ehFechada(n, funilDaLoja),
  );

  const [relacionamentos, oportunidades, atividades] = await Promise.all([
    supabase
      .from("relacionamentos")
      .select("id,nome,proximo_contato_em,ultimo_contato_em,created_at")
      .eq("owner_id", vendedor.id)
      .eq("empresa", vendedor.empresa),
    supabase
      .from("oportunidades")
      .select("id,cliente,etapa,valor,relacionamento_id,created_at,updated_at")
      .eq("owner_id", vendedor.id)
      .eq("empresa", vendedor.empresa)
      .not("etapa", "in", `(${etapasDecididas.map((n) => `"${n}"`).join(",")})`)
      // Mais antigos primeiro; a ordem final sai do "dias parado" calculado.
      .order("updated_at", { ascending: true }),
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
  /*
   * Dias parado calculado: o mais recente entre a última alteração do
   * negócio e a última atividade com o cliente. A coluna dias_parado estava
   * em 0 em todos os negócios e este alerta (≥ 7 / ≥ 14 dias) nunca disparava.
   */
  const ultimaAtividade = await buscarUltimaAtividade(
    supabase,
    (oportunidades.data ?? []).map((o) => o.relacionamento_id as string | null),
  );
  // A consulta já tira ganho e perda; aqui sai também o pós-venda (e o lead
  // frio), que ficam parados por natureza — a régua de src/lib/kpis.ts.
  const opps = (oportunidades.data ?? [])
    .filter((o) => negocioEmAberto(o.etapa as string, funilDaLoja))
    .map((o) => ({ ...o, dias_parado: diasParadoDaLinha(o, ultimaAtividade.get(o.relacionamento_id as string)) }))
    .sort((a, b) => b.dias_parado - a.dias_parado);
  const acts = atividades.data ?? [];

  /*
   * Follow-up e "esfriando" pela MESMA régua do Meu Dia
   * (src/lib/relacionamento-atencao.ts):
   *   - vencido = a data marcada em proximo_contato_em já passou (com meio
   *     dia de folga);
   *   - esfriando = 15 dias ou mais sem contato registrado.
   * Antes procurava a palavra "atrasado" no texto de proximo_contato (que a
   * tela escreve "a definir", "amanhã"…) e usava a temperatura manual: a
   * supervisão cobrava contatos diferentes dos que o cartão do Meu Dia
   * mostrava, e quase nunca achava follow-up vencido.
   */
  const agoraMs = Date.now();
  const comoContato = (r: { proximo_contato_em: string | null; ultimo_contato_em: string | null; created_at: string | null }) => ({
    proximoContatoEm: r.proximo_contato_em ?? undefined,
    ultimoContatoEm: r.ultimo_contato_em ?? undefined,
    criadoEm: r.created_at ?? undefined,
  });
  const vencidos = rels
    .filter((r) => followupVencido(comoContato(r), agoraMs))
    .sort((a, b) => String(a.proximo_contato_em).localeCompare(String(b.proximo_contato_em)));
  const vencidosIds = new Set(vencidos.map((r) => r.id));
  const frios = rels
    .filter((r) => !vencidosIds.has(r.id) && esfriando(comoContato(r), agoraMs))
    .map((r) => ({ r, dias: diasSemContato(comoContato(r), agoraMs) ?? 0 }))
    .sort((a, b) => b.dias - a.dias);

  if (vencidos.length > MAX_FOLLOWUP_VENCIDO || frios.length > MAX_ESFRIANDO) {
    riscos.push({
      codigo: "follow_up_carteira",
      titulo: "Carteira pedindo contato",
      detalhe: `${vencidos.length} follow-up(s) vencido(s) e ${frios.length} contato(s) esfriando (15 dias ou mais sem contato).`,
      prioridade: vencidos.length ? "alta" : "media",
    });
  }
  for (const rel of vencidos.slice(0, MAX_FOLLOWUP_VENCIDO)) {
    const detalhe = `${rel.nome} tinha contato marcado para ${new Date(rel.proximo_contato_em as string).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} e o follow-up venceu.`;
    riscos.push({ codigo: "follow_up", titulo: "Follow-up vencido", detalhe, prioridade: "alta", entidadeTipo: "relacionamento", entidadeId: rel.id });
    recomendacoes.push({ titulo: `Contatar ${rel.nome}`, descricao: `${detalhe} Faça o contato e registre o próximo passo no CRM.`, prioridade: "alta", entidadeTipo: "relacionamento", entidadeId: rel.id });
  }
  for (const { r: rel, dias } of frios.slice(0, MAX_ESFRIANDO)) {
    const detalhe = `${rel.nome} está há ${dias} dias sem contato registrado (esfriando).`;
    riscos.push({ codigo: "esfriando", titulo: "Contato esfriando", detalhe, prioridade: "media", entidadeTipo: "relacionamento", entidadeId: rel.id });
    recomendacoes.push({ titulo: `Reaquecer ${rel.nome}`, descricao: `${detalhe} Retome a conversa e registre o próximo passo no CRM.`, prioridade: "media", entidadeTipo: "relacionamento", entidadeId: rel.id });
  }

  for (const opp of opps.slice(0, 10)) {
    const diasParado = opp.dias_parado;
    if (diasParado >= DIAS_PARA_PARADO) {
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
      // As mais importantes primeiro: o corte em 12 não pode deixar de fora o
      // negócio parado (urgente) por causa de um contato esfriando (média).
      [...recomendacoes]
        .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade])
        .slice(0, 12)
        .map((recomendacao) => ({
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
  /*
   * Só quem está na equipe. Antes entravam também os desativados e os
   * excluídos: a AURA gastava IA supervisionando quem saiu e deixava
   * recomendações pendentes para contas que ninguém mais abre.
   */
  const { data: vendedores, error } = await supabase
    .from("profiles")
    .select("id,nome,empresa")
    .in("cargo", CARGOS_QUE_VENDEM)
    .eq("ativo", true)
    .is("excluido_em", null);
  if (error) throw error;

  /*
   * Uma supervisão por pessoa por dia (de São Paulo). O cron chamado duas
   * vezes — repetição do crontab, deploy no meio, chamada manual — gravava a
   * segunda supervisão e dobrava as recomendações no Meu Dia do vendedor.
   * Se a conferência falhar, o cron falha: duplicar é pior que esperar amanhã.
   */
  const { data: deHoje, error: erroDeHoje } = await supabase
    .from("aura_supervisoes")
    .select("vendedor_id")
    .gte("criado_em", inicioDoDiaEmSaoPaulo());
  if (erroDeHoje) throw erroDeHoje;
  const jaSupervisionados = new Set((deHoje ?? []).map((s) => String(s.vendedor_id)));

  const resultados = [];
  for (const vendedor of (vendedores ?? []) as Vendedor[]) {
    if (jaSupervisionados.has(String(vendedor.id))) continue;
    try {
      resultados.push(await analisarVendedor(supabase, vendedor));
    } catch (erro) {
      console.error(`AURA Supervisor: falha para ${vendedor.id}`, erro);
      resultados.push({ vendedor: vendedor.nome, erro: true });
    }
  }
  return resultados;
}
