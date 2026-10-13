import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarFunil } from "@/lib/funil-servidor";
import { ehGanho, ehPerda, type EtapaFunil } from "@/lib/funil";
import { somaDoVendedor, vendasDoVendedor, type VendaComParceria } from "@/lib/parceria";
import { CARGOS_QUE_VENDEM } from "@/lib/types";

/**
 * Coleta tudo o que o relatório semanal mostra, sem usar IA.
 *
 * Duas decisões que valem explicação:
 *
 * 1. Uma rodada de consultas por LOJA, não por vendedor. O gerador antigo
 *    fazia seis consultas para cada pessoa — com dez vendedores, sessenta
 *    idas ao banco para montar um relatório. Aqui são sete consultas no
 *    total e o agrupamento por pessoa acontece na memória.
 *
 * 2. As atividades são datadas por `ocorrida_em`, não por `created_at`.
 *    O vendedor que faz a visita na quinta e lança no sistema no sábado
 *    contava na semana errada.
 */

export interface ProspeccaoDaCategoria {
  categoria: string;
  /** Atividades do período com cliente dessa categoria. */
  atividades: number;
  /** Clientes dessa categoria cadastrados dentro do período. */
  clientesNovos: number;
}

export interface EtapaDoPipeline {
  etapa: string;
  negocios: number;
  valor: number;
}

export interface AtendimentoDoVendedor {
  /** Conversas que a AURA analisou dentro do período. */
  conversasAtivas: number;
  /** Conversas que nasceram dentro do período. */
  conversasNovas: number;
  conversasComAlerta: number;
  conversasSemProximaAcao: number;
  /** Conversas que a AURA marcou como fora do comercial (colega, fornecedor). */
  conversasIgnoradas: number;
  /** Os alertas que a AURA levantou, com quantas conversas cada um repetiu. */
  alertas: { texto: string; conversas: number }[];
  /** As dicas que a AURA deu, mesma contagem. */
  dicas: { texto: string; conversas: number }[];
  /** Conversas com nome, para a IA citar caso concreto em vez de generalizar. */
  exemplos: { cliente: string; etapa: string | null; alerta: string }[];
  porNatureza: { natureza: string; conversas: number }[];
}

export interface MetasDoMes {
  faturamento: number;
  clientesNovos: number;
  arquitetos: number;
  construtoras: number;
  obras: number;
  visitas: number;
  ligacoes: number;
}

export interface ItemDoProgresso {
  rotulo: string;
  meta: number;
  atingido: number;
  /** Quanto ainda falta para bater. Zero quando já bateu. */
  falta: number;
  percentual: number;
  /** Quanto por dia útil que sobra no mês, para fechar o que falta. */
  porDiaUtil: number;
  emReais: boolean;
}

export interface ProgressoDaMeta {
  mes: string;
  /** Último dia do mês já coberto por este relatório. */
  apuradoAte: string;
  diasUteisRestantes: number;
  itens: ItemDoProgresso[];
}

export interface SemanaDoVendedor {
  vendedorId: string;
  nome: string;
  cargo: string;
  crm: {
    atividades: number;
    porTipo: { tipo: string; n: number }[];
    visitas: number;
    ligacoes: number;
    orcamentos: number;
    followUps: number;
  };
  /**
   * Agenda da semana. "Marcados" e "realizados" são coisas diferentes e o
   * gestor cobra as duas: marcar dez e cumprir dois é um problema que um
   * número só esconderia.
   */
  agenda: {
    marcados: number;
    paraASemana: number;
    realizados: number;
    naoCumpridos: number;
    porTipo: { tipo: string; n: number }[];
  };
  prospeccao: {
    clientesNovos: number;
    porCategoria: ProspeccaoDaCategoria[];
  };
  pipeline: {
    criados: number;
    ganhos: number;
    perdidos: number;
    emAberto: number;
    valorEmAberto: number;
    porEtapa: EtapaDoPipeline[];
    motivosDePerda: { motivo: string; n: number }[];
  };
  vendas: {
    quantidade: number;
    /** Já respeitando a divisão do atendimento em dupla. */
    valor: number;
    valorCheio: number;
  };
  atendimento: AtendimentoDoVendedor;
  metas: MetasDoMes | null;
  /**
   * Meta é do MÊS; a semana é só um pedaço dela. Comparar venda da semana com
   * meta do mês daria um "12% da meta" que não quer dizer nada. Então aqui o
   * realizado é o acumulado do mês até o fim do período do relatório.
   */
  progresso: ProgressoDaMeta | null;
}

