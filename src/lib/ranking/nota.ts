import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ehGanho, FUNIL_PADRAO, nomeDaChave, type EtapaFunil } from "@/lib/funil";
import { participaDaVenda, somaDoVendedor } from "@/lib/parceria";

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
  }[];
  atividades: { owner_id: string | null; titulo?: string | null; relacionamento_id?: string | null }[];
  avaliacoes: {
    vendedor_id: string | null;
    enviado_em?: string | null;
    aberto_em: string | null;
    confirmado_em: string | null;
  }[];
  oportunidades: { owner_id: string | null; relacionamento_id: string | null; etapa: string }[];
  /**
   * O funil da loja. Sem ele a nota não saberia qual etapa significa venda
   * fechada — e é essa conta que decide o bônus de cliente novo.
   */
  funil?: EtapaFunil[];
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

/** Quanto a pessoa fez, na unidade de cada medida. */
function quantoFez(
  medida: string,
  categoriaAlvo: string | null,
  pessoaId: string,
  d: Insumos,
  desdeIso: string,
): number {
  switch (medida) {
    case "avaliacao_conquistada":
      return d.avaliacoes.filter(
        (a) => a.vendedor_id === pessoaId && (a.aberto_em || a.confirmado_em),
      ).length;

    case "recompra": {
      const jaEramClientes = new Set(
        d.vendasAnteriores.map((v) => v.relacionamento_id).filter(Boolean) as string[],
      );
      // Recompra conta para os dois da dupla: os dois trabalharam o cliente
      // que voltou.
      return d.vendas.filter(
        (v) =>
          participaDaVenda(v, pessoaId) &&
          v.relacionamento_id &&
          jaEramClientes.has(v.relacionamento_id),
      ).length;
    }

    case "prospeccao_fechada": {
      // Só o contato que o vendedor trouxe: lead de anúncio fechado conta em
      // "venda_lead", não aqui.
      const nasceramNoPeriodo = new Set(
        d.relacionamentos
          .filter((r) => r.owner_id === pessoaId && r.created_at >= desdeIso && !deMarketing(r.origem_lead))
          .map((r) => r.id),
      );
      return d.oportunidades.filter(
        (o) =>
          o.owner_id === pessoaId &&
          ehGanho(o.etapa, d.funil ?? FUNIL_PADRAO) &&
          o.relacionamento_id &&
          nasceramNoPeriodo.has(o.relacionamento_id),
      ).length;
    }

    case "venda_nova":
      // Quantidade conta inteira para os dois: a venda em dupla é uma venda
      // fechada por cada um deles. O que se divide é o dinheiro, abaixo.
      return d.vendas.filter((v) => participaDaVenda(v, pessoaId)).length;

    case "faturamento":
      // Aqui, sim, a fatia. Dar o valor cheio aos dois faria o faturamento do
      // ranking somar mais do que a loja vendeu, e quem fecha em dupla
      // passaria na frente de quem fecha sozinho sem ter vendido mais.
      return somaDoVendedor(d.vendas, pessoaId);

    case "prospeccao": {
      // Prospecção é o contato que o vendedor TROUXE. Os leads de anúncio
      // entram sozinhos em Relacionamentos (desde 27/10) e, contados aqui,
      // davam 200 "prospecções" para quem só recebeu o lead.
      const alvos = categoriaAlvo ? categoriaAlvo.split(",").map((c) => c.trim()) : [];
      return d.relacionamentos.filter(
        (r) =>
          r.owner_id === pessoaId &&
          r.created_at >= desdeIso &&
          !deMarketing(r.origem_lead) &&
          (!alvos.length || alvos.includes(r.categoria ?? "")),
      ).length;
    }

    case "lead_recebido":
      // Leads de anúncio/campanha que chegaram para a pessoa no período.
      return d.relacionamentos.filter(
        (r) => r.owner_id === pessoaId && r.created_at >= desdeIso && deMarketing(r.origem_lead),
      ).length;

    case "venda_lead":
      // Venda fechada de cliente que veio de anúncio/campanha.
      return d.vendas.filter((v) => participaDaVenda(v, pessoaId) && deMarketing(v.origem_lead)).length;

    case "avaliacao_enviada":
      return d.avaliacoes.filter((a) => a.vendedor_id === pessoaId && !!a.enviado_em).length;

    case "negociacao": {
      // Negócio que chegou em Negociação no período, pelo registro da
      // movimentação (arrasto do vendedor ou avanço da AURA). Um por cliente:
      // o card que foi e voltou não conta duas vezes.
      const etapa = (nomeDaChave("negociacao", d.funil ?? FUNIL_PADRAO) ?? "Negociação").toLowerCase();
      const clientes = new Set<string>();
      for (const a of d.atividades) {
        if (a.owner_id !== pessoaId || !a.titulo) continue;
        const destino = a.titulo.split("→")[1]?.trim().toLowerCase();
        if (destino === etapa) clientes.add(a.relacionamento_id ?? a.titulo);
      }
      return clientes.size;
    }

    case "atividades":
      return d.atividades.filter((a) => a.owner_id === pessoaId).length;

    case "crm_em_dia":
      return calcularCrmEmDia(d.relacionamentos.filter((r) => r.owner_id === pessoaId));

    default:
      return 0;
  }
}

export function calcularNota(
  pessoa: { id: string; nome: string; loja: string },
  criterios: Criterio[],
  d: Insumos,
  desdeIso: string,
  bonusCrmMinimo: number,
): NotaDoVendedor {
  const parcelas: ParcelaDaNota[] = criterios
    .filter((c) => c.ativo)
    .map((c) => {
      const feito = quantoFez(c.medida, c.categoria_alvo, pessoa.id, d, desdeIso);
      const meta = Number(c.meta_mes);
      const proporcao = meta > 0 ? Math.min(1, feito / meta) : 0;
      return {
        criterioId: c.id,
        titulo: c.titulo,
        feito,
        meta,
        peso: Number(c.peso),
        pontos: Number(c.peso) * proporcao,
      };
    });

  const somaPesos = parcelas.reduce((s, p) => s + p.peso, 0);
  const bruto = parcelas.reduce((s, p) => s + p.pontos, 0);
  const nota = somaPesos > 0 ? (bruto / somaPesos) * 10 : 0;

  const crmEmDia = quantoFez("crm_em_dia", null, pessoa.id, d, desdeIso);

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
