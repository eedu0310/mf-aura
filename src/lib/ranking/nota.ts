import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ehGanho, ehPerda, ehPosVenda, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";
import { participaDaVenda, somaDoVendedor } from "@/lib/parceria";
import { ehAtividadeDoVendedor } from "@/lib/kpis";

/**
 * A nota do mês, de 0 a 10.
 *
 * Antes os pesos viviam no código — venda valia 100, atividade 10,
 * relacionamento 2 — e mudar qualquer um exigia deploy. Agora o gestor
 * define pela tela o que conta, quanto pesa e qual a meta de cada coisa.
 *
 * Cada critério contribui com `peso * min(1, feito / meta)`: fez metade da
 * meta, leva metade do peso. A soma dos pesos deveria dar 10, mas não é
 * imposta — se o gestor somar 12, a escala se ajusta no fim, em vez de o
 * sistema recusar a configuração dele.
 *
 * Revisão de 27/11/2026 (pedido do Elton: "o ranking não está certo"):
 *   - avaliação enviada/recebida conta pela data do ENVIO/ABERTURA, não pela
 *     data da venda (o pedido nasce na venda e é mandado dias depois: o
 *     filtro antigo jogava fora quase tudo);
 *   - "Negociação" saiu (9 de 11 eram a IA arrastando card, não o vendedor);
 *   - entrou "Indicação" (atividade com origem Indicação, cliente indicado);
 *   - prospecção não conta mais contato criado sozinho pelo WhatsApp nem o
 *     cliente cadastrado na hora da venda;
 *   - entraram os KPIs do time: ticket médio, conversão, preço mantido,
 *     ciclo, cancelamentos e atingimento da meta. Ciclo e cancelamento são
 *     "menor é melhor". Medida que a pessoa não tem como ter (ticket sem
 *     venda, conversão sem negócio decidido) sai da conta DELA, em vez de
 *     virar zero.
 */

export interface Criterio {
  id: string;
  medida: string;
  titulo: string;
  descricao: string | null;
  peso: number;
  meta_mes: number;
  categoria_alvo: string | null;
  ativo: boolean;
  ordem: number;
}

export interface ParcelaDaNota {
  criterioId: string;
  titulo: string;
  feito: number;
  meta: number;
  peso: number;
  pontos: number;
  /** true = a pessoa não tinha como ter esta medida no período (ficou fora da conta dela). */
  semDado?: boolean;
}

export interface NotaDoVendedor {
  vendedorId: string;
  nome: string;
  loja: string;
  nota: number;
  parcelas: ParcelaDaNota[];
  crmEmDia: number;
  bonus: boolean;
}

export interface Insumos {
  vendas: {
    owner_id: string | null;
    valor_fechado: number | null;
    valor: number | null;
    relacionamento_id: string | null;
    /** De onde veio o cliente: "marketing" é lead de anúncio/campanha. */
    origem_lead?: string | null;
    /** Atendimento em dupla. Ver src/lib/parceria.ts. */
    parceiro_id: string | null;
    percentual_parceiro: number | null;
    data?: string | null;
    status?: string | null;
    /** Preço de tabela antes do desconto (para "preço mantido"). */
    valor_original?: number | null;
  }[];
  /** Vendas anteriores ao período, para saber quem já era cliente. */
  vendasAnteriores: { relacionamento_id: string | null }[];
  relacionamentos: {
    id: string;
    owner_id: string | null;
    categoria: string | null;
    proximo_contato_em: string | null;
    ultimo_contato_em: string | null;
    created_at: string;
    /** "marketing" = lead de anúncio/campanha, que o vendedor recebeu e não trouxe. */
    origem_lead?: string | null;
    /** Texto livre de onde o contato nasceu ("WhatsApp" = criado sozinho pela conversa). */
    origem?: string | null;
  }[];
  atividades: {
    owner_id: string | null;
    tipo?: string | null;
    titulo?: string | null;
    relacionamento_id?: string | null;
    origem?: string | null;
    cliente_nome?: string | null;
  }[];
  avaliacoes: {
    vendedor_id: string | null;
    enviado_em?: string | null;
    aberto_em: string | null;
    confirmado_em: string | null;
  }[];
  oportunidades: {
    owner_id: string | null;
    relacionamento_id: string | null;
    etapa: string;
    updated_at?: string | null;
    data_perda?: string | null;
  }[];
  /** Meta de faturamento do mês aprovada para cada pessoa (compromissos_mensais). */
  metaDeFaturamento?: Map<string, number>;
  /**
   * O funil da loja. Sem ele a nota não saberia qual etapa significa venda
   * fechada — e é essa conta que decide o bônus de cliente novo.
   */
  funil?: EtapaFunil[];
}