export interface SemanaDaLoja {
  empresa: string;
  periodoInicio: string;
  periodoFim: string;
  totais: {
    vendedores: number;
    atividades: number;
    visitas: number;
    clientesNovos: number;
    negociosCriados: number;
    negociosGanhos: number;
    negociosPerdidos: number;
    valorVendido: number;
    conversasAtivas: number;
    conversasComAlerta: number;
  };
  vendedores: SemanaDoVendedor[];
  /** O que não deu para medir, para o relatório não fingir que mediu. */
  lacunas: string[];
}

/** Agrupa e ordena do mais frequente para o menos. */
function contar<T>(itens: T[], chave: (i: T) => string | null | undefined) {
  const mapa = new Map<string, number>();
  for (const i of itens) {
    const k = (chave(i) ?? "").trim();
    if (!k) continue;
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([texto, n]) => ({ texto, n }));
}

function textosDoJsonb(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((v) => String(v).trim()).filter(Boolean);
}

export async function coletarSemanaDaLoja(
  sb: SupabaseClient,
  empresa: string,
  inicio: Date,
  fim: Date,
): Promise<SemanaDaLoja> {
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();
  const inicioDia = inicioISO.slice(0, 10);
  const fimDia = fimISO.slice(0, 10);
  /**
   * `fim` é exclusivo: a janela vai até o instante anterior a ele. O rótulo do
   * período, porém, tem de mostrar o último dia COBERTO, senão um relatório de
   * segunda a sábado apareceria como "a domingo" e o gestor cobraria um dia
   * que não entrou na conta.
   */
  const ultimoDiaCoberto = new Date(fim.getTime() - 86_400_000).toISOString().slice(0, 10);
  const mes = fimDia.slice(0, 7);

  const [
    rPessoas,
    rAtividades,
    rRelacionamentos,
    rOportunidades,
    rVendas,
    rConversas,
    rMetas,
    rVendasMes,
    rAtividadesMes,
    rCompromissos,
    funil,
  ] = await Promise.all([
    sb.from("profiles").select("id, nome, cargo").eq("empresa", empresa).eq("ativo", true),
    sb
      .from("atividades")
      .select("owner_id, tipo, subtipo, cliente_categoria, relacionamento_id, ocorrida_em")
      .eq("empresa", empresa)
      .gte("ocorrida_em", inicioISO)
      .lt("ocorrida_em", fimISO),
    sb.from("relacionamentos").select("id, owner_id, categoria, created_at").eq("empresa", empresa),
    sb
      .from("oportunidades")
      .select("owner_id, etapa, valor, created_at, motivo_perda, data_perda")
      .eq("empresa", empresa),
    sb
      .from("vendas")
      .select("owner_id, valor, valor_fechado, data, parceiro_id, percentual_parceiro")
      .eq("empresa", empresa)
      .gte("data", inicioDia)
      .lt("data", fimDia),
    sb
      .from("whatsapp_ia_leads")
      .select(
        "owner_id, nome, etapa, dicas, alertas, natureza, proxima_acao, ignorado, created_at, ultima_analise_em",
      )
      .eq("empresa", empresa),
    sb
      .from("compromissos_mensais")
      .select(
        "vendedor_id, meta_faturamento, meta_clientes_novos, meta_arquitetos, meta_construtoras, meta_obras, meta_visitas, meta_ligacoes",
      )
      .eq("mes", mes)
      .eq("status", "aprovado"),
    /*
     * Acumulado do mês, para comparar com a meta do mês. Vai do dia 1 até o
     * mesmo corte do relatório semanal, então o número nunca inclui dia que o
     * relatório diz não ter coberto.
     */
    sb
      .from("vendas")
      .select("owner_id, valor, valor_fechado, data, parceiro_id, percentual_parceiro")
      .eq("empresa", empresa)
      .gte("data", `${mes}-01`)
      .lt("data", fimDia),
    sb
      .from("atividades")
      .select("owner_id, tipo, subtipo, relacionamento_id, cliente_categoria, ocorrida_em")
      .eq("empresa", empresa)
      .gte("ocorrida_em", `${mes}-01T00:00:00.000Z`)
      .lt("ocorrida_em", fimISO),
    /*
     * Agenda. Sem filtro de data no SQL porque precisamos de duas janelas
     * diferentes sobre as mesmas linhas: o que foi CRIADO na semana e o que
     * estava MARCADO para a semana. A tabela é pequena.
     */
    sb
      .from("compromissos")
      .select("owner_id, tipo, data, concluido, created_at")
      .eq("empresa", empresa),
    carregarFunil(sb, empresa),
  ]);

  /**
   * Erro de leitura não pode virar relatório com zero. Um relatório que diz
   * "nenhuma visita esta semana" porque a consulta falhou é pior do que
   * relatório nenhum: o gestor cobra o vendedor por um número inventado.
   */
  const falhas = [
    ["pessoas", rPessoas.error],
    ["atividades", rAtividades.error],
    ["relacionamentos", rRelacionamentos.error],
    ["oportunidades", rOportunidades.error],
    ["vendas", rVendas.error],
    ["conversas", rConversas.error],
    ["metas", rMetas.error],
    ["vendas do mês", rVendasMes.error],
    ["atividades do mês", rAtividadesMes.error],
    ["agenda", rCompromissos.error],
  ].filter(([, e]) => e) as [string, { message: string }][];
  if (falhas.length) {
    throw new Error(
      `Não consegui ler ${falhas.map(([n]) => n).join(", ")} de ${empresa}: ` +
        falhas.map(([, e]) => e.message).join(" | "),
    );
  }

  const pessoas = rPessoas.data ?? [];
  const atividades = rAtividades.data ?? [];
  const relacionamentos = rRelacionamentos.data ?? [];
  const oportunidades = rOportunidades.data ?? [];
  const vendas = rVendas.data ?? [];
  const conversas = rConversas.data ?? [];
  const metas = rMetas.data ?? [];
  const vendasMes = rVendasMes.data ?? [];
  const atividadesMes = rAtividadesMes.data ?? [];
  const compromissos = rCompromissos.data ?? [];

  const categoriaDoRelacionamento = new Map(
    relacionamentos.map((r) => [String(r.id), String(r.categoria ?? "")]),
  );

  /**
   * Quem entra no relatório: o cargo que vende, mais qualquer pessoa com
   * atividade real no período. Sem a segunda metade a MF International sairia
   * em branco — as 70 conversas dela são do Charles, que é Gestor.
   */
  const comAtividade = new Set<string>();
  for (const a of atividades) if (a.owner_id) comAtividade.add(String(a.owner_id));
  for (const v of vendas) if (v.owner_id) comAtividade.add(String(v.owner_id));
  for (const c of conversas) {
    if (c.owner_id && c.ultima_analise_em && c.ultima_analise_em >= inicioISO && c.ultima_analise_em < fimISO) {
      comAtividade.add(String(c.owner_id));
    }
  }
  const entram = pessoas.filter(
    (p) => CARGOS_QUE_VENDEM.includes(String(p.cargo) as never) || comAtividade.has(String(p.id)),
  );

  const vendedores = entram.map((p) =>
    montarVendedor(String(p.id), String(p.nome ?? "sem nome"), String(p.cargo ?? ""), {
      atividades,
      relacionamentos,
      oportunidades,
      vendas,
      conversas,
      metas,
      funil,
      categoriaDoRelacionamento,
      inicioISO,
      fimISO,
      vendasMes,
      atividadesMes,
      compromissos,
      mes,
      ultimoDiaCoberto,
    }),
  );

  vendedores.sort((a, b) => b.vendas.valor - a.vendas.valor || a.nome.localeCompare(b.nome));

  const soma = (f: (v: SemanaDoVendedor) => number) => vendedores.reduce((s, v) => s + f(v), 0);

  const lacunas: string[] = [];
  /**
   * A tabela de mensagens do WhatsApp está vazia no banco, então contagem de
   * mensagem por texto não existe. O relatório fala de CONVERSAS, que é o que
   * de fato está registrado, e declara a diferença aqui em vez de deixar o
   * gestor achar que "conversas" é "mensagens".
   */
  lacunas.push(
    "A contagem é de conversas (novas e ativas no período), não de mensagens: o " +
      "histórico de mensagens não está sendo guardado no banco.",
  );
  if (vendedores.some((v) => v.metas === null)) {
    lacunas.push(
      "Sem meta aprovada do mês: " +
        vendedores.filter((v) => v.metas === null).map((v) => v.nome).join(", ") +
        ". Para esses não dá para dizer se o ritmo está dentro ou fora do combinado.",
    );
  }

  return {
    empresa,
    periodoInicio: inicioDia,
    periodoFim: ultimoDiaCoberto,
    totais: {
      vendedores: vendedores.length,
      atividades: soma((v) => v.crm.atividades),
      visitas: soma((v) => v.crm.visitas),
      clientesNovos: soma((v) => v.prospeccao.clientesNovos),
      negociosCriados: soma((v) => v.pipeline.criados),
      negociosGanhos: soma((v) => v.pipeline.ganhos),
      negociosPerdidos: soma((v) => v.pipeline.perdidos),
      valorVendido: soma((v) => v.vendas.valor),
      conversasAtivas: soma((v) => v.atendimento.conversasAtivas),
      conversasComAlerta: soma((v) => v.atendimento.conversasComAlerta),
    },
    vendedores,
    lacunas,
  };
}

