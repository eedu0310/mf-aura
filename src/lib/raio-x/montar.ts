import { contaNoPipeline, ehFechada, type EtapaFunil } from "@/lib/funil";

/**
 * Os formatos de entrada são declarados aqui, com o mínimo que esta conta
 * usa, em vez de importar os tipos completos do sistema.
 *
 * Não é preciosismo: o mesmo compromisso existe em DOIS formatos no código
 * (o de src/lib/types.ts e o que vem de src/lib/supabase/compromissos.ts, com
 * ownerId em vez de vendedorId). Amarrar esta função a um deles obrigaria
 * quem chama a converter, e conversão à mão é onde um campo se perde calado.
 */
export interface CompromissoDoRaioX {
  titulo: string;
  tipo: string;
  data: string;
  hora?: string | null;
  local?: string | null;
  relacionamentoNome?: string | null;
  concluido: boolean;
}

export interface RelacionamentoDoRaioX {
  id: string;
  nome: string;
  temperatura?: string | null;
  proximoContatoEm?: string | null;
}

export interface OportunidadeDoRaioX {
  cliente: string;
  valor: number;
  etapa: string;
  diasParado?: number | null;
}

export interface PosVendaDoRaioX {
  cliente: string;
  status: string;
  instalacaoAgendadaEm?: string | null;
  reclamacaoResolvida?: boolean | null;
}

/**
 * O raio-x do dia, calculado — não escrito pela IA.
 *
 * Antes, a primeira mensagem da AURA era um texto corrido que o modelo
 * redigia. Três problemas, e os três apareciam na tela:
 *
 *  1. SAÍA DESORGANIZADO. Um parágrafo atrás do outro, sem hierarquia, com
 *     nome de cliente no meio da frase. O vendedor tinha que ler tudo para
 *     achar o que fazer.
 *  2. SAÍA CORTADO. Com a lista grande, o texto batia no limite de tokens e
 *     terminava no meio da palavra ("Aguardar retor").
 *  3. CUSTAVA CARO. Era a chamada mais cara do sistema, por chamada: ~25 mil
 *     tokens de entrada só para dizer de volta o que já estava nos dados.
 *
 * Contar quantos follow-ups estão atrasados não é trabalho de IA — é uma
 * conta. Aqui ela é feita direto, sempre igual, sem limite de tamanho e de
 * graça. A IA continua inteira para o que ela faz bem: conversar, explicar e
 * aconselhar quando o vendedor pergunta.
 */

export type TipoDeBloco =
  | "agenda"
  | "followup"
  | "orcamento"
  | "parado"
  | "esfriando"
  | "posvenda"
  | "lead";

export interface ItemDoRaioX {
  /** O que aparece em negrito: quase sempre o nome do cliente. */
  titulo: string;
  /** A linha de apoio: por que este item está aqui. */
  detalhe?: string;
  /** Hora marcada, quando houver. */
  hora?: string;
  /** Para onde a tela leva ao clicar. */
  link?: string;
  /** Pede atenção: atrasado, reclamação aberta, risco de perda. */
  urgente?: boolean;
}

export interface BlocoDoRaioX {
  tipo: TipoDeBloco;
  titulo: string;
  /**
   * Como chamar um item deste bloco numa frase: ["lead sem resposta", "leads
   * sem resposta"]. Sem isto o resumo do gestor saía "1 leads sem resposta",
   * que é o tipo de erro que faz a tela inteira parecer descuidada.
   *
   * É um par de textos, e não uma função que já devolve a frase pronta, de
   * propósito: este objeto atravessa a fronteira entre servidor e navegador,
   * e função não atravessa — o React recusa com erro em tela.
   */
  nomes: [string, string];
  /** Uma linha dizendo por que este bloco importa. Some quando vazio. */
  legenda?: string;
  itens: ItemDoRaioX[];
  /** Quantos itens existem no total, quando a lista foi cortada. */
  total: number;
}

export interface RaioX {
  dia: string;
  blocos: BlocoDoRaioX[];
  /** Quantas coisas pedem ação hoje, somando os blocos. */
  totalDeItens: number;
}

