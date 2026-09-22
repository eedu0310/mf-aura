/**
 * Regras determinísticas do Supervisor AURA — funcionam na hora, sem IA.
 * Detectam a etapa do funil pela conversa e calculam alertas de atendimento.
 * A IA (supervisor.ts) complementa isso com leitura de contexto e o manual.
 */

export type Etapa = "Prospecção" | "Apresentação" | "Proposta" | "Negociação" | "Fechados" | "Perdidos";

export const ORDEM_ETAPA: Record<Etapa, number> = {
  Prospecção: 0,
  Apresentação: 1,
  Proposta: 2,
  Negociação: 3,
  Fechados: 4,
  Perdidos: -1,
};

export const ETAPAS: Etapa[] = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados", "Perdidos"];

export interface MsgLike {
  id: string;
  fromMe: boolean;
  text: string;
  type: string;
  fileName?: string;
  timestamp: number;
}

export interface Evidencia {
  etapa: Etapa;
  texto: string;
  msgId: string;
}

export interface Deteccao {
  comercial: boolean;
  etapa: Etapa | null;
  evidencias: Evidencia[];
  sinalPerda: string | null;
}

export interface Alerta {
  tipo: "sem_resposta" | "follow_up" | "risco_perda";
  nivel: "medio" | "alto" | "critico";
  texto: string;
  desde: number;
}

export function normalizar(texto: string) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Quem = "vendedor" | "cliente" | "qualquer";
interface Regra {
  etapa: Etapa;
  quem: Quem;
  re: RegExp;
}

const REGRAS: Regra[] = [
  // ---------- Fechamento ----------
  { etapa: "Fechados", quem: "qualquer", re: /\bfechamos\b/ },
  { etapa: "Fechados", quem: "qualquer", re: /\bpedido (foi )?(confirmado|realizado|fechado|efetivado)\b/ },
  { etapa: "Fechados", quem: "qualquer", re: /\bcontrato (foi )?assinado\b/ },
  { etapa: "Fechados", quem: "qualquer", re: /\bpagamento (foi )?(confirmado|realizado|efetuado|aprovado|recebido)\b/ },
  { etapa: "Fechados", quem: "cliente", re: /\b(fiz|fizemos|mandei|enviei|segue|seguem?|ta ai|esta ai) (o |a )?(pix|comprovante|pagamento|transferencia|deposito|sinal)\b/ },
  { etapa: "Fechados", quem: "cliente", re: /\bcomprovante\b/ },
  { etapa: "Fechados", quem: "cliente", re: /\b(quero|vamos|vou|pode|podemos) fechar\b/ },
  { etapa: "Fechados", quem: "cliente", re: /\bpode (fazer|tirar|emitir|mandar fazer) o pedido\b/ },
  { etapa: "Fechados", quem: "cliente", re: /^(ok,? )?fechado[!. ]*$/ },
  { etapa: "Fechados", quem: "vendedor", re: /\b(recebemos|recebi|confirmo|confirmado|confirmamos) (o |a )?(seu |sua )?(pagamento|pix|comprovante|sinal|transferencia)\b/ },
  { etapa: "Fechados", quem: "vendedor", re: /\b(parabens|obrigad[oa]) pela (compra|aquisicao)\b/ },
  { etapa: "Fechados", quem: "vendedor", re: /\bseu pedido (ja )?(esta |foi )?(confirmado|registrado|feito|lancado)\b/ },

  // ---------- Negociação ----------
  { etapa: "Negociação", quem: "qualquer", re: /\bdesconto\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bparcel(a|as|ar|amento|ado|ada)\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bem \d{1,2} ?x\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\ba vista\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bcondic(ao|oes) de pagamento\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bmelhor (preco|valor|condicao)\b/ },
  { etapa: "Negociação", quem: "cliente", re: /\bconsegue (fazer|deixar|chegar|baixar|melhorar)\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bnegocia(r|cao|vel|mos)\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\bcontraproposta\b/ },
  { etapa: "Negociação", quem: "qualquer", re: /\b(baixar|reduzir|abaixar) o (preco|valor)\b/ },
  { etapa: "Negociação", quem: "cliente", re: /\b(mais barato|outro orcamento|concorrente|outra loja)\b/ },

  // ---------- Proposta / orçamento enviado ----------
  { etapa: "Proposta", quem: "vendedor", re: /\b(segue|seguem|envio|enviei|enviando|mandei|mando|te passo|passei|anexo|em anexo|encaminho|encaminhei)\b.{0,40}\b(orcamento|proposta|cotacao|valores?|precos?)\b/ },
  { etapa: "Proposta", quem: "vendedor", re: /\b(orcamento|proposta|cotacao)\b.{0,40}\b(segue|anexo|enviad[oa]|pront[oa]|ficou|fica|finalizad[oa])\b/ },
  { etapa: "Proposta", quem: "vendedor", re: /\bo valor (total )?(fica|ficaria|ficou|e de|sai|seria)\b/ },
  { etapa: "Proposta", quem: "vendedor", re: /\b(fica|ficaria|sai|total)( em| por| de)? r\$ ?\d/ },
  { etapa: "Proposta", quem: "vendedor", re: /r\$ ?\d{2,}/ },
  { etapa: "Proposta", quem: "cliente", re: /\b(recebi|vi|analisei|olhei|chegou) (o |a )?(seu |sua )?(orcamento|proposta|cotacao)\b/ },

  // ---------- Apresentação ----------
  { etapa: "Apresentação", quem: "vendedor", re: /\b(catalogo|portfolio|modelos disponiveis|linha de produtos|showroom|apresentacao|ficha tecnica|video do produto)\b/ },
  { etapa: "Apresentação", quem: "qualquer", re: /\b(agendar|agendamos|agendado|marcar|marcamos|marcado) (uma |a )?(visita|reuniao|medicao|apresentacao)\b/ },
  { etapa: "Apresentação", quem: "qualquer", re: /\b(visita tecnica|medicao no local)\b/ },
];