/** As medidas que esta versão sabe calcular. Critério com outra medida (ex.: a antiga "negociacao") é ignorado. */
export const MEDIDAS_CONHECIDAS = new Set([
  "avaliacao_conquistada",
  "avaliacao_enviada",
  "recompra",
  "prospeccao_fechada",
  "venda_nova",
  "faturamento",
  "prospeccao",
  "lead_recebido",
  "venda_lead",
  "indicacao",
  "ticket_medio",
  "conversao",
  "preco_mantido",
  "ciclo_medio",
  "cancelamentos",
  "atingimento_meta",
  "atividades",
  "crm_em_dia",
]);

/** Menor é melhor: a meta é o teto aceitável. */
export const MEDIDAS_INVERSAS = new Set(["ciclo_medio", "cancelamentos"]);

/** Como mostrar o número de cada medida. */
export function unidadeDaMedida(medida: string): "moeda" | "quantidade" | "percentual" | "dias" {
  if (medida === "faturamento" || medida === "ticket_medio") return "moeda";
  if (medida === "conversao" || medida === "preco_mantido" || medida === "atingimento_meta" || medida === "crm_em_dia") return "percentual";
  if (medida === "ciclo_medio") return "dias";
  return "quantidade";
}

/** Quanto do CRM está preenchido, de 0 a 100. É o portão do bônus. */
export function calcularCrmEmDia(
  rels: { proximo_contato_em: string | null; categoria: string | null; ultimo_contato_em: string | null }[],
): number {
  if (!rels.length) return 0;
  let pontos = 0;
  for (const r of rels) {
    let completo = 0;
    if (r.proximo_contato_em) completo += 1;
    if (r.categoria) completo += 1;
    if (r.ultimo_contato_em) completo += 1;
    pontos += completo / 3;
  }
  return Math.round((pontos / rels.length) * 100);
}

/** Lead de anúncio/campanha: chegou para o vendedor, não foi ele que trouxe. */
const deMarketing = (origem: string | null | undefined) => origem === "marketing";
/** Contato criado sozinho a partir da conversa do WhatsApp (o vendedor não prospectou). */
const nasceuNoWhatsApp = (origem: string | null | undefined) => /whats/i.test(origem ?? "");
const DIA_MS = 86_400_000;
const venceu = (status: string | null | undefined) => /cancel/i.test(status ?? "");

/**
 * Contatos que o vendedor de fato TROUXE: dele, não vieram de anúncio, não
 * nasceram sozinhos no WhatsApp e não foram cadastrados na hora da venda
 * (cliente que entrou na loja e já comprou não é prospecção).
 */
function trazidosPeloVendedor(pessoaId: string, d: Insumos) {
  const primeiraVenda = new Map<string, number>();
  for (const v of [...d.vendas]) {
    if (!v.relacionamento_id || !v.data) continue;
    const t = new Date(`${v.data.slice(0, 10)}T12:00:00-03:00`).getTime();
    const atual = primeiraVenda.get(v.relacionamento_id);
    if (atual === undefined || t < atual) primeiraVenda.set(v.relacionamento_id, t);
  }
  return d.relacionamentos.filter((r) => {
    if (r.owner_id !== pessoaId || deMarketing(r.origem_lead) || nasceuNoWhatsApp(r.origem)) return false;
    const venda = primeiraVenda.get(r.id);
    return venda === undefined || venda - new Date(r.created_at).getTime() >= DIA_MS;
  });
}