/** Hoje no fuso de São Paulo. */
export function hojeSP(agora = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Quantos itens cada bloco mostra antes de virar "e mais N".
 *
 * Doze é o ponto em que a lista ainda cabe na tela sem rolar muito. O número
 * total continua visível, então ninguém pensa que são só doze.
 */
const TETO_POR_BLOCO = 12;

function montarBloco(
  tipo: TipoDeBloco,
  titulo: string,
  legenda: string | undefined,
  itens: ItemDoRaioX[],
  /** [singular, plural], para a frase do resumo. */
  nomes: [string, string],
): BlocoDoRaioX | null {
  if (itens.length === 0) return null;
  return {
    tipo,
    titulo,
    legenda,
    nomes,
    itens: itens.slice(0, TETO_POR_BLOCO),
    total: itens.length,
  };
}

export interface DadosDoRaioX {
  compromissos: CompromissoDoRaioX[];
  relacionamentos: RelacionamentoDoRaioX[];
  oportunidades: OportunidadeDoRaioX[];
  posVendas?: PosVendaDoRaioX[];
  leadsPendentes?: { id: string; nome?: string; telefone?: string }[];
  funil: EtapaFunil[];
  /** Só os registros desta pessoa. Quem filtra é quem chama. */
  agora?: Date;
}

export function montarRaioX(d: DadosDoRaioX): RaioX {
  const agora = d.agora ?? new Date();
  const dia = hojeSP(agora);
  const blocos: BlocoDoRaioX[] = [];

  // ----------------------------------------------------------- 1. agenda
  // Primeiro o que tem hora marcada: é o único compromisso que não espera.
  const agenda = (d.compromissos ?? [])
    .filter((c) => !c.concluido && c.data <= dia)
    .sort((a, b) => (a.data + (a.hora ?? "99:99")).localeCompare(b.data + (b.hora ?? "99:99")))
    .map<ItemDoRaioX>((c) => {
      const atrasado = c.data < dia;
      return {
        titulo: c.relacionamentoNome ? `${c.tipo}: ${c.relacionamentoNome}` : c.titulo,
        detalhe: [
          atrasado ? `era ${c.data.split("-").reverse().slice(0, 2).join("/")}` : null,
          c.local || null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
        hora: c.hora ?? undefined,
        link: "/agenda",
        urgente: atrasado,
      };
    });
  const b1 = montarBloco("agenda", "Agenda de hoje", "Hora marcada não espera.", agenda, [
    "compromisso",
    "compromissos",
  ]);
  if (b1) blocos.push(b1);

  // ------------------------------------------------------- 2. follow-ups
  const followups = (d.relacionamentos ?? [])
    .filter((r) => {
      const quando = (r.proximoContatoEm ?? "").slice(0, 10);
      return !!quando && quando <= dia;
    })
    .sort((a, b) => (a.proximoContatoEm ?? "").localeCompare(b.proximoContatoEm ?? ""))
    .map<ItemDoRaioX>((r) => {
      const quando = (r.proximoContatoEm ?? "").slice(0, 10);
      const atrasado = quando < dia;
      return {
        titulo: r.nome,
        detalhe: atrasado
          ? `atrasado desde ${quando.split("-").reverse().slice(0, 2).join("/")}`
          : "marcado para hoje",
        link: `/relacionamentos?id=${r.id}`,
        urgente: atrasado,
      };
    });
  const b2 = montarBloco(
    "followup",
    "Follow-up",
    "Cliente que ficou de ouvir de você hoje — ou já faz dias.",
    followups,
    ["follow-up", "follow-ups"],
  );
  if (b2) blocos.push(b2);

  // ------------------------------------------- 3. orçamento na mesa
  // Dinheiro parado: negócio em etapa que já vale pipeline. Vem antes dos
  // parados porque aqui o cliente ainda está quente.
  const orcamento = (d.oportunidades ?? [])
    .filter(
      (o) =>
        !ehFechada(o.etapa, d.funil) &&
        contaNoPipeline(o.etapa, d.funil) &&
        (o.diasParado ?? 0) < 7,
    )
    .sort((a, b) => b.valor - a.valor)
    .map<ItemDoRaioX>((o) => ({
      titulo: o.cliente,
      detalhe: `${o.etapa} · ${moeda(o.valor)}`,
      link: "/pipeline",
    }));
  const b3 = montarBloco(
    "orcamento",
    "Orçamento na mesa",
    "Proposta entregue e cliente ainda quente.",
    orcamento,
    ["orçamento na mesa", "orçamentos na mesa"],
  );
  if (b3) blocos.push(b3);

  // --------------------------------------------------- 4. negócio parado
  const parados = (d.oportunidades ?? [])
    .filter((o) => !ehFechada(o.etapa, d.funil) && (o.diasParado ?? 0) >= 7)
    .sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0))
    .map<ItemDoRaioX>((o) => ({
      titulo: o.cliente,
      detalhe: `${o.diasParado} dias em ${o.etapa} · ${moeda(o.valor)}`,
      link: "/pipeline",
      urgente: (o.diasParado ?? 0) >= 15,
    }));
  const b4 = montarBloco(
    "parado",
    "Negócio parado",
    "Uma semana ou mais sem andar. É aqui que a venda morre sem ninguém ver.",
    parados,
    ["negócio parado", "negócios parados"],
  );
  if (b4) blocos.push(b4);

  // ------------------------------------------------------ 5. esfriando
  const esfriando = (d.relacionamentos ?? [])
    .filter((r) => r.temperatura === "esfriando" || r.temperatura === "frio")
    // Quem já está na lista de follow-up não repete aqui: a mesma pessoa em
    // dois blocos faz a lista parecer maior do que o trabalho é.
    .filter((r) => !followups.some((f) => f.titulo === r.nome))
    .map<ItemDoRaioX>((r) => ({
      titulo: r.nome,
      detalhe: r.temperatura === "frio" ? "frio" : "esfriando",
      link: `/relacionamentos?id=${r.id}`,
    }));
  const b5 = montarBloco(
    "esfriando",
    "Esfriando",
    "Sem contato há tempo e sem data marcada. Um alô resolve.",
    esfriando,
    ["cliente esfriando", "clientes esfriando"],
  );
  if (b5) blocos.push(b5);

  // ------------------------------------------------------- 6. pós-venda
  // Reclamação aberta é a que ainda não foi resolvida — o status sozinho não
  // diz isso, porque ele continua "reclamacao" depois de resolvida.
  const posvenda = (d.posVendas ?? [])
    .filter((p) => {
      const reclamando = p.status === "reclamacao" && !p.reclamacaoResolvida;
      const agendada = (p.instalacaoAgendadaEm ?? "").slice(0, 10);
      const instalacaoVencida =
        p.status === "agendamento_realizado" && !!agendada && agendada <= dia;
      return reclamando || instalacaoVencida;
    })
    .map<ItemDoRaioX>((p) => {
      const reclamando = p.status === "reclamacao" && !p.reclamacaoResolvida;
      const agendada = (p.instalacaoAgendadaEm ?? "").slice(0, 10);
      return {
        titulo: p.cliente,
        detalhe: reclamando
          ? "reclamação em aberto"
          : agendada < dia
            ? "instalação atrasada"
            : "instalação hoje",
        link: "/pos-venda",
        urgente: reclamando,
      };
    });
  const b6 = montarBloco(
    "posvenda",
    "Pós-venda",
    "Cliente que já comprou e está esperando alguma coisa.",
    posvenda,
    ["pós-venda", "pós-vendas"],
  );
  if (b6) blocos.push(b6);

  // ---------------------------------------------------------- 7. leads
  const leads = (d.leadsPendentes ?? []).map<ItemDoRaioX>((l) => ({
    titulo: l.nome || l.telefone || "Lead sem nome",
    detalhe: "ainda sem resposta",
    link: "/leads",
    urgente: true,
  }));
  const b7 = montarBloco("lead", "Leads sem resposta", "Chegaram e ninguém respondeu.", leads, [
    "lead sem resposta",
    "leads sem resposta",
  ]);
  if (b7) blocos.push(b7);

  return {
    dia,
    blocos,
    totalDeItens: blocos.reduce((s, b) => s + b.total, 0),
  };
}

