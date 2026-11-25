/**
 * AURA DIRETORA — quem comanda a equipe.
 *
 * Roda às 7h20 (plano do dia) e às 18h (fechamento do dia), de segunda a
 * sábado. Ela não olha cliente nenhum: olha a EQUIPE.
 *
 *   1. lê o que cada agente fez nas últimas 24 h, os achados abertos (por
 *      agente e por pessoa), a taxa de resolução de cada agente e a própria
 *      caixa de entrada;
 *   2. publica no mural um plano curto ("plano"), com números que vieram só
 *      dos dados — se a IA inventar um número, o texto é descartado e vai o
 *      plano escrito por regra;
 *   3. faz pedidos a agentes específicos (ex.: o Curador, quando as sugestões
 *      de conhecimento disparam);
 *   4. aponta agente com resolução baixa (o que ele abre expira ou é
 *      dispensado) e sugere mudar ou desligar;
 *   5. cobra o gestor da loja quando alguém acumula itens parados;
 *   6. no máximo uma vez por semana, propõe UM agente novo quando vê um
 *      padrão que ninguém cobre (o gestor mestre aprova ou recusa);
 *   7. responde o que chegou para ela — é o que dá ao escritório cara de
 *      conversa.
 *
 * IA só no texto do plano e da proposta (perfil "redacao"). Todo o resto é
 * regra: de graça e sem inventar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { equipeAtiva, gestoresDaLoja } from "./pessoas";
import { numerosConferem } from "./util";
import type {
  Achado,
  ConfigAgenteConfiguravel,
  ContextoAgente,
  DefinicaoAgente,
  MensagemEscritorio,
  PropostaAgente,
  ResultadoAgente,
  Setor,
} from "./tipos";

const HORA = 3_600_000;
const DIA = 86_400_000;

export const ID_DIRETORA = "diretora";

/** Acima disto, a pessoa tem itens demais parados e o gestor é avisado. */
const LIMITE_ACUMULO = 25;
/** Resolução abaixo disto, com pelo menos AMOSTRA_RESOLUCAO itens fechados, é baixa. */
const RESOLUCAO_BAIXA = 0.25;
const AMOSTRA_RESOLUCAO = 20;

interface AgenteResumo {
  id: string;
  nome: string;
  setor: string;
  missao: string;
  ativo: boolean;
  tipo: string;
}

interface Dito {
  para_agente: string | null;
  dados: Record<string, unknown> | null;
  criado_em: string;
}

/** Candidatos a agente novo: um sinal medido por regra e a configuração pronta. */
interface Candidato {
  nome: string;
  setor: Setor;
  /** Se algum agente ligado já tem isto na missão, o buraco está coberto. */
  cobertura: RegExp;
  limite: number;
  medir: (sb: SupabaseClient, agora: Date) => Promise<number>;
  descricaoDoSinal: (n: number) => string;
  missao: string;
  config: ConfigAgenteConfiguravel;
}

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await consulta;
  return error ? 0 : (count ?? 0);
}

