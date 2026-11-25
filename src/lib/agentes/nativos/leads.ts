/**
 * GUARDIÃO DOS LEADS — de 10 em 10 minutos, olha a fila de leads que ainda
 * ninguém respondeu.
 *
 * Todo lead nasce com um prazo de resposta (prazo_resposta; hoje 30 minutos).
 * O guardião avisa em dois tempos:
 *   - na METADE do prazo, o dono recebe "responda até 14h32" — ainda dá;
 *   - com o prazo VENCIDO, o aviso vira urgente para o dono e sobe para o
 *     gestor da loja (fora do horário comercial só o dono é avisado: acordar
 *     gestor às 23h por um lead que chegou de madrugada não ajuda ninguém).
 * Lead sem vendedor nem SDR vai para o SDR da loja, senão para o gestor.
 *
 * "Respondido" é o mesmo critério do relatório de atendimento
 * (src/lib/leads/atendimento.ts): marcado como respondido, ou qualquer
 * atividade registrada com o cliente depois que o lead chegou — menos a que a
 * própria IA cria ao abrir a oportunidade.
 *
 * A chave é uma por lead ("leads:sla:<id>"): o aviso da metade vira o aviso
 * de vencido no mesmo card, sem duplicar.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, ResultadoAgente } from "../tipos";
import {
  anotar, chaveDe, horaEmSaoPaulo, HORA_MS, lerPorIds, lerTudo, limitarPorPessoa, plural, responsaveisDaLoja,
  resumosPorGestor,
} from "./comum";

export interface LeadSla {
  id: string;
  empresa: string;
  nome: string | null;
  status: string;
  sdr_id: string | null;
  vendedor_id: string | null;
  prazo_resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  relacionamento_id: string | null;
}

/** Status em que o lead ainda espera alguém. */
export const STATUS_EM_ESPERA = ["aguardando_sdr", "atribuido_sdr", "repassado_vendedor"];
/** Prazo usado quando o lead chegou sem prazo gravado (o padrão do sistema). */
export const PRAZO_PADRAO_MIN = 30;
/** Lead mais velho que isto já não é caso de SLA: é follow-up. */
export const JANELA_DIAS = 7;

export type SituacaoSla = "atendido" | "fora_da_fila" | "no_prazo" | "metade" | "vencido";

export interface ResultadoSla {
  situacao: SituacaoSla;
  /** Quando o prazo vence (ms). */
  prazoEm: number;
  /** Minutos que faltam (positivo) ou de atraso (negativo). */
  minutosParaVencer: number;
}

/**
 * Onde o lead está em relação ao prazo de resposta.
 * `atendidoEm` é a primeira atividade com o cliente depois da chegada (ms).
 */
export function situacaoDoLead(lead: LeadSla, agora: number, atendidoEm: number | null = null): ResultadoSla {
  const chegou = Date.parse(lead.created_at);
  const prazoGravado = lead.prazo_resposta ? Date.parse(lead.prazo_resposta) : NaN;
  const prazoEm = Number.isFinite(prazoGravado) ? prazoGravado : chegou + PRAZO_PADRAO_MIN * 60_000;
  const minutosParaVencer = Math.round((prazoEm - agora) / 60_000);
  const base = { prazoEm, minutosParaVencer };

  if (lead.respondido_em || (atendidoEm !== null && atendidoEm >= chegou)) return { situacao: "atendido", ...base };
  if (!STATUS_EM_ESPERA.includes(lead.status)) return { situacao: "fora_da_fila", ...base };
  if (agora > prazoEm) return { situacao: "vencido", ...base };
  const total = Math.max(60_000, prazoEm - chegou);
  if (agora - chegou >= total / 2) return { situacao: "metade", ...base };
  return { situacao: "no_prazo", ...base };
}

/** Quem cuida do lead agora: o vendedor, ou o SDR enquanto não foi repassado. */
export function donoDoLead(lead: Pick<LeadSla, "vendedor_id" | "sdr_id">): string | null {
  return lead.vendedor_id ?? lead.sdr_id ?? null;
}

function horaCurta(ms: number): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(ms);
}