export function moeda(v: number): string {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------- a equipe

export interface RaioXDeUmVendedor {
  id: string;
  nome: string;
  raioX: RaioX;
}

/**
 * O mesmo raio-x, um por vendedor — a visão do gestor.
 *
 * O gestor enxerga a loja inteira, então o raio-x dele somando todo mundo
 * daria uma lista de cem itens que ele não executa: o follow-up atrasado do
 * Charles não é tarefa do gestor, é tarefa do Charles. O que o gestor precisa
 * é ver DE QUEM é cada pendência, para cobrar a pessoa certa.
 *
 * Por isso aqui a lista é quebrada por pessoa, e quem não tem nada pendente
 * sai do resultado: um bloco vazio por vendedor só empurraria para baixo quem
 * de fato precisa de atenção.
 *
 * A ordem é por quantidade, do mais carregado para o menos — que é a ordem em
 * que o gestor vai olhar de qualquer jeito.
 */
export function montarRaioXDaEquipe(
  dados: Omit<DadosDoRaioX, "compromissos" | "relacionamentos" | "oportunidades" | "posVendas"> & {
    compromissos: (CompromissoDoRaioX & { dono?: string | null })[];
    relacionamentos: (RelacionamentoDoRaioX & { dono?: string | null })[];
    oportunidades: (OportunidadeDoRaioX & { dono?: string | null })[];
    posVendas?: (PosVendaDoRaioX & { dono?: string | null })[];
    leadsPendentes?: { id: string; nome?: string; telefone?: string; dono?: string | null }[];
  },
  pessoas: { id: string; nome: string }[],
): RaioXDeUmVendedor[] {
  const doDono = <T extends { dono?: string | null }>(lista: T[] | undefined, id: string) =>
    (lista ?? []).filter((x) => x.dono === id);

  return pessoas
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      raioX: montarRaioX({
        ...dados,
        compromissos: doDono(dados.compromissos, p.id),
        relacionamentos: doDono(dados.relacionamentos, p.id),
        oportunidades: doDono(dados.oportunidades, p.id),
        posVendas: doDono(dados.posVendas, p.id),
        leadsPendentes: doDono(dados.leadsPendentes, p.id),
      }),
    }))
    .filter((v) => v.raioX.totalDeItens > 0)
    .sort((a, b) => b.raioX.totalDeItens - a.raioX.totalDeItens);
}