const CANDIDATOS: Candidato[] = [
  {
    nome: "Vigia de reclamações",
    setor: "pos-venda",
    cobertura: /reclama/i,
    limite: 3,
    medir: (sb, agora) =>
      contar(
        sb
          .from("pos_vendas")
          .select("id", { count: "exact", head: true })
          .eq("possui_reclamacao", true)
          .eq("reclamacao_resolvida", false)
          .lt("reclamacao_aberta_em", new Date(agora.getTime() - 3 * DIA).toISOString()),
      ),
    descricaoDoSinal: (n) => `${n} reclamações de pós-venda abertas há mais de 3 dias`,
    missao: "Acompanhar reclamações de pós-venda abertas e lembrar quem cuida de cada uma até ela ser resolvida.",
    config: {
      fonte: "pos_vendas",
      filtroDescricao: "Pós-vendas com reclamação aberta (possui_reclamacao verdadeiro e reclamacao_resolvida falso).",
      instrucoes:
        "Escolha as reclamações abertas há mais tempo. Para cada uma, um título curto com o nome do cliente e uma descrição do próximo passo (ligar, agendar visita técnica, registrar a solução). Não prometa prazo nem valor.",
      agenda: { tipo: "diario", horas: [9], diasSemana: [1, 2, 3, 4, 5, 6] },
      destinatario: "pos_venda_da_loja",
      limitePorExecucao: 10,
    },
  },
  {
    nome: "Caçador de orçamentos esquecidos",
    setor: "vendas",
    cobertura: /or[cç]amento|proposta/i,
    limite: 10,
    medir: (sb, agora) =>
      contar(
        sb
          .from("oportunidades")
          .select("id", { count: "exact", head: true })
          .eq("etapa", "Proposta")
          .lt("updated_at", new Date(agora.getTime() - 10 * DIA).toISOString()),
      ),
    descricaoDoSinal: (n) => `${n} negócios na etapa Proposta sem movimento há mais de 10 dias`,
    missao: "Achar orçamento enviado que ficou sem retorno e lembrar o vendedor de retomar a conversa.",
    config: {
      fonte: "oportunidades",
      filtroDescricao: "Negócios na etapa Proposta parados há mais de 10 dias (updated_at antigo).",
      instrucoes:
        "Escolha os negócios na etapa Proposta parados há mais tempo. Título com o cliente; descrição sugerindo retomar o contato perguntando se ficou alguma dúvida sobre o orçamento. Não cite valor nem desconto.",
      agenda: { tipo: "diario", horas: [8], minuto: 30, diasSemana: [1, 2, 3, 4, 5, 6] },
      destinatario: "dono",
      limitePorExecucao: 15,
    },
  },
  {
    nome: "Lembrete de manutenção anual",
    setor: "pos-venda",
    cobertura: /manuten|recompra|reativ/i,
    limite: 5,
    medir: (sb, agora) =>
      contar(
        sb
          .from("vendas")
          .select("id", { count: "exact", head: true })
          .lte("data", new Date(agora.getTime() - 330 * DIA).toISOString().slice(0, 10))
          .gte("data", new Date(agora.getTime() - 400 * DIA).toISOString().slice(0, 10)),
      ),
    descricaoDoSinal: (n) => `${n} vendas fazendo um ano (330 a 400 dias), época da manutenção anual`,
    missao: "Lembrar o pós-venda dos clientes que compraram há cerca de um ano e já estão na época da manutenção.",
    config: {
      fonte: "vendas",
      filtroDescricao: "Vendas com data entre 330 e 400 dias atrás.",
      instrucoes:
        "Escolha as vendas mais próximas de completar um ano. Título com o cliente e o produto; descrição sugerindo oferecer a revisão/limpeza anual. Não cite preço.",
      agenda: { tipo: "diario", horas: [10], diasSemana: [1] },
      destinatario: "pos_venda_da_loja",
      limitePorExecucao: 15,
    },
  },
  {
    nome: "Vigia de campanhas sem lead",
    setor: "marketing",
    cobertura: /campanha/i,
    limite: 2,
    medir: (sb, agora) =>
      contar(
        sb
          .from("campanhas_marketing")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativa")
          .eq("leads_gerados", 0)
          .lt("data_inicio", new Date(agora.getTime() - 7 * DIA).toISOString().slice(0, 10)),
      ),
    descricaoDoSinal: (n) => `${n} campanhas ativas há mais de 7 dias sem nenhum lead`,
    missao: "Avisar o marketing quando uma campanha ativa passa uma semana sem gerar lead.",
    config: {
      fonte: "campanhas",
      filtroDescricao: "Campanhas com status ativa, leads_gerados igual a zero e início há mais de 7 dias.",
      instrucoes:
        "Escolha as campanhas ativas sem lead há mais tempo. Título com o nome da campanha; descrição sugerindo revisar público, criativo ou canal. Não invente números de alcance.",
      agenda: { tipo: "diario", horas: [9], minuto: 30, diasSemana: [1, 4] },
      destinatario: "marketing_da_loja",
      limitePorExecucao: 5,
    },
  },
];

function hojeEHora(agora: Date): { dia: number; hora: number; manha: boolean } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(agora);
  const dia = Number(partes.find((p) => p.type === "day")?.value ?? 0);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { dia, hora, manha: hora < 12 };
}

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