const RE_COMERCIAL =
  /\b(orcamento|orcamentos|preco|precos|valor|valores|quanto (custa|fica|sai|e)|lareira|lareiras|churrasqueira|forno|coifa|calefacao|aquecedor|aquecimento|lenha|gas|bioetanol|instala(r|cao)|comprar|compra|modelo|modelos|catalogo|loja|showroom|obra|projeto|arquitet[oa]|entrega|frete|prazo|medida|medidas)\b/;

const RE_PERDA =
  /\b(ja comprei|fechei com outr[oa]|comprei (em|com) outr[oa]|nao tenho mais interesse|nao tenho interesse|desisti|vou deixar pra (depois|outra hora|ano que vem)|nao vou (fazer|comprar|fechar)|achei (muito )?caro|ficou (muito )?caro|fora do (meu )?orcamento|nao cabe no (meu )?orcamento)\b/;

function quemBate(regra: Regra, fromMe: boolean) {
  return regra.quem === "qualquer" || (regra.quem === "vendedor" ? fromMe : !fromMe);
}

export function detectarEtapa(msgs: MsgLike[]): Deteccao {
  const evidencias: Evidencia[] = [];
  let comercial = false;
  let sinalPerda: string | null = null;
  let temProposta = false;

  for (const m of msgs) {
    const t = normalizar(`${m.text ?? ""} ${m.fileName ?? ""}`).trim();

    if (!m.fromMe && RE_COMERCIAL.test(t)) comercial = true;
    if (!m.fromMe && RE_PERDA.test(t)) sinalPerda = m.text;

    // Arquivos enviados pelo vendedor também contam.
    if (m.fromMe && m.type === "document") {
      const nome = normalizar(m.fileName ?? "");
      if (/catalogo|portfolio|apresentacao/.test(nome)) {
        evidencias.push({ etapa: "Apresentação", texto: `Enviou ${m.fileName}`, msgId: m.id });
      } else {
        evidencias.push({ etapa: "Proposta", texto: `Enviou o documento ${m.fileName ?? ""}`.trim(), msgId: m.id });
        temProposta = true;
      }
    }
    if (m.fromMe && (m.type === "image" || m.type === "video")) {
      evidencias.push({ etapa: "Apresentação", texto: m.type === "image" ? "Enviou fotos de produto" : "Enviou vídeo de produto", msgId: m.id });
    }

    if (!t) continue;
    for (const regra of REGRAS) {
      if (!quemBate(regra, m.fromMe) || !regra.re.test(t)) continue;
      // Negociação só vale depois que já houve proposta/valor na conversa.
      if (regra.etapa === "Negociação" && !temProposta) continue;
      if (regra.etapa === "Proposta") temProposta = true;
      evidencias.push({ etapa: regra.etapa, texto: m.text.slice(0, 160), msgId: m.id });
      break;
    }
  }

  let etapa: Etapa | null = null;
  for (const e of evidencias) {
    if (!etapa || ORDEM_ETAPA[e.etapa] > ORDEM_ETAPA[etapa]) etapa = e.etapa;
  }
  if (etapa) comercial = true;
  if (!etapa && comercial) etapa = "Prospecção";

  return { comercial, etapa, evidencias, sinalPerda };
}

export function formatarDuracao(ms: number) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? "s" : ""}`;
}

/** Alertas de atendimento: cliente esperando resposta e follow-up pendente. */
export function calcularAlertas(msgs: MsgLike[], agora = Date.now()): Alerta[] {
  const alertas: Alerta[] = [];
  const ultima = msgs[msgs.length - 1];
  if (!ultima) return alertas;
  const decorrido = agora - ultima.timestamp;
  const SETE_DIAS = 7 * 24 * 3600e3;

  if (!ultima.fromMe) {
    // Início do bloco de mensagens do cliente ainda sem resposta.
    let desde = ultima.timestamp;
    for (let i = msgs.length - 1; i >= 0 && !msgs[i].fromMe; i--) desde = msgs[i].timestamp;
    const espera = agora - desde;
    if (espera >= 5 * 60e3 && espera <= SETE_DIAS) {
      alertas.push({
        tipo: "sem_resposta",
        nivel: espera >= 60 * 60e3 ? "critico" : espera >= 15 * 60e3 ? "alto" : "medio",
        texto: `Cliente aguardando resposta há ${formatarDuracao(espera)}`,
        desde,
      });
    }
  } else if (decorrido >= 24 * 3600e3 && decorrido <= 30 * 24 * 3600e3) {
    alertas.push({
      tipo: "follow_up",
      nivel: decorrido >= 72 * 3600e3 ? "alto" : "medio",
      texto: `Sem retorno do cliente há ${formatarDuracao(decorrido)} — hora do follow-up`,
      desde: ultima.timestamp,
    });
  }
  return alertas;
}

export const PROBABILIDADE_POR_ETAPA: Record<Etapa, "Baixa" | "Média" | "Alta"> = {
  Prospecção: "Baixa",
  Apresentação: "Baixa",
  Proposta: "Média",
  Negociação: "Alta",
  Fechados: "Alta",
  Perdidos: "Baixa",
};