/** Quanto a pessoa fez, na unidade de cada medida. null = não tinha como ter (fica fora da conta dela). */
function quantoFez(
  medida: string,
  categoriaAlvo: string | null,
  pessoaId: string,
  d: Insumos,
  desdeIso: string,
): number | null {
  const funil = d.funil ?? FUNIL_PADRAO;
  const minhasVendas = () => d.vendas.filter((v) => participaDaVenda(v, pessoaId) && !venceu(v.status));
  switch (medida) {
    case "avaliacao_conquistada":
      // Pela data em que o cliente abriu (ou o gestor confirmou), não pela data da venda.
      return d.avaliacoes.filter((a) => {
        const quando = a.confirmado_em ?? a.aberto_em;
        return a.vendedor_id === pessoaId && !!quando && quando >= desdeIso;
      }).length;

    case "avaliacao_enviada":
      // Pela data do envio. Link aberto sem envio registrado também foi enviado.
      return d.avaliacoes.filter((a) => {
        const quando = a.enviado_em ?? a.aberto_em;
        return a.vendedor_id === pessoaId && !!quando && quando >= desdeIso;
      }).length;

    case "recompra": {
      const jaEramClientes = new Set(
        d.vendasAnteriores.map((v) => v.relacionamento_id).filter(Boolean) as string[],
      );
      // Recompra conta para os dois da dupla: os dois trabalharam o cliente que voltou.
      return minhasVendas().filter((v) => v.relacionamento_id && jaEramClientes.has(v.relacionamento_id)).length;
    }

    case "prospeccao_fechada": {
      // Venda de cliente que o vendedor TROUXE (ver trazidosPeloVendedor).
      // Lead de anúncio fechado conta em "venda_lead", não aqui.
      const trazidos = new Set(trazidosPeloVendedor(pessoaId, d).map((r) => r.id));
      return new Set(
        minhasVendas()
          .filter((v) => v.relacionamento_id && trazidos.has(v.relacionamento_id))
          .map((v) => v.relacionamento_id),
      ).size;
    }

    case "venda_nova":
      // Quantidade conta inteira para os dois: a venda em dupla é uma venda
      // fechada por cada um deles. O que se divide é o dinheiro, abaixo.
      return minhasVendas().length;

    case "faturamento":
      // Aqui, sim, a fatia. Dar o valor cheio aos dois faria o faturamento do
      // ranking somar mais do que a loja vendeu.
      return somaDoVendedor(minhasVendas(), pessoaId);

    case "prospeccao": {
      // Contato que o vendedor TROUXE no período, mais quem ele prospectou
      // (atividade "Prospecção") — um por cliente.
      const alvos = categoriaAlvo ? categoriaAlvo.split(",").map((c) => c.trim()) : [];
      const categoriaDe = new Map(d.relacionamentos.map((r) => [r.id, r.categoria ?? ""]));
      const clientes = new Set<string>();
      for (const r of trazidosPeloVendedor(pessoaId, d)) {
        if (r.created_at >= desdeIso && (!alvos.length || alvos.includes(r.categoria ?? ""))) clientes.add(r.id);
      }
      for (const a of d.atividades) {
        if (a.owner_id !== pessoaId || !/^prospec/i.test(a.tipo ?? "")) continue;
        if (alvos.length && !alvos.includes(categoriaDe.get(a.relacionamento_id ?? "") ?? "")) continue;
        const chave = a.relacionamento_id ?? (a.cliente_nome ?? "").trim().toLowerCase();
        if (chave) clientes.add(chave);
      }
      return clientes.size;
    }

    case "lead_recebido":
      // Leads de anúncio/campanha que chegaram para a pessoa no período.
      return d.relacionamentos.filter(
        (r) => r.owner_id === pessoaId && r.created_at >= desdeIso && deMarketing(r.origem_lead),
      ).length;

    case "venda_lead":
      // Venda fechada de cliente que veio de anúncio/campanha.
      return minhasVendas().filter((v) => deMarketing(v.origem_lead)).length;

    case "indicacao": {
      // Cliente que chegou por indicação: atividade marcada com origem
      // "Indicação" ou contato com origem indicação. Um por cliente.
      const clientes = new Set<string>();
      for (const a of d.atividades) {
        if (a.owner_id !== pessoaId || !/^indica/i.test(a.origem ?? "")) continue;
        const chave = a.relacionamento_id ?? (a.cliente_nome ?? "").trim().toLowerCase();
        if (chave) clientes.add(chave);
      }
      for (const r of d.relacionamentos) {
        if (r.owner_id === pessoaId && r.created_at >= desdeIso && r.origem_lead === "indicacao") clientes.add(r.id);
      }
      return clientes.size;
    }

    case "ticket_medio": {
      const vendas = minhasVendas();
      if (!vendas.length) return null;
      return Math.round(somaDoVendedor(vendas, pessoaId) / vendas.length);
    }

    case "conversao": {
      // Ganhos ÷ (ganhos + perdidos) entre os negócios decididos no período.
      let ganhos = 0;
      let perdidos = 0;
      for (const o of d.oportunidades) {
        if (o.owner_id !== pessoaId) continue;
        const quando = o.data_perda ?? o.updated_at ?? "";
        if (!quando || quando < desdeIso) continue;
        if (ehGanho(o.etapa, funil) || ehPosVenda(o.etapa, funil)) ganhos++;
        else if (ehPerda(o.etapa, funil)) perdidos++;
      }
      if (ganhos + perdidos === 0) return null;
      return Math.round((ganhos / (ganhos + perdidos)) * 100);
    }

    case "preco_mantido": {
      // Quanto do preço de tabela foi mantido (100% = vendeu sem desconto).
      let tabela = 0;
      let fechado = 0;
      for (const v of minhasVendas()) {
        const original = Number(v.valor_original ?? 0);
        const final = Number(v.valor_fechado ?? v.valor ?? 0);
        if (original > 0 && final > 0) {
          tabela += original;
          fechado += final;
        }
      }
      if (tabela <= 0) return null;
      return Math.round(Math.min(100, (fechado / tabela) * 100));
    }

    case "ciclo_medio": {
      // Dias do cadastro do cliente até a venda. Menor é melhor.
      const criadoEm = new Map(d.relacionamentos.map((r) => [r.id, new Date(r.created_at).getTime()]));
      const ciclos: number[] = [];
      for (const v of minhasVendas()) {
        const inicio = v.relacionamento_id ? criadoEm.get(v.relacionamento_id) : undefined;
        if (inicio === undefined || !v.data) continue;
        const dias = (new Date(`${v.data.slice(0, 10)}T12:00:00-03:00`).getTime() - inicio) / DIA_MS;
        if (dias >= 0) ciclos.push(dias);
      }
      if (!ciclos.length) return null;
      return Math.round(ciclos.reduce((s, x) => s + x, 0) / ciclos.length);
    }

    case "cancelamentos":
      // Venda cancelada no período. Menor é melhor.
      return d.vendas.filter((v) => participaDaVenda(v, pessoaId) && venceu(v.status)).length;

    case "atingimento_meta": {
      const meta = d.metaDeFaturamento?.get(pessoaId) ?? 0;
      if (meta <= 0) return null;
      return Math.round((somaDoVendedor(minhasVendas(), pessoaId) / meta) * 100);
    }

    case "atividades":
      // Só o que o vendedor fez: registros automáticos ("Etapa alterada",
      // "IA moveu") não contam. Mesma régua de src/lib/kpis.ts.
      return d.atividades.filter((a) => a.owner_id === pessoaId && ehAtividadeDoVendedor(a)).length;

    case "crm_em_dia":
      return calcularCrmEmDia(d.relacionamentos.filter((r) => r.owner_id === pessoaId));

    default:
      return 0;
  }
}