async function executarDiretora(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora } = ctx;
  // Import tardio: o motor importa a Diretora para montar o registro.
  const { carregarRegistro } = await import("./motor");
  const registro: AgenteResumo[] = (await carregarRegistro(sb, true)).map((a) => ({
    id: a.id,
    nome: a.nome,
    setor: a.setor,
    missao: a.missao,
    ativo: a.ativo,
    tipo: a.tipo,
  }));
  const nomeDe = (id: string) => registro.find((a) => a.id === id)?.nome ?? id;
  const iso = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  const inicioDia = inicioDoDiaEmSaoPaulo(agora);
  const { dia, hora, manha } = hojeEHora(agora);

  const [execs, abertos, fechados30, inbox, sugeridos, sugeridos24h, equipe, ditos] = await Promise.all([
    todasAsLinhas<{ agente_id: string; status: string; achados: number; custo_usd: number }>((de, ate) =>
      sb
        .from("aura_agente_execucoes")
        .select("agente_id, status, achados, custo_usd")
        .gte("inicio", iso(24 * HORA))
        .order("id")
        .range(de, ate),
    ),
    todasAsLinhas<{ agente: string; vendedor_id: string; empresa: string; prioridade: string; criado_em: string }>((de, ate) =>
      sb
        .from("aura_recomendacoes")
        .select("agente, vendedor_id, empresa, prioridade, criado_em")
        .not("agente", "is", null)
        .eq("status", "pendente")
        .order("id")
        .range(de, ate),
    ),
    todasAsLinhas<{ agente: string; status: string; atualizado_em: string }>((de, ate) =>
      sb
        .from("aura_recomendacoes")
        .select("agente, status, atualizado_em")
        .not("agente", "is", null)
        .neq("status", "pendente")
        .gte("criado_em", iso(30 * DIA))
        .order("id")
        .range(de, ate),
    ),
    ctx.caixaDeEntrada(),
    contar(sb.from("aura_aprendizado").select("id", { count: "exact", head: true }).eq("status", "sugerido")),
    contar(
      sb.from("aura_aprendizado").select("id", { count: "exact", head: true }).eq("status", "sugerido").gte("criado_em", iso(24 * HORA)),
    ),
    equipeAtiva(sb),
    todasAsLinhas<Dito>((de, ate) =>
      sb
        .from("aura_escritorio_mensagens")
        .select("para_agente, dados, criado_em")
        .eq("de_agente", ID_DIRETORA)
        .gte("criado_em", iso(8 * DIA))
        .order("id")
        .range(de, ate),
    ),
  ]);

  /** A Diretora já disse isto (dados.chave) há menos de `janela` ms? */
  const jaDisse = (chave: string, janela: number) =>
    ditos.some((d) => d.dados?.chave === chave && new Date(d.criado_em).getTime() > agora.getTime() - janela);

  const mensagens: MensagemEscritorio[] = [];
  const achados: Achado[] = [];

  // ---------- números da equipe ----------
  const rodadas24h = execs.length;
  const erros24h = execs.filter((e) => e.status === "erro");
  const comErro = [...new Set(erros24h.map((e) => e.agente_id))];
  const totalAbertos = abertos.length;
  const altos = abertos.filter((a) => a.prioridade === "alta" || a.prioridade === "urgente").length;
  const porPessoa = new Map<string, { n: number; empresa: string; maisAntigo: number }>();
  const porAgente = new Map<string, number>();
  for (const a of abertos) {
    porAgente.set(a.agente, (porAgente.get(a.agente) ?? 0) + 1);
    const p = porPessoa.get(a.vendedor_id) ?? { n: 0, empresa: a.empresa, maisAntigo: agora.getTime() };
    p.n += 1;
    p.maisAntigo = Math.min(p.maisAntigo, new Date(a.criado_em).getTime());
    porPessoa.set(a.vendedor_id, p);
  }
  const resolvidosHoje = fechados30.filter(
    (f) => (f.status === "concluida" || f.status === "resolvida_sozinha") && f.atualizado_em >= inicioDia,
  ).length;

  // ---------- resolução por agente (30 dias) ----------
  const resolucao = new Map<string, { bons: number; total: number }>();
  for (const f of fechados30) {
    const r = resolucao.get(f.agente) ?? { bons: 0, total: 0 };
    r.total += 1;
    if (f.status === "concluida" || f.status === "resolvida_sozinha") r.bons += 1;
    resolucao.set(f.agente, r);
  }

  // ---------- pedidos à equipe ----------
  let pedidos = 0;
  const curador = registro.find((a) => a.ativo && a.id !== ID_DIRETORA && /curador/i.test(`${a.id} ${a.nome}`));
  if ((sugeridos24h >= 30 || sugeridos > 100) && !jaDisse("curadoria", 20 * HORA)) {
    if (curador) {
      mensagens.push({
        de: ID_DIRETORA,
        para: curador.id,
        tipo: "pedido",
        texto: `${curador.nome}, chegaram ${sugeridos24h} sugestões de conhecimento nas últimas 24 horas e há ${sugeridos} esperando revisão. Pode separar primeiro as que têm mais evidência de resultado?`,
        dados: { chave: "curadoria", sugeridos, sugeridos24h },
      });
    } else {
      mensagens.push({
        de: ID_DIRETORA,
        para: "todos",
        tipo: "pedido",
        texto: `Há ${sugeridos} sugestões de conhecimento esperando o gestor em Aprendizado. Enquanto passar de 100, a rodada semanal de aprendizado fica parada.`,
        dados: { chave: "curadoria", sugeridos, sugeridos24h },
      });
    }
    pedidos += 1;
  }

  for (const id of comErro) {
    const chave = `erros:${id}`;
    if (jaDisse(chave, 20 * HORA)) continue;
    const n = erros24h.filter((e) => e.agente_id === id).length;
    mensagens.push({
      de: ID_DIRETORA,
      para: "todos",
      tipo: "alerta",
      texto: `${nomeDe(id)} falhou ${n} ${n === 1 ? "vez" : "vezes"} nas últimas 24 horas. O motivo está no histórico de rodadas dele.`,
      dados: { chave, agente: id, falhas: n },
    });
  }

  for (const [id, r] of resolucao) {
    if (id === ID_DIRETORA || r.total < AMOSTRA_RESOLUCAO || r.bons / r.total >= RESOLUCAO_BAIXA) continue;
    const chave = `baixa-resolucao:${id}`;
    if (jaDisse(chave, 7 * DIA)) continue;
    const pct = Math.round((r.bons / r.total) * 100);
    mensagens.push({
      de: ID_DIRETORA,
      para: "todos",
      tipo: "ideia",
      texto: `${nomeDe(id)} resolveu só ${pct}% dos ${r.total} itens que fechou nos últimos 30 dias; o resto expirou ou foi dispensado. Sugiro rever o critério dele ou desligá-lo.`,
      dados: { chave, agente: id, resolvidos: r.bons, total: r.total },
    });
    mensagens.push({
      de: ID_DIRETORA,
      para: id,
      tipo: "pedido",
      texto: `Seus itens estão sendo dispensados ou expirando (${pct}% resolvidos em 30 dias). Seja mais seletivo: só o que a pessoa consegue resolver hoje.`,
      dados: { chave: `${chave}:pedido`, agente: id },
    });
    pedidos += 1;
  }

  // ---------- quem acumulou itens parados → gestor da loja ----------
  for (const [pessoaId, p] of porPessoa) {
    if (p.n < LIMITE_ACUMULO) continue;
    const pessoa = equipe.find((e) => e.id === pessoaId);
    if (!pessoa || pessoa.gestorAprovado) continue;
    const dias = Math.max(0, Math.floor((agora.getTime() - p.maisAntigo) / DIA));
    for (const gestor of gestoresDaLoja(equipe, pessoa.empresa)) {
      if (gestor.id === pessoaId) continue;
      achados.push({
        chave: `acumulo:${pessoaId}:${gestor.id}`,
        empresa: pessoa.empresa,
        destinatarioId: gestor.id,
        titulo: `${pessoa.nome} tem ${p.n} itens da AURA em aberto`,
        descricao: `O mais antigo está parado há ${dias} ${dias === 1 ? "dia" : "dias"}. Vale uma conversa rápida para destravar o que é importante e dispensar o que não faz sentido.`,
        prioridade: p.n >= LIMITE_ACUMULO * 2 ? "alta" : "media",
        entidadeTipo: "perfil",
        entidadeId: pessoaId,
        acaoUrl: "/gestor",
        expiraEmDias: 7,
      });
    }
  }

  // ---------- respostas ao que chegou para ela ----------
  let respostas = 0;
  for (const m of inbox) {
    if (m.de === ID_DIRETORA) continue;
    const nome = nomeDe(m.de);
    if (m.tipo === "pedido") {
      mensagens.push({
        de: ID_DIRETORA,
        para: m.de,
        tipo: "resposta",
        texto: `Recebido, ${nome}. Entra no plano ${manha ? "de hoje" : "de amanhã"}.`,
        empresa: m.empresa,
        dados: { respondendo: m.id },
      });
    } else if (m.tipo === "ideia") {
      mensagens.push({
        de: ID_DIRETORA,
        para: m.de,
        tipo: "resposta",
        texto: `Boa ideia, ${nome}. Vou acompanhar os números desta semana; se o padrão se repetir, levo como proposta ao gestor.`,
        empresa: m.empresa,
        dados: { respondendo: m.id },
      });
    } else if (m.tipo === "alerta") {
      mensagens.push({
        de: ID_DIRETORA,
        para: m.de,
        tipo: "resposta",
        texto: `Alerta recebido, ${nome}. Coloquei no mural para o gestor ver.`,
        empresa: m.empresa,
        dados: { respondendo: m.id },
      });
      mensagens.push({
        de: ID_DIRETORA,
        para: "todos",
        tipo: "alerta",
        texto: `${nome} avisa: ${m.texto}`,
        empresa: m.empresa,
        dados: { repassando: m.id },
      });
    } else {
      continue;
    }
    respostas += 1;
  }

  // ---------- o plano ----------
  const maisCarregados = [...porAgente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const dados = {
    momento: manha ? "plano do dia" : "fechamento do dia",
    itensAbertos: totalAbertos,
    itensAltaOuUrgente: altos,
    pessoasComItens: porPessoa.size,
    rodadasUltimas24h: rodadas24h,
    rodadasComErro: erros24h.length,
    agentesComErro: comErro.map(nomeDe),
    resolvidosHoje,
    sugestoesDeConhecimentoEsperando: sugeridos,
    agentesMaisCarregados: maisCarregados.map(([id, n]) => ({ agente: nomeDe(id), itens: n })),
  };
  const permitidos = [
    totalAbertos,
    altos,
    porPessoa.size,
    rodadas24h,
    erros24h.length,
    resolvidosHoje,
    sugeridos,
    dia,
    hora,
    24,
    ...maisCarregados.map(([, n]) => n),
  ];

  const planoPorRegra = (() => {
    const partes: string[] = [];
    partes.push(
      manha
        ? `Bom dia, equipe. Plano de hoje: ${totalAbertos} itens abertos com ${porPessoa.size} pessoas, ${altos} de prioridade alta ou urgente.`
        : `Fechamento do dia: ${resolvidosHoje} itens resolvidos hoje e ${totalAbertos} ainda abertos.`,
    );
    if (maisCarregados.length) {
      partes.push(`Mais carregados: ${lista(maisCarregados.map(([id, n]) => `${nomeDe(id)} (${n})`))}.`);
    }
    partes.push(
      erros24h.length
        ? `Nas últimas 24 horas foram ${rodadas24h} rodadas, ${erros24h.length} com erro (${lista(comErro.map(nomeDe))}).`
        : `Nas últimas 24 horas foram ${rodadas24h} rodadas, todas sem erro.`,
    );
    if (sugeridos > 100) partes.push(`A base de conhecimento tem ${sugeridos} sugestões esperando revisão.`);
    return partes.join(" ");
  })();

  let plano = planoPorRegra;
  const escrito = await ctx.ia({
    perfil: "redacao",
    maxTokens: 500,
    sistema:
      "Você é a AURA Diretora, que coordena uma equipe de agentes de IA dentro do CRM de um grupo de lojas de lareiras e aquecimento. Escreva em português do Brasil, em no máximo 5 frases curtas, o " +
      `${manha ? "plano do dia" : "fechamento do dia"} para o mural da equipe. ` +
      "Use SOMENTE os números que aparecem nos DADOS, sem calcular números novos. Não cite nomes de clientes nem de vendedores. Sem emojis, sem listas, sem markdown. Tom direto e gentil.",
    usuario: `DADOS:\n${JSON.stringify(dados, null, 2)}`,
  });
  if (typeof escrito === "string" && escrito.trim()) {
    const texto = escrito.trim();
    if (numerosConferem(texto, permitidos)) plano = texto;
    else ctx.log("plano da IA trouxe número que não está nos dados; usei o plano por regra");
  }
  mensagens.unshift({
    de: ID_DIRETORA,
    para: "todos",
    tipo: "plano",
    texto: plano,
    dados: { ...dados, chave: `plano:${ctx.hoje}:${manha ? "manha" : "tarde"}` },
  });

  // ---------- proposta da semana ----------
  const propostas: PropostaAgente[] = [];
  const propostaRecente = await contar(
    sb
      .from("aura_agente_propostas")
      .select("id", { count: "exact", head: true })
      .eq("proposto_por", ID_DIRETORA)
      .gte("criado_em", iso(7 * DIA)),
  );
  if (propostaRecente === 0) {
    const proposta = await escolherProposta(ctx, registro);
    if (proposta) {
      propostas.push(proposta);
      mensagens.push({
        de: ID_DIRETORA,
        para: "todos",
        tipo: "ideia",
        texto: `Propus ao gestor um agente novo: ${proposta.nome}. ${proposta.justificativa}`,
        dados: { chave: `proposta:${proposta.nome}` },
      });
    }
  }

  // ---------- faxina dos diários da equipe ----------
  await sb.from("aura_agente_execucoes").delete().lt("inicio", iso(180 * DIA));
  await sb.from("aura_escritorio_mensagens").delete().lt("criado_em", iso(365 * DIA));

  return {
    resumo: `${manha ? "Plano do dia" : "Fechamento do dia"} publicado: ${totalAbertos} itens abertos, ${pedidos} pedido(s) à equipe, ${respostas} resposta(s).`,
    achados,
    mensagens,
    propostas,
    metricas: {
      itensAbertos: totalAbertos,
      itensAltos: altos,
      pessoasComItens: porPessoa.size,
      rodadas24h,
      erros24h: erros24h.length,
      resolvidosHoje,
      sugeridosConhecimento: sugeridos,
      pedidos,
      respostas,
    },
  };
}