function atraso(min: number): string {
  const m = Math.abs(min);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} dias`;
}

/** Atividades que a IA grava sozinha não contam como atendimento. */
function atividadeDeGente(a: { origem: string | null; tipo: string | null; titulo: string | null }): boolean {
  if (a.origem === "whatsapp_ia") return false;
  return !(a.tipo === "Outro" && /^(Oportunidade |IA moveu|Etapa alterada)/.test(a.titulo ?? ""));
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb } = ctx;
  const agora = ctx.agora.getTime();
  const desde = new Date(agora - JANELA_DIAS * 24 * HORA_MS).toISOString();
  const equipe = await responsaveisDaLoja(sb);

  const leads = await lerTudo<LeadSla>((de, ate) =>
    sb
      .from("leads_recebidos")
      .select("id, empresa, nome, status, sdr_id, vendedor_id, prazo_resposta, respondido_em, created_at, relacionamento_id")
      .in("status", STATUS_EM_ESPERA)
      .is("respondido_em", null)
      .or("natureza.is.null,natureza.eq.lead")
      .gte("created_at", desde)
      .order("id")
      .range(de, ate),
  );

  // Primeira atividade de gente com o cliente de cada lead.
  const atividades = await lerPorIds<{ relacionamento_id: string; ocorrida_em: string; origem: string | null; tipo: string | null; titulo: string | null }>(
    leads.map((l) => l.relacionamento_id ?? ""),
    (bloco, de, ate) =>
      sb
        .from("atividades")
        .select("relacionamento_id, ocorrida_em, origem, tipo, titulo")
        .in("relacionamento_id", bloco)
        .gte("ocorrida_em", desde)
        .order("id")
        .range(de, ate),
  );
  const atividadesPorRel = new Map<string, number[]>();
  for (const a of atividades) {
    if (!atividadeDeGente(a)) continue;
    const l = atividadesPorRel.get(a.relacionamento_id) ?? [];
    l.push(Date.parse(a.ocorrida_em));
    atividadesPorRel.set(a.relacionamento_id, l);
  }

  const horarioComercial = (() => {
    const h = horaEmSaoPaulo(ctx.agora);
    return h >= 7 && h < 21;
  })();

  const achados: Achado[] = [];
  const resumoMestres = new Map<string, string[]>();
  let metade = 0;
  let vencidos = 0;
  let semDono = 0;

  // Os mais atrasados primeiro.
  const avaliados = leads
    .map((l) => {
      const chegou = Date.parse(l.created_at);
      const atendido = (atividadesPorRel.get(l.relacionamento_id ?? "") ?? []).filter((t) => t >= chegou).sort((a, b) => a - b)[0] ?? null;
      return { l, r: situacaoDoLead(l, agora, atendido) };
    })
    .filter((x) => x.r.situacao === "metade" || x.r.situacao === "vencido")
    .sort((a, b) => a.r.minutosParaVencer - b.r.minutosParaVencer);

  for (const { l, r } of avaliados) {
    const nome = l.nome?.trim() || "Lead sem nome";
    const venceu = r.situacao === "vencido";
    if (venceu) vencidos++;
    else metade++;

    const donoId = donoDoLead(l);
    const dono = equipe.pessoa(donoId);
    if (dono) {
      achados.push({
        chave: chaveDe("leads", "sla", l.id),
        empresa: l.empresa,
        destinatarioId: dono.id,
        titulo: venceu ? `Lead sem resposta há ${atraso(r.minutosParaVencer)}: ${nome}` : `Responda até ${horaCurta(r.prazoEm)}: ${nome}`,
        descricao: venceu
          ? `O prazo de resposta venceu às ${horaCurta(r.prazoEm)}. Responda agora e marque como respondido.`
          : `Faltam ${r.minutosParaVencer} min para o prazo de resposta. Quem responde primeiro leva o cliente.`,
        prioridade: venceu ? "urgente" : "alta",
        entidadeTipo: "lead",
        entidadeId: l.id,
        acaoUrl: "/leads",
        expiraEmDias: 1,
        podeGerarMensagem: true,
      });
    } else {
      semDono++;
    }

    // Sem dono ativo, ou prazo vencido: sobe para quem distribui / cobra.
    if (!dono || (venceu && horarioComercial)) {
      const destino = dono ? equipe.gestoresPara(l.empresa) : equipe.sdrPara(l.empresa);
      const motivo = dono ? `${dono.nome} não respondeu (venceu ${horaCurta(r.prazoEm)})` : "sem vendedor";
      if (destino.mestres) {
        for (const id of destino.ids) anotar(resumoMestres, id, `${l.empresa}: ${nome} — ${motivo}`);
      } else if (destino.ids[0]) {
        achados.push({
          chave: chaveDe("leads", dono ? "escalada" : "sem-dono", l.id),
          empresa: l.empresa,
          destinatarioId: destino.ids[0],
          titulo: dono ? `Lead parado com ${dono.nome}: ${nome}` : `Lead sem vendedor: ${nome}`,
          descricao: dono
            ? `O prazo venceu há ${atraso(r.minutosParaVencer)}. Cobre a resposta ou repasse o lead.`
            : "Ninguém está com este lead. Repasse para um vendedor agora.",
          prioridade: dono ? "alta" : "urgente",
          entidadeTipo: "lead",
          entidadeId: l.id,
          acaoUrl: "/leads",
          expiraEmDias: 1,
        });
      }
    }
  }

  const resumos = resumosPorGestor({
    agente: "leads",
    tipo: "escalada",
    linhas: resumoMestres,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: (n) => `${plural(n, "lead")} esperando resposta`,
    abertura: "Leads com o prazo de resposta vencido ou sem vendedor:",
    prioridade: "alta",
    acaoUrl: "/leads",
  });

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo:
      vencidos + metade + semDono === 0
        ? "Fila de leads em dia."
        : `${plural(vencidos, "lead")} com prazo vencido, ${metade} na metade do prazo, ${semDono} sem dono ativo.`,
    achados: [...final, ...resumos],
    metricas: { naFila: leads.length, metadeDoPrazo: metade, vencidos, semDono, cortadosPeloTeto: cortados },
  };
}

export const agenteLeads: DefinicaoAgente = {
  id: "leads",
  nome: "Guardião dos Leads",
  cargo: "Guardião do prazo de resposta",
  setor: "vendas",
  icone: "Timer",
  missao: "Não deixa lead esfriar na fila: avisa o dono na metade do prazo de resposta e o gestor quando o prazo vence.",
  agenda: { tipo: "intervalo", minutos: 10 },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