/** Fração da meta atingida (0–1). Nas inversas, a meta é o teto: quem fica abaixo leva tudo. */
function proporcaoDaMeta(medida: string, feito: number, meta: number): number {
  if (MEDIDAS_INVERSAS.has(medida)) {
    if (meta <= 0) return feito <= 0 ? 1 : 0;
    return feito <= meta ? 1 : Math.max(0, meta / feito);
  }
  return meta > 0 ? Math.min(1, feito / meta) : 0;
}

export function calcularNota(
  pessoa: { id: string; nome: string; loja: string },
  criterios: Criterio[],
  d: Insumos,
  desdeIso: string,
  bonusCrmMinimo: number,
): NotaDoVendedor {
  const parcelas: ParcelaDaNota[] = criterios
    .filter((c) => c.ativo && MEDIDAS_CONHECIDAS.has(c.medida))
    .map((c) => {
      const valor = quantoFez(c.medida, c.categoria_alvo, pessoa.id, d, desdeIso);
      const meta = Number(c.meta_mes);
      const semDado = valor === null;
      const feito = valor ?? 0;
      return {
        criterioId: c.id,
        titulo: c.titulo,
        feito,
        meta,
        peso: Number(c.peso),
        pontos: semDado ? 0 : Number(c.peso) * proporcaoDaMeta(c.medida, feito, meta),
        ...(semDado ? { semDado: true } : {}),
      };
    });

  // Medida sem dado para a pessoa sai da conta dela (não vira zero).
  const contam = parcelas.filter((p) => !p.semDado);
  const somaPesos = contam.reduce((s, p) => s + p.peso, 0);
  const bruto = contam.reduce((s, p) => s + p.pontos, 0);
  const nota = somaPesos > 0 ? (bruto / somaPesos) * 10 : 0;

  const crmEmDia = quantoFez("crm_em_dia", null, pessoa.id, d, desdeIso) ?? 0;

  return {
    vendedorId: pessoa.id,
    nome: pessoa.nome,
    loja: pessoa.loja,
    nota: Math.round(nota * 10) / 10,
    parcelas,
    crmEmDia,
    bonus: crmEmDia >= bonusCrmMinimo,
  };
}

export async function carregarConfigRanking() {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;

  const [{ data: config }, { data: criterios }] = await Promise.all([
    sb.from("ranking_config").select("*").maybeSingle(),
    sb.from("ranking_criterios").select("*").order("ordem"),
  ]);

  return {
    config: config ?? {
      bonus_crm_minimo: 80,
      bonus_descricao: "Bônus mensal da equipe",
      mf_no_ranking_do_grupo: false,
    },
    criterios: (criterios ?? []) as Criterio[],
  };
}
