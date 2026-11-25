/**
 * AGENTE DE REATIVAÇÃO — toda segunda às 9h, separa para cada vendedor os
 * clientes antigos que vale chamar de novo.
 *
 * Quem é "cliente antigo" (qualquer uma das três):
 *   - card de pós-venda "cliente antigo" (comprou antes do CRM; marcado no
 *     WhatsApp);
 *   - comprou há mais de 12 meses e não comprou de novo desde então;
 *   - a conversa do WhatsApp foi classificada como "cliente" (natureza).
 * Fica de fora quem já está sendo trabalhado: contato nos últimos 60 dias,
 * próximo contato marcado ou negócio em aberto.
 *
 * O QUE OFERECER muda com a estação (inverno do Sul):
 *   - março a junho: temporada — limpeza/revisão antes do frio, lenha,
 *     pellet, acessórios. Prioridade maior;
 *   - julho e agosto: no meio do frio — acessórios e combustível;
 *   - setembro a fevereiro: fora da temporada — upgrade para o próximo
 *     inverno ou linha gourmet (churrasqueira, forno) para o verão.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, Prioridade, ResultadoAgente } from "../tipos";
import {
  chaveDe, diasDesde, funilDe, funisDasLojas, lerPorIds, lerTudo, limitarPorPessoa, mesDoAno, negocioEmAberto, num, plural,
  responsaveisDaLoja, somarDias,
} from "./comum";

export const DIAS_SEM_COMPRA = 365;
export const DIAS_DE_DESCANSO = 60;

export interface OfertaDaEstacao {
  texto: string;
  prioridade: Prioridade;
}

export function ofertaDaEstacao(hoje: string): OfertaDaEstacao {
  const mes = mesDoAno(hoje);
  if (mes >= 3 && mes <= 6) {
    return {
      texto: "Temporada de frio chegando: ofereça a limpeza ou revisão antes do inverno, lenha, pellet e acessórios.",
      prioridade: "media",
    };
  }
  if (mes === 7 || mes === 8) {
    return { texto: "Inverno: ofereça acessórios, lenha ecológica ou pellet para a temporada.", prioridade: "baixa" };
  }
  return {
    texto: "Fora da temporada: bom momento para um upgrade de lareira para o próximo inverno ou para a linha gourmet (churrasqueira, forno).",
    prioridade: "baixa",
  };
}

interface Candidato {
  relacionamentoId: string | null;
  posVendaId: string | null;
  empresa: string;
  nome: string;
  donoId: string | null;
  motivo: string;
  valor: number;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const corte = somarDias(hoje, -DIAS_SEM_COMPRA);

  const [antigos, vendas, conversas, funis] = await Promise.all([
    lerTudo<{ id: string; empresa: string; cliente: string | null; produto: string | null; relacionamento_id: string | null; vendedor_id: string | null }>(
      (de, ate) =>
        sb
          .from("pos_vendas")
          .select("id, empresa, cliente, produto, relacionamento_id, vendedor_id")
          .eq("origem", "cliente_antigo")
          .order("id")
          .range(de, ate),
    ),
    lerTudo<{ relacionamento_id: string | null; owner_id: string; empresa: string; cliente: string; data: string; valor: number; valor_fechado: number | null }>(
      (de, ate) =>
        sb
          .from("vendas")
          .select("relacionamento_id, owner_id, empresa, cliente, data, valor, valor_fechado")
          .not("relacionamento_id", "is", null)
          .order("id")
          .range(de, ate),
    ),
    lerTudo<{ owner_id: string; empresa: string | null; nome: string | null; relacionamento_id: string | null; carteira_relacionamento_id: string | null }>(
      (de, ate) =>
        sb
          .from("whatsapp_ia_leads")
          .select("owner_id, empresa, nome, relacionamento_id, carteira_relacionamento_id")
          .eq("natureza", "cliente")
          .eq("ignorado", false)
          .order("id")
          .range(de, ate),
    ),
    funisDasLojas(sb, equipe.lojas()),
  ]);

  const candidatos = new Map<string, Candidato>();
  for (const pv of antigos) {
    const k = pv.relacionamento_id ?? `pv:${pv.id}`;
    candidatos.set(k, {
      relacionamentoId: pv.relacionamento_id,
      posVendaId: pv.id,
      empresa: pv.empresa,
      nome: pv.cliente?.trim() || "Cliente antigo",
      donoId: pv.vendedor_id,
      motivo: pv.produto && pv.produto !== "Cliente antigo" ? `Cliente antigo (${pv.produto}).` : "Cliente antigo, comprou antes do CRM.",
      valor: 0,
    });
  }
  // Última compra de cada cliente: só entra quem não compra há mais de um ano.
  const ultimaCompra = new Map<string, (typeof vendas)[number]>();
  for (const v of vendas) {
    const atual = ultimaCompra.get(v.relacionamento_id as string);
    if (!atual || v.data > atual.data) ultimaCompra.set(v.relacionamento_id as string, v);
  }
  for (const [relId, v] of ultimaCompra) {
    if (v.data > corte) {
      candidatos.delete(relId); // comprou no último ano: não é reativação
      continue;
    }
    candidatos.set(relId, {
      relacionamentoId: relId,
      posVendaId: candidatos.get(relId)?.posVendaId ?? null,
      empresa: v.empresa,
      nome: v.cliente,
      donoId: v.owner_id,
      motivo: `Última compra em ${v.data.slice(8, 10)}/${v.data.slice(5, 7)}/${v.data.slice(0, 4)}.`,
      valor: num(v.valor_fechado ?? v.valor),
    });
  }
  for (const c of conversas) {
    const relId = c.carteira_relacionamento_id ?? c.relacionamento_id;
    if (!relId || candidatos.has(relId) || !c.empresa) continue;
    const ultima = ultimaCompra.get(relId);
    if (ultima && ultima.data > corte) continue;
    candidatos.set(relId, {
      relacionamentoId: relId,
      posVendaId: null,
      empresa: c.empresa,
      nome: c.nome?.trim() || "Cliente",
      donoId: c.owner_id,
      motivo: "Já é cliente da loja (marcado na conversa do WhatsApp).",
      valor: 0,
    });
  }

  // Quem já está sendo trabalhado sai da lista.
  const relIds = [...candidatos.values()].map((c) => c.relacionamentoId).filter((x): x is string => !!x);
  const [rels, ops] = await Promise.all([
    lerPorIds<{ id: string; owner_id: string; nome: string; ultimo_contato_em: string | null; proximo_contato_em: string | null }>(relIds, (b, de, ate) =>
      sb.from("relacionamentos").select("id, owner_id, nome, ultimo_contato_em, proximo_contato_em").in("id", b).order("id").range(de, ate),
    ),
    lerPorIds<{ relacionamento_id: string; empresa: string; etapa: string }>(relIds, (b, de, ate) =>
      sb.from("oportunidades").select("relacionamento_id, empresa, etapa").in("relacionamento_id", b).order("id").range(de, ate),
    ),
  ]);
  const relPorId = new Map(rels.map((r) => [r.id, r]));
  const comNegocio = new Set(ops.filter((o) => negocioEmAberto(o.etapa, funilDe(funis, o.empresa))).map((o) => o.relacionamento_id));

  const oferta = ofertaDaEstacao(hoje);
  const lista: Array<Candidato & { semContato: number | null }> = [];
  for (const c of candidatos.values()) {
    const rel = c.relacionamentoId ? relPorId.get(c.relacionamentoId) : undefined;
    if (c.relacionamentoId && !rel) continue; // cliente apagado
    if (c.relacionamentoId && comNegocio.has(c.relacionamentoId)) continue;
    if (rel?.proximo_contato_em && Date.parse(rel.proximo_contato_em) > agora.getTime()) continue;
    const semContato = diasDesde(rel?.ultimo_contato_em ?? null, agora);
    if (semContato !== null && semContato < DIAS_DE_DESCANSO) continue;
    lista.push({ ...c, donoId: rel?.owner_id ?? c.donoId, nome: rel?.nome ?? c.nome, semContato });
  }
  lista.sort((a, b) => b.valor - a.valor || (b.semContato ?? 9999) - (a.semContato ?? 9999));

  const achados: Achado[] = [];
  for (const c of lista) {
    const destino = equipe.destinoDoItem(c.donoId, c.empresa);
    if (!destino) continue;
    achados.push({
      chave: chaveDe("reativacao", c.relacionamentoId ?? `pv-${c.posVendaId}`),
      empresa: c.empresa,
      destinatarioId: destino,
      titulo: `Reative: ${c.nome}`,
      descricao: `${c.motivo}${c.semContato !== null ? ` Sem contato há ${c.semContato} dias.` : ""} ${oferta.texto}`,
      prioridade: oferta.prioridade,
      entidadeTipo: c.relacionamentoId ? "relacionamento" : "pos_venda",
      entidadeId: c.relacionamentoId ?? c.posVendaId ?? undefined,
      acaoUrl: c.relacionamentoId ? `/relacionamentos?id=${c.relacionamentoId}` : "/pos-venda",
      expiraEmDias: 7,
      podeGerarMensagem: true,
    });
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo: `${plural(lista.length, "cliente antigo", "clientes antigos")} para reativar; ${plural(final.length, "sugestão entregue", "sugestões entregues")} nesta semana.`,
    achados: final,
    metricas: { candidatos: candidatos.size, paraReativar: lista.length, entregues: final.length, cortadosPeloTeto: cortados },
  };
}

export const agenteReativacao: DefinicaoAgente = {
  id: "reativacao",
  nome: "Agente de Reativação",
  cargo: "Reativação de clientes antigos",
  setor: "vendas",
  icone: "RefreshCcw",
  missao: "Toda segunda, traz de volta clientes antigos com a oferta certa para a estação: limpeza, acessórios ou upgrade.",
  agenda: { tipo: "diario", horas: [9], minuto: 0, diasSemana: [1] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
