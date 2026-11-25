/**
 * ANALISTA DE MARKETING — toda segunda às 8h confere campanhas e postagens.
 *
 *   - campanha ativa há 14 dias ou mais sem NENHUM lead nos últimos 14 dias
 *     (conversa do WhatsApp, cliente ou negócio ligado à campanha): dinheiro
 *     indo para anúncio que não traz ninguém;
 *   - campanha com data de fim no passado ainda marcada como ativa;
 *   - postagem esperando aprovação há mais de 2 dias (vai para o gestor) e
 *     postagem com data planejada vencida sem publicar (vai para o marketing).
 *
 * As campanhas vêm quase todas dos anúncios (chave_externa) e são centenas:
 * um card por PESSOA com a lista da loja, nunca um por campanha.
 *
 * A IA (perfil rápido) escreve um parágrafo curto por loja para o escritório
 * a partir dos números da rodada. Sem IA, o parágrafo sai montado à mão.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import { anotar, lerTudo, limitarPorPessoa, plural, responsaveisDaLoja, resumosPorGestor, somarDias } from "./comum";

export const DIAS_SEM_LEAD = 14;
export const DIAS_ESPERANDO_APROVACAO = 2;

interface Campanha {
  id: string;
  empresa: string;
  nome: string;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
}

interface Postagem {
  id: string;
  empresa: string;
  titulo: string;
  status: string;
  data_planejada: string;
  created_at: string;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const corte = somarDias(hoje, -DIAS_SEM_LEAD);
  const corteInstante = `${corte}T00:00:00-03:00`;

  const comCampanha = (tabela: string) =>
    lerTudo<{ campanha_id: string }>((de, ate) =>
      sb.from(tabela).select("campanha_id").not("campanha_id", "is", null).gte("created_at", corteInstante).order("id").range(de, ate),
    );
  const [campanhas, postagens, l1, l2, l3] = await Promise.all([
    lerTudo<Campanha>((de, ate) =>
      sb.from("campanhas_marketing").select("id, empresa, nome, data_inicio, data_fim, created_at").eq("status", "ativa").order("id").range(de, ate),
    ),
    lerTudo<Postagem>((de, ate) =>
      sb
        .from("postagens_marketing")
        .select("id, empresa, titulo, status, data_planejada, created_at")
        .in("status", ["planejado", "aguardando_aprovacao", "aprovado"])
        .order("id")
        .range(de, ate),
    ),
    comCampanha("whatsapp_ia_leads"),
    comCampanha("relacionamentos"),
    comCampanha("oportunidades"),
  ]);
  const comLead = new Set([...l1, ...l2, ...l3].map((x) => x.campanha_id));

  type Numeros = { semLead: string[]; vencidas: string[]; aprovacao: string[]; atrasadas: string[] };
  const porLoja = new Map<string, Numeros>();
  const daLoja = (e: string) => {
    let n = porLoja.get(e);
    if (!n) porLoja.set(e, (n = { semLead: [], vencidas: [], aprovacao: [], atrasadas: [] }));
    return n;
  };

  for (const c of campanhas) {
    const inicio = (c.data_inicio ?? c.created_at).slice(0, 10);
    if (c.data_fim && c.data_fim < hoje) daLoja(c.empresa).vencidas.push(c.nome);
    else if (inicio <= corte && !comLead.has(c.id)) daLoja(c.empresa).semLead.push(c.nome);
  }
  for (const p of postagens) {
    if (p.status === "aguardando_aprovacao" && p.created_at.slice(0, 10) <= somarDias(hoje, -DIAS_ESPERANDO_APROVACAO)) {
      daLoja(p.empresa).aprovacao.push(p.titulo);
    } else if (p.status !== "aguardando_aprovacao" && p.data_planejada < hoje) {
      daLoja(p.empresa).atrasadas.push(`${p.titulo} (era ${p.data_planejada.slice(8, 10)}/${p.data_planejada.slice(5, 7)})`);
    }
  }

  // Uma lista por pessoa e por assunto.
  const listas = {
    semLead: new Map<string, string[]>(),
    vencidas: new Map<string, string[]>(),
    aprovacao: new Map<string, string[]>(),
    atrasadas: new Map<string, string[]>(),
  };
  for (const [empresa, n] of porLoja) {
    const mkt = equipe.marketingPara(empresa);
    const gestor = equipe.gestoresPara(empresa);
    const prefixo = (d: { mestres: boolean }) => (d.mestres ? `${empresa}: ` : "");
    // Para o mestre, uma linha por loja (a contagem); para quem é da loja, os nomes.
    const lancar = (mapa: Map<string, string[]>, destino: { ids: string[]; mestres: boolean }, itens: string[], rotulo: string) => {
      if (!itens.length) return;
      for (const id of destino.ids) {
        if (destino.mestres) anotar(mapa, id, `${prefixo(destino)}${plural(itens.length, rotulo)}`);
        else for (const t of itens) anotar(mapa, id, t);
      }
    };
    lancar(listas.semLead, mkt, n.semLead, "campanha");
    lancar(listas.vencidas, mkt, n.vencidas, "campanha");
    lancar(listas.aprovacao, gestor, n.aprovacao, "postagem");
    lancar(listas.atrasadas, mkt, n.atrasadas, "postagem");
  }
  const empresaDe = (id: string) => equipe.pessoa(id)?.empresa ?? "";
  const achados: Achado[] = [
    ...resumosPorGestor({
      agente: "marketing", tipo: "sem-leads", linhas: listas.semLead, empresaDe,
      titulo: () => `Campanhas sem lead há ${DIAS_SEM_LEAD} dias`,
      abertura: "Ativas há duas semanas ou mais e nenhum lead nesse tempo. Revise o anúncio ou pause:",
      prioridade: "alta", acaoUrl: "/marketing?secao=campanhas", expiraEmDias: 7,
    }),
    ...resumosPorGestor({
      agente: "marketing", tipo: "vencidas", linhas: listas.vencidas, empresaDe,
      titulo: () => "Campanhas encerradas ainda ativas",
      abertura: "A data de fim já passou. Encerre no sistema para os números baterem:",
      prioridade: "media", acaoUrl: "/marketing?secao=campanhas", expiraEmDias: 7,
    }),
    ...resumosPorGestor({
      agente: "marketing", tipo: "aprovacao", linhas: listas.aprovacao, empresaDe,
      titulo: () => "Postagens esperando sua aprovação",
      abertura: `Aguardando há mais de ${DIAS_ESPERANDO_APROVACAO} dias:`,
      prioridade: "alta", acaoUrl: "/marketing?secao=postagens", expiraEmDias: 7,
    }),
    ...resumosPorGestor({
      agente: "marketing", tipo: "atrasadas", linhas: listas.atrasadas, empresaDe,
      titulo: () => "Postagens atrasadas",
      abertura: "A data planejada passou e ainda não foram publicadas:",
      prioridade: "media", acaoUrl: "/marketing?secao=postagens", expiraEmDias: 7,
    }),
  ];

  // Um parágrafo por loja para o escritório (IA opcional, só com os números).
  const mensagens: MensagemEscritorio[] = [];
  for (const [empresa, n] of porLoja) {
    const numeros = {
      campanhasAtivas: campanhas.filter((c) => c.empresa === empresa).length,
      semLead14d: n.semLead.length,
      encerradasAindaAtivas: n.vencidas.length,
      postagensEsperandoAprovacao: n.aprovacao.length,
      postagensAtrasadas: n.atrasadas.length,
    };
    if (!numeros.semLead14d && !numeros.encerradasAindaAtivas && !numeros.postagensEsperandoAprovacao && !numeros.postagensAtrasadas) continue;
    const manual =
      `${empresa}: ${numeros.semLead14d} de ${numeros.campanhasAtivas} campanhas ativas sem lead em ${DIAS_SEM_LEAD} dias, ` +
      `${numeros.encerradasAindaAtivas} vencidas ainda ativas, ${numeros.postagensEsperandoAprovacao} postagens esperando aprovação ` +
      `e ${numeros.postagensAtrasadas} atrasadas.`;
    const ia = await ctx.ia({
      perfil: "rapido",
      maxTokens: 450, // 220 cortava o parágrafo no meio (1ª rodada real, 25/11)
      sistema:
        "Você é o analista de marketing de uma loja de lareiras e aquecimento no Sul do Brasil. Escreva em português do Brasil, " +
        "no máximo 3 frases, tom direto. Use SOMENTE os números fornecidos; não invente nenhum outro número nem nome. " +
        "Termine com uma ação concreta para a semana.",
      usuario: `Loja: ${empresa}\nNúmeros da semana (JSON): ${JSON.stringify(numeros)}`,
    });
    mensagens.push({
      de: "marketing",
      para: "todos",
      tipo: "relato",
      empresa,
      texto: typeof ia === "string" && ia.trim() ? ia.trim().slice(0, 600) : manual,
      dados: numeros,
    });
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  const soma = (k: keyof Numeros) => [...porLoja.values()].reduce((s, n) => s + n[k].length, 0);
  return {
    resumo: `${plural(soma("semLead"), "campanha")} sem lead em ${DIAS_SEM_LEAD} dias, ${soma("vencidas")} vencidas ainda ativas, ${soma("aprovacao") + soma("atrasadas")} postagens pedindo ação.`,
    achados: final,
    mensagens,
    metricas: {
      campanhasAtivas: campanhas.length,
      semLead14d: soma("semLead"),
      vencidasAtivas: soma("vencidas"),
      postagensAprovacao: soma("aprovacao"),
      postagensAtrasadas: soma("atrasadas"),
      cortadosPeloTeto: cortados,
    },
  };
}

export const agenteMarketing: DefinicaoAgente = {
  id: "marketing",
  nome: "Analista de Marketing",
  cargo: "Analista de marketing",
  setor: "marketing",
  icone: "Megaphone",
  missao: "Toda segunda, aponta as campanhas que não trazem lead, as que já deviam ter acabado e as postagens paradas.",
  agenda: { tipo: "diario", horas: [8], minuto: 0, diasSemana: [1] },
  usaIA: true,
  orcamentoMensalUsd: 0.5,
  tipo: "nativo",
  executar,
};