interface Fontes {
  atividades: Record<string, unknown>[];
  relacionamentos: Record<string, unknown>[];
  oportunidades: Record<string, unknown>[];
  vendas: Record<string, unknown>[];
  conversas: Record<string, unknown>[];
  metas: Record<string, unknown>[];
  vendasMes: Record<string, unknown>[];
  atividadesMes: Record<string, unknown>[];
  compromissos: Record<string, unknown>[];
  mes: string;
  ultimoDiaCoberto: string;
  funil: EtapaFunil[];
  categoriaDoRelacionamento: Map<string, string>;
  inicioISO: string;
  fimISO: string;
}

function montarVendedor(id: string, nome: string, cargo: string, f: Fontes): SemanaDoVendedor {
  const meu = <T extends { owner_id?: unknown }>(l: T[]) => l.filter((x) => String(x.owner_id) === id);

  /**
   * A janela de data é reaplicada aqui mesmo para atividades e vendas, que já
   * vêm filtradas no SQL. É de propósito: assim o período é decidido em um
   * lugar só. Se amanhã alguém mexer na consulta e tirar o filtro, a conta
   * continua certa em vez de inflar o relatório sem ninguém perceber.
   */
  const noPeriodo = (valor: unknown, dia = false) => {
    const em = String(valor ?? "");
    if (!em) return false;
    return dia
      ? em >= f.inicioISO.slice(0, 10) && em < f.fimISO.slice(0, 10)
      : em >= f.inicioISO && em < f.fimISO;
  };

  const minhasAtividades = (meu(f.atividades as { owner_id?: unknown }[]) as Record<string, unknown>[]).filter(
    (a) => noPeriodo(a.ocorrida_em),
  );
  const temTipo = (frag: string) =>
    minhasAtividades.filter((a) => String(a.tipo ?? "").toLowerCase().includes(frag)).length;

  // ----------------------------------------------------------- prospecção
  const minhasRelacoes = meu(f.relacionamentos as { owner_id?: unknown }[]) as Record<string, unknown>[];
  const novasRelacoes = minhasRelacoes.filter((r) => noPeriodo(r.created_at));

  /**
   * A categoria vem do cliente ligado à atividade; quando a atividade foi
   * lançada solta, vale o que o vendedor digitou nela. É assim que "visitei
   * um arquiteto" aparece como arquiteto mesmo sem cliente cadastrado.
   */
  const categoriaDaAtividade = (a: Record<string, unknown>) =>
    f.categoriaDoRelacionamento.get(String(a.relacionamento_id ?? "")) ||
    String(a.cliente_categoria ?? "") ||
    String(a.subtipo ?? "");

  const categorias = new Set<string>([
    ...minhasAtividades.map(categoriaDaAtividade),
    ...novasRelacoes.map((r) => String(r.categoria ?? "")),
  ]);
  categorias.delete("");

  const porCategoria: ProspeccaoDaCategoria[] = [...categorias]
    .map((categoria) => ({
      categoria,
      atividades: minhasAtividades.filter((a) => categoriaDaAtividade(a) === categoria).length,
      clientesNovos: novasRelacoes.filter((r) => String(r.categoria ?? "") === categoria).length,
    }))
    .sort((a, b) => b.atividades + b.clientesNovos - (a.atividades + a.clientesNovos));

  // ------------------------------------------------------------- pipeline
  const minhasOportunidades = meu(f.oportunidades as { owner_id?: unknown }[]) as Record<string, unknown>[];
  const criadasNoPeriodo = minhasOportunidades.filter((o) => noPeriodo(o.created_at));
  const perdidasNoPeriodo = minhasOportunidades.filter(
    (o) => ehPerda(String(o.etapa ?? ""), f.funil) && noPeriodo(o.data_perda, true),
  );
  const emAberto = minhasOportunidades.filter(
    (o) => !ehGanho(String(o.etapa ?? ""), f.funil) && !ehPerda(String(o.etapa ?? ""), f.funil),
  );

  const porEtapaMapa = new Map<string, { negocios: number; valor: number }>();
  for (const o of emAberto) {
    const etapa = String(o.etapa ?? "sem etapa");
    const atual = porEtapaMapa.get(etapa) ?? { negocios: 0, valor: 0 };
    atual.negocios += 1;
    atual.valor += Number(o.valor ?? 0);
    porEtapaMapa.set(etapa, atual);
  }

  // --------------------------------------------------------------- vendas
  const vendasDoPeriodo = (f.vendas as Record<string, unknown>[]).filter((v) => noPeriodo(v.data, true));
  const minhasVendas = vendasDoVendedor(vendasDoPeriodo as unknown as VendaComParceria[], id);

  // ----------------------------------------------------------- atendimento
  const minhasConversas = meu(f.conversas as { owner_id?: unknown }[]) as Record<string, unknown>[];
  const ativas = minhasConversas.filter((c) => noPeriodo(c.ultima_analise_em));
  const novas = minhasConversas.filter((c) => noPeriodo(c.created_at));

  const alertasPorConversa = ativas.map((c) => textosDoJsonb(c.alertas));
  const dicasPorConversa = ativas.map((c) => textosDoJsonb(c.dicas));

  const exemplos = ativas
    .map((c) => ({
      cliente: String(c.nome ?? "sem nome"),
      etapa: c.etapa ? String(c.etapa) : null,
      alerta: textosDoJsonb(c.alertas)[0] ?? "",
    }))
    .filter((e) => e.alerta)
    .slice(0, 10);

  // ---------------------------------------------------------------- agenda
  const meusCompromissos = meu(f.compromissos as { owner_id?: unknown }[]) as Record<string, unknown>[];
  /*
   * Duas janelas sobre as mesmas linhas, porque são perguntas diferentes:
   * "quantos ele MARCOU esta semana" (trabalho de prospecção) e "quantos
   * estavam marcados PARA esta semana" (compromisso assumido). Um número só
   * esconderia o vendedor que marca dez e cumpre dois.
   */
  const marcadosNaSemana = meusCompromissos.filter((c) => noPeriodo(c.created_at));
  const paraASemana = meusCompromissos.filter((c) => noPeriodo(c.data, true));
  const realizados = paraASemana.filter((c) => c.concluido === true);

  const agenda = {
    marcados: marcadosNaSemana.length,
    paraASemana: paraASemana.length,
    realizados: realizados.length,
    /*
     * Só conta como não cumprido o que já PASSOU. Compromisso de hoje à tarde
     * ainda não foi furado, e contá-lo como falha faria o relatório acusar o
     * vendedor por um horário que ainda não chegou.
     */
    naoCumpridos: paraASemana.filter(
      (c) => c.concluido !== true && String(c.data ?? "") < f.ultimoDiaCoberto,
    ).length,
    porTipo: contar(paraASemana, (c) => String(c.tipo ?? "sem tipo")).map((t) => ({
      tipo: t.texto,
      n: t.n,
    })),
  };

  const metaLinha = f.metas.find((m) => String(m.vendedor_id) === id);

  // ------------------------------------------------------- meta x realizado
  /**
   * A janela do mês é reaplicada aqui, como a da semana. O filtro no SQL não
   * basta: se ele mudar, ou a consulta for reaproveitada, o acumulado passa a
   * somar mês passado e o relatório diz "194% da meta" para quem está em 14%.
   * Aconteceu no teste exatamente assim.
   */
  const noMesAteOCorte = (valor: unknown) => {
    const em = String(valor ?? "");
    if (!em) return false;
    return em.slice(0, 7) === f.mes && em.slice(0, 10) <= f.ultimoDiaCoberto;
  };

  const minhasAtividadesMes = (
    meu(f.atividadesMes as { owner_id?: unknown }[]) as Record<string, unknown>[]
  ).filter((a) => noMesAteOCorte(a.ocorrida_em));
  const temTipoNoMes = (frag: string) =>
    minhasAtividadesMes.filter((a) => String(a.tipo ?? "").toLowerCase().includes(frag)).length;
  const faturamentoDoMes = somaDoVendedor(
    (f.vendasMes as Record<string, unknown>[]).filter((v) =>
      noMesAteOCorte(v.data),
    ) as unknown as VendaComParceria[],
    id,
  );
  const novasRelacoesNoMes = minhasRelacoes.filter((r) => noMesAteOCorte(r.created_at)).length;

  const progresso: ProgressoDaMeta | null = metaLinha
    ? (() => {
        const item = (rotulo: string, meta: number, atingido: number, emReais = false) => {
          const falta = Math.max(0, meta - atingido);
          return {
            rotulo,
            meta,
            atingido,
            falta,
            percentual: meta > 0 ? Math.round((atingido / meta) * 100) : 0,
            porDiaUtil: 0, // preenchido abaixo, quando souber quantos dias sobram
            emReais,
          };
        };
        const itens = [
          item("Faturamento", Number(metaLinha.meta_faturamento ?? 0), faturamentoDoMes, true),
          item("Clientes novos", Number(metaLinha.meta_clientes_novos ?? 0), novasRelacoesNoMes),
          item("Visitas", Number(metaLinha.meta_visitas ?? 0), temTipoNoMes("visita")),
          item("Ligações", Number(metaLinha.meta_ligacoes ?? 0), temTipoNoMes("liga")),
        ].filter((i) => i.meta > 0);

        const diasUteisRestantes = contarDiasUteis(f.ultimoDiaCoberto, f.mes);
        for (const i of itens) {
          i.porDiaUtil =
            diasUteisRestantes > 0
              ? Math.ceil((i.falta / diasUteisRestantes) * 100) / 100
              : i.falta;
        }

        return {
          mes: f.mes,
          apuradoAte: f.ultimoDiaCoberto,
          diasUteisRestantes,
          itens,
        };
      })()
    : null;

  return {
    vendedorId: id,
    nome,
    cargo,
    crm: {
      atividades: minhasAtividades.length,
      porTipo: contar(minhasAtividades, (a) => String(a.tipo ?? "")).map((t) => ({
        tipo: t.texto,
        n: t.n,
      })),
      visitas: temTipo("visita"),
      ligacoes: temTipo("liga"),
      orcamentos: temTipo("orçament") + temTipo("orcament"),
      followUps: temTipo("follow"),
    },
    agenda,
    prospeccao: {
      clientesNovos: novasRelacoes.length,
      porCategoria,
    },
    pipeline: {
      criados: criadasNoPeriodo.length,
      ganhos: criadasNoPeriodo.filter((o) => ehGanho(String(o.etapa ?? ""), f.funil)).length,
      perdidos: perdidasNoPeriodo.length,
      emAberto: emAberto.length,
      valorEmAberto: emAberto.reduce((s, o) => s + Number(o.valor ?? 0), 0),
      porEtapa: [...porEtapaMapa.entries()]
        .map(([etapa, v]) => ({ etapa, ...v }))
        .sort((a, b) => b.negocios - a.negocios),
      motivosDePerda: contar(perdidasNoPeriodo, (o) => String(o.motivo_perda ?? "")).map((m) => ({
        motivo: m.texto,
        n: m.n,
      })),
    },
    vendas: {
      quantidade: minhasVendas.length,
      valor: somaDoVendedor(vendasDoPeriodo as unknown as VendaComParceria[], id),
      valorCheio: minhasVendas.reduce((s, v) => s + Number(v.valor_fechado ?? v.valor ?? 0), 0),
    },
    atendimento: {
      conversasAtivas: ativas.length,
      conversasNovas: novas.length,
      conversasComAlerta: alertasPorConversa.filter((a) => a.length > 0).length,
      conversasSemProximaAcao: ativas.filter((c) => !String(c.proxima_acao ?? "").trim()).length,
      conversasIgnoradas: ativas.filter((c) => c.ignorado === true).length,
      alertas: contar(alertasPorConversa.flat(), (t) => t).map((a) => ({
        texto: a.texto,
        conversas: a.n,
      })),
      dicas: contar(dicasPorConversa.flat(), (t) => t).map((d) => ({
        texto: d.texto,
        conversas: d.n,
      })),
      exemplos,
      porNatureza: contar(ativas, (c) => String(c.natureza ?? "")).map((n) => ({
        natureza: n.texto,
        conversas: n.n,
      })),
    },
    metas: metaLinha
      ? {
          faturamento: Number(metaLinha.meta_faturamento ?? 0),
          clientesNovos: Number(metaLinha.meta_clientes_novos ?? 0),
          arquitetos: Number(metaLinha.meta_arquitetos ?? 0),
          construtoras: Number(metaLinha.meta_construtoras ?? 0),
          obras: Number(metaLinha.meta_obras ?? 0),
          visitas: Number(metaLinha.meta_visitas ?? 0),
          ligacoes: Number(metaLinha.meta_ligacoes ?? 0),
        }
      : null,
    progresso,
  };
}

