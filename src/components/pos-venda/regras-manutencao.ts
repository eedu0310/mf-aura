/**
 * Regras das manutenções (limpeza anual da chaminé), num lugar só.
 *
 * Junta duas fontes:
 *   - os REGISTROS da tabela pos_venda_manutencoes (quando ela existe);
 *   - a PREVISÃO calculada: toda instalação concluída pede uma limpeza 12
 *     meses depois. Base da conta: instalação realizada → pós-venda concluído
 *     → data agendada, a primeira que existir.
 *
 * Um cliente com registro de limpeza usa só os registros. Sem nenhum registro
 * (o caso de todo mundo antes da migração 108), vale a previsão — que vira
 * registro na primeira ação (agendar, marcar como feita, cancelar).
 */
import type { PosVenda } from "@/lib/supabase/pos-venda";
import {
  somarMeses,
  type AlvoManutencao,
  type Manutencao,
  type StatusManutencao,
  type TipoManutencao,
} from "@/lib/supabase/pos-venda-manutencao";
import { somarDias } from "./regras";

export interface ItemManutencao {
  chave: string;
  posVenda: PosVenda;
  /** Nulo quando é só a previsão calculada (ainda sem linha no banco). */
  registro: Manutencao | null;
  tipo: TipoManutencao;
  dataPrevista: string;
  dataAgendada: string | null;
  hora: string | null;
  status: StatusManutencao;
  realizadaEm: string | null;
  observacao: string | null;
}

/** De onde sai a primeira limpeza: o dia em que a lareira foi instalada. */
export function baseDaInstalacao(pv: PosVenda): string | null {
  // Cliente antigo concluído no CRM não foi instalado no dia da conclusão:
  // sem data de instalação, a primeira limpeza é programada à mão.
  const conclusao = pv.origem === "cliente_antigo" ? null : pv.posVendaRealizadoEm;
  const base = pv.instalacaoRealizadaEm ?? conclusao ?? pv.dataAgendamento;
  return base ? base.slice(0, 10) : null;
}

/** Instalação concluída: card concluído, ou com o marco de instalação gravado. */
export function instalacaoConcluida(pv: PosVenda) {
  return pv.status === "pos_venda_realizado" || Boolean(pv.instalacaoRealizadaEm);
}

/** Data em que a manutenção acontece de fato: a combinada, senão a prevista. */
export function dataDaManutencao(m: Pick<ItemManutencao, "dataAgendada" | "dataPrevista">) {
  return m.dataAgendada ?? m.dataPrevista;
}

export function estaAberta(m: Pick<ItemManutencao, "status">) {
  return m.status === "prevista" || m.status === "agendada";
}

export function alvoDe(item: ItemManutencao): AlvoManutencao {
  if (item.registro) return { id: item.registro.id };
  return {
    nova: {
      posVendaId: item.posVenda.id,
      empresa: item.posVenda.empresa,
      tipo: item.tipo,
      dataPrevista: item.dataPrevista,
    },
  };
}

export function montarManutencoes(itens: PosVenda[], registros: Manutencao[]): ItemManutencao[] {
  const porId = new Map(itens.map((pv) => [pv.id, pv]));
  const comLimpeza = new Set<string>();
  const lista: ItemManutencao[] = [];

  for (const r of registros) {
    const pv = porId.get(r.posVendaId);
    if (!pv) continue; // de outra loja (filtro) ou fora do que a pessoa enxerga
    if (r.tipo === "limpeza_chamine") comLimpeza.add(pv.id);
    lista.push({
      chave: r.id,
      posVenda: pv,
      registro: r,
      tipo: r.tipo,
      dataPrevista: r.dataPrevista,
      dataAgendada: r.dataAgendada,
      hora: r.hora,
      status: r.status,
      realizadaEm: r.realizadaEm,
      observacao: r.observacao,
    });
  }

  for (const pv of itens) {
    if (comLimpeza.has(pv.id) || !instalacaoConcluida(pv)) continue;
    const base = baseDaInstalacao(pv);
    if (!base) continue;
    lista.push({
      chave: `previsao-${pv.id}`,
      posVenda: pv,
      registro: null,
      tipo: "limpeza_chamine",
      dataPrevista: somarMeses(base, 12),
      dataAgendada: null,
      hora: null,
      status: "prevista",
      realizadaEm: null,
      observacao: null,
    });
  }

  return lista;
}

/* ------------------------------------------------------------ grupos */

export type GrupoManutencao = "vencidas" | "este_mes" | "proximos_90" | "mais_adiante" | "realizadas";

export const GRUPOS_MANUTENCAO: { chave: GrupoManutencao; titulo: string; descricao: string }[] = [
  { chave: "vencidas", titulo: "Vencidas", descricao: "Passou da data e ainda não foi feita" },
  { chave: "este_mes", titulo: "Este mês", descricao: "Ligar agora para combinar o dia" },
  { chave: "proximos_90", titulo: "Próximos 90 dias", descricao: "Já dá para ir avisando" },
  { chave: "mais_adiante", titulo: "Mais adiante", descricao: "Daqui a mais de 90 dias" },
  { chave: "realizadas", titulo: "Realizadas", descricao: "Feitas, da mais recente para a mais antiga" },
];

/** Último dia do mês de "AAAA-MM-DD". */
function fimDoMes(dia: string) {
  return somarDias(somarMeses(`${dia.slice(0, 8)}01`, 1), -1);
}

export function grupoDaManutencao(m: ItemManutencao, hoje: string): GrupoManutencao | null {
  if (m.status === "realizada") return "realizadas";
  if (m.status === "cancelada") return null;
  const dia = dataDaManutencao(m);
  if (dia < hoje) return "vencidas";
  if (dia <= fimDoMes(hoje)) return "este_mes";
  if (dia <= somarDias(hoje, 90)) return "proximos_90";
  return "mais_adiante";
}

export function manutencaoVencida(m: ItemManutencao, hoje: string) {
  return estaAberta(m) && dataDaManutencao(m) < hoje;
}

/* ----------------------------------------------------------- WhatsApp */

/** Número para o wa.me: só dígitos, com o 55 do Brasil na frente. */
export function numeroWhatsApp(telefone: string | null | undefined) {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/**
 * Link simples do WhatsApp (wa.me) com a mensagem já escrita, oferecendo a
 * limpeza anual. Só abre a conversa: quem manda é a pessoa.
 */
export function linkWhatsAppLimpeza(pv: PosVenda, tipo: TipoManutencao = "limpeza_chamine") {
  const numero = numeroWhatsApp(pv.telefone);
  if (!numero) return null;
  const nome = pv.cliente.trim().split(/\s+/)[0] ?? "";
  // O produto vai entre parênteses: "sua Adatto" e "seu fogão" pedem gêneros
  // diferentes, e a frase não pode sair errada para nenhum dos dois.
  const produto = pv.produto && pv.produto !== "Cliente antigo" ? ` (${pv.produto})` : "";
  const servico =
    tipo === "revisao" ? "a revisão anual" : tipo === "outro" ? "uma manutenção" : "a limpeza da chaminé";
  const texto =
    `Olá${nome ? `, ${nome}` : ""}! Tudo bem? Aqui é da ${pv.empresa}. ` +
    `Está chegando a hora do cuidado anual da sua lareira${produto}: para ela seguir aquecendo bem e ` +
    `com segurança, recomendamos ${servico} uma vez por ano. ` +
    `Quer que a gente agende um horário com você?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
