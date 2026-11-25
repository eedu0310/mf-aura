/**
 * Regras puras da conversa do gestor com a Diretora (testáveis sem banco).
 *
 * A Diretora responde por IA em JSON: { resposta, encaminhar?, proposta? }.
 * Nada disso é confiado de olhos fechados:
 *   - a resposta tem de ser texto, curta, e TODO número dela tem de ter vindo
 *     dos dados que ela recebeu ou do que o gestor escreveu (regra 5 do
 *     contrato) — senão vale a resposta por regra;
 *   - "encaminhar" só para agentes que existem (nunca para ela mesma), no
 *     máximo 3, um pedido por agente, com o mesmo cuidado com números;
 *   - a "proposta" passa pela mesma conferência de configuração de qualquer
 *     proposta de agente (quem chama entrega a função) e nasce "proposta":
 *     quem aprova é o gestor mestre, na aba Propostas.
 */
import { numerosConferem } from "./util";
import type { ConfigAgenteConfiguravel, MensagemConversaDiretora, PropostaAgente, Setor } from "./tipos";

export const LIMITE_TEXTO_GESTOR = 2000;
export const MAX_ENCAMINHADOS = 3;
const LIMITE_RESPOSTA = 1200;
const LIMITE_PEDIDO = 500;
const SETORES_DE_PROPOSTA: Setor[] = ["vendas", "pos-venda", "marketing", "gestao", "conhecimento", "dados"];

export const RESPOSTA_SEM_IA = "Anotei sua ideia; vou levar para a equipe na próxima rodada.";

/** O texto que o gestor mandou, limpo; null se vazio ou longo demais. */
export function textoDoGestor(v: unknown): { texto: string } | { erro: string } {
  if (typeof v !== "string" || !v.trim()) return { erro: "Escreva a sua ideia antes de enviar." };
  const texto = v.replace(/\r\n/g, "\n").trim();
  if (texto.length > LIMITE_TEXTO_GESTOR) {
    return { erro: `A mensagem passou de ${LIMITE_TEXTO_GESTOR} caracteres. Pode resumir um pouco?` };
  }
  return { texto };
}

export interface Encaminhamento {
  agenteId: string;
  pedido: string;
}

export interface RespostaInterpretada {
  /** null = a IA não devolveu algo aproveitável (vale a resposta por regra). */
  resposta: string | null;
  encaminhar: Encaminhamento[];
  proposta: PropostaAgente | null;
  /** O que foi jogado fora e por quê (vai para o log, não para a tela). */
  descartes: string[];
}

function limpar(v: unknown, limite: number): string {
  return typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, limite) : "";
}

export function interpretarRespostaDaDiretora(
  bruto: unknown,
  opcoes: {
    diretoraId: string;
    /** id → nome dos agentes que podem receber pedido. */
    agentes: Map<string, string>;
    /** Números que podem aparecer em texto (dos dados e do que o gestor escreveu). */
    permitidos: Iterable<number | string>;
    validarConfig: (v: unknown) => ConfigAgenteConfiguravel | null;
  },
): RespostaInterpretada {
  const descartes: string[] = [];
  const permitidos = [...opcoes.permitidos];
  const obj = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : null;
  if (!obj) return { resposta: null, encaminhar: [], proposta: null, descartes: ["a IA não devolveu um objeto"] };

  let resposta: string | null = limpar(obj.resposta, LIMITE_RESPOSTA) || null;
  if (resposta && !numerosConferem(resposta, permitidos)) {
    descartes.push("resposta com número que não está nos dados");
    resposta = null;
  }

  const encaminhar: Encaminhamento[] = [];
  const lista = Array.isArray(obj.encaminhar) ? obj.encaminhar : [];
  for (const item of lista) {
    if (encaminhar.length >= MAX_ENCAMINHADOS) break;
    const e = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const agenteId = typeof e?.agenteId === "string" ? e.agenteId.trim() : "";
    const pedido = limpar(e?.pedido, LIMITE_PEDIDO);
    if (!agenteId || !pedido) continue;
    if (agenteId === opcoes.diretoraId || !opcoes.agentes.has(agenteId)) {
      descartes.push(`encaminhamento para agente desconhecido (${agenteId})`);
      continue;
    }
    if (encaminhar.some((x) => x.agenteId === agenteId)) continue;
    if (!numerosConferem(pedido, permitidos)) {
      descartes.push(`pedido a ${agenteId} com número que não está nos dados`);
      continue;
    }
    encaminhar.push({ agenteId, pedido });
  }

  let proposta: PropostaAgente | null = null;
  const p = obj.proposta && typeof obj.proposta === "object" ? (obj.proposta as Record<string, unknown>) : null;
  if (p) {
    const nome = limpar(p.nome, 80);
    const setor = SETORES_DE_PROPOSTA.includes(p.setor as Setor) ? (p.setor as Setor) : null;
    const missao = limpar(p.missao, 400);
    const justificativa = limpar(p.justificativa, 600);
    const config = opcoes.validarConfig(p.config);
    if (!nome || !setor || !missao || !config) descartes.push("proposta incompleta ou com configuração insegura");
    else if (!numerosConferem(`${missao} ${justificativa}`, permitidos)) descartes.push("proposta com número inventado");
    else proposta = { propostoPor: opcoes.diretoraId, nome, setor, missao, justificativa, config };
  }

  return { resposta, encaminhar, proposta, descartes };
}

/** A resposta por regra, quando a IA não respondeu (ou respondeu com número inventado). */
export function respostaPorRegra(nomesEncaminhados: string[]): string {
  if (!nomesEncaminhados.length) return RESPOSTA_SEM_IA;
  const nomes =
    nomesEncaminhados.length === 1
      ? nomesEncaminhados[0]
      : `${nomesEncaminhados.slice(0, -1).join(", ")} e ${nomesEncaminhados[nomesEncaminhados.length - 1]}`;
  return `Anotei sua ideia e passei para ${nomes}. Volto com o resultado no próximo plano do dia.`;
}

/** Linha de aura_escritorio_mensagens → mensagem da conversa (do ponto de vista do gestor). */
export function mensagemDaConversa(
  linha: { id: string; de_agente: string; texto: string; criado_em: string; dados?: unknown },
  idDoGestor: string,
): MensagemConversaDiretora {
  const dados = linha.dados && typeof linha.dados === "object" ? (linha.dados as Record<string, unknown>) : {};
  const autor = linha.de_agente === idDoGestor ? "gestor" : "diretora";
  const m: MensagemConversaDiretora = { id: linha.id, autor, texto: linha.texto, criadoEm: linha.criado_em };
  if (autor === "diretora") {
    if (Array.isArray(dados.encaminhados)) {
      m.encaminhados = dados.encaminhados
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
        .map((e) => ({ agenteId: String(e.agenteId ?? ""), agenteNome: String(e.agenteNome ?? e.agenteId ?? ""), pedido: String(e.pedido ?? "") }))
        .filter((e) => e.agenteId);
    }
    const p = dados.proposta && typeof dados.proposta === "object" ? (dados.proposta as Record<string, unknown>) : null;
    if (p && typeof p.nome === "string") m.proposta = { nome: p.nome, setor: p.setor as Setor, gravada: p.gravada === true };
    if (dados.semIA === true) m.semIA = true;
  }
  return m;
}