/**
 * Dias úteis que ainda restam no mês depois do último dia coberto.
 *
 * Loja de lareira abre sábado, então sábado conta; domingo não. Serve para
 * dizer "faltam R$ 48 mil em 11 dias úteis, R$ 4.364 por dia" em vez de só
 * dizer que está atrasado.
 */
function contarDiasUteis(ultimoDiaCoberto: string, mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return 0;
  const ultimoDoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  /*
   * A semana pode atravessar a virada do mês: um relatório de 28/set a 3/out
   * tem corte em outubro, mas um de 26/out a 31/out gerado no dia 1º tem corte
   * no mês anterior ao da meta. Sem este ajuste o mês novo começaria com zero
   * dia útil e o relatório diria que falta tudo "para hoje".
   */
  const mesDoCorte = ultimoDiaCoberto.slice(0, 7);
  if (mesDoCorte < mes) return contarDiasUteisDoMesInteiro(ano, m);
  if (mesDoCorte > mes) return 0;
  const diaCorte = Number(ultimoDiaCoberto.slice(8, 10));
  let uteis = 0;
  for (let d = diaCorte + 1; d <= ultimoDoMes; d += 1) {
    const semana = new Date(Date.UTC(ano, m - 1, d)).getUTCDay();
    if (semana !== 0) uteis += 1;
  }
  return uteis;
}

function contarDiasUteisDoMesInteiro(ano: number, m: number): number {
  const ultimoDoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  let uteis = 0;
  for (let d = 1; d <= ultimoDoMes; d += 1) {
    if (new Date(Date.UTC(ano, m - 1, d)).getUTCDay() !== 0) uteis += 1;
  }
  return uteis;
}