/** O primeiro buraco medido acima do limite que ninguém cobre e que ainda não foi proposto. */
async function escolherProposta(ctx: ContextoAgente, registro: AgenteResumo[]): Promise<PropostaAgente | null> {
  const { sb, agora } = ctx;
  const { data: jaPropostas } = await sb.from("aura_agente_propostas").select("nome");
  const nomesPropostos = new Set((jaPropostas ?? []).map((p) => String(p.nome).trim().toLowerCase()));

  for (const c of CANDIDATOS) {
    if (nomesPropostos.has(c.nome.toLowerCase())) continue;
    if (registro.some((a) => a.ativo && (c.cobertura.test(a.missao) || c.cobertura.test(a.nome)))) continue;
    const n = await c.medir(sb, agora).catch(() => 0);
    if (n < c.limite) continue;

    const sinal = c.descricaoDoSinal(n);
    let missao = c.missao;
    let justificativa = `Encontrei ${sinal} e nenhum agente da equipe cobre isso hoje.`;
    const texto = await ctx.ia({
      perfil: "redacao",
      json: true,
      maxTokens: 500,
      sistema:
        "Você é a AURA Diretora. Vai propor ao gestor um agente novo para a equipe. Escreva em português do Brasil, sem emojis. " +
        'Devolva {"missao": "uma frase", "justificativa": "até duas frases"}. Use somente o número que aparece no SINAL; não invente outros.',
      usuario: `AGENTE: ${c.nome}\nMISSÃO PREVISTA: ${c.missao}\nSINAL: ${sinal}`,
    });
    if (texto && typeof texto === "object") {
      const m = typeof texto.missao === "string" ? texto.missao.trim() : "";
      const j = typeof texto.justificativa === "string" ? texto.justificativa.trim() : "";
      if (m && numerosConferem(m, [n])) missao = m;
      if (j && numerosConferem(j, [n, 3, 7, 10, 330, 400])) justificativa = j;
    }
    return { propostoPor: ID_DIRETORA, nome: c.nome, setor: c.setor, missao, justificativa, config: c.config };
  }
  return null;
}

export const DIRETORA: DefinicaoAgente = {
  id: ID_DIRETORA,
  nome: "AURA Diretora",
  cargo: "Diretora da equipe",
  setor: "direcao",
  icone: "Crown",
  missao:
    "Lê o que cada agente relatou, publica o plano do dia, cobra quem está com muito item parado, aponta agente que não ajuda e propõe agentes novos quando vê um buraco.",
  // 7h20 e 18h, de segunda a sábado (hora quebrada = minutos, ver agenda.ts).
  agenda: { tipo: "diario", horas: [7 + 20 / 60, 18], diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: true,
  orcamentoMensalUsd: 5,
  tipo: "nativo",
  executar: executarDiretora,
};
