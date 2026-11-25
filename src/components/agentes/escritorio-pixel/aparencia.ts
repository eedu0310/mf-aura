/**
 * A cara de cada agente no escritório em pixel — só contas (testável sem tela).
 *
 *   aparenciaDoAgente ... pele, cabelo, camisa e penteado tirados do id do
 *                         agente por um hash: o mesmo agente tem sempre a
 *                         mesma cara (a tela atualiza a cada 20 s e ninguém
 *                         pode trocar de roupa no meio). A Diretora tem roupa
 *                         própria (blazer escuro) e coroa;
 *   apelido ............. o nome curto do crachá ("Analista de Follow-up" →
 *                         "Follow-up"); o nome inteiro aparece ao passar o mouse;
 *   balaoDoAgente ....... o balão de fala: "…" enquanto trabalha, ou 1–3
 *                         palavras se ele falou no escritório nos últimos 30 min.
 */
import type { EstadoMesa, FalaEscritorio } from "@/lib/agentes/tipos";

export type Penteado = "curto" | "longo" | "coque" | "raspado" | "rabo";

export interface Aparencia {
  pele: string;
  peleSombra: string;
  cabelo: string;
  camisa: string;
  camisaSombra: string;
  penteado: Penteado;
  oculos: boolean;
  chefe: boolean;
}

export const PELES = ["#f3d4b6", "#e9bb92", "#d29a6c", "#a8714b", "#7a5036"] as const;
export const CABELOS = ["#2b1d14", "#4a3020", "#7a4b2a", "#c2913f", "#1d1f26", "#9a9a9a", "#a3472f"] as const;
export const CAMISAS = ["#3f6f8f", "#4f8a6a", "#b5574b", "#7b5ea7", "#d08a3a", "#2f7f86", "#5b6b7a", "#a64d79", "#6c8f3a"] as const;
const PENTEADOS: Penteado[] = ["curto", "longo", "coque", "raspado", "rabo"];

/** Roupa da Diretora: blazer azul-marinho (o dourado fica na coroa e no broche). */
export const BLAZER_DIRETORA = "#1f2b47";

/** FNV-1a de 32 bits: rápido, estável entre navegadores e sem dependência. */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Escurece uma cor "#rrggbb" (fator 0–1 do quanto sobra de luz). */
export function escurecer(hex: string, fator = 0.78): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => Math.max(0, Math.min(255, Math.round(v * fator)));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function aparenciaDoAgente(id: string, opcoes: { chefe?: boolean } = {}): Aparencia {
  const h = hashTexto(id || "agente");
  // Cada traço lê um pedaço diferente do hash (senão pele e camisa andariam juntas).
  const pele = PELES[h % PELES.length];
  const cabelo = CABELOS[(h >>> 5) % CABELOS.length];
  const chefe = Boolean(opcoes.chefe);
  const camisa = chefe ? BLAZER_DIRETORA : CAMISAS[(h >>> 10) % CAMISAS.length];
  const penteado: Penteado = chefe ? "longo" : PENTEADOS[(h >>> 15) % PENTEADOS.length];
  return {
    pele,
    peleSombra: escurecer(pele, 0.86),
    cabelo,
    camisa,
    camisaSombra: escurecer(camisa, 0.72),
    penteado,
    oculos: !chefe && ((h >>> 20) & 7) === 0,
    chefe,
  };
}

/* ---------------------------------------------------------------- crachá */

/** Cargo genérico no começo do nome: sai do crachá (fica "Follow-up", "Leads"…). */
const CARGO_NO_NOME =
  /^(analista|agente|guardi[aã]o|coordenador[a]?|auditor[a]?|redator[a]?|revisor[a]?|ouvinte|secret[aá]ria|assistente|vigia|ca[cç]ador[a]?|lembrete|cobran[cç]a|aura)\s+((d[aeo]s?|do|da)\s+)?/i;

export const LIMITE_APELIDO = 12;

export function apelido(nome: string, limite = LIMITE_APELIDO): string {
  const limpo = (nome ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) return "Agente";
  const semCargo = limpo.replace(CARGO_NO_NOME, "");
  let curto = semCargo.length >= 3 ? semCargo : limpo;
  // Ainda comprido ("Briefing do dia", "Backup noturno"): fica a primeira palavra.
  if (curto.length > limite) {
    const primeira = curto.split(" ")[0];
    if (primeira.length >= 4) curto = primeira;
  }
  curto = curto.charAt(0).toUpperCase() + curto.slice(1);
  return curto.length > limite ? `${curto.slice(0, limite - 1).trimEnd()}…` : curto;
}

/* ----------------------------------------------------------------- balão */

export const JANELA_FALA_MS = 30 * 60_000;

const BALAO_DO_TIPO: Record<FalaEscritorio["tipo"], string> = {
  plano: "Plano do dia!",
  pedido: "Um pedido…",
  resposta: "Respondi!",
  ideia: "Tive uma ideia",
  alerta: "Atenção!",
  aprendizado: "Aprendi algo",
  relato: "Relatório",
};

export type Balao = { tipo: "digitando" } | { tipo: "fala"; texto: string; falaTipo: FalaEscritorio["tipo"] };

/**
 * O balão em cima do agente: "…" (animado) enquanto trabalha; senão, se ele
 * falou no escritório nos últimos 30 minutos, 1–3 palavras do tipo da fala.
 * Desligado e aguardando ativação não falam.
 */
export function balaoDoAgente(
  mesa: { id: string; estado: EstadoMesa },
  falas: Array<Pick<FalaEscritorio, "de" | "tipo" | "criadoEm">>,
  agora: number = Date.now(),
): Balao | null {
  if (mesa.estado === "desligado" || mesa.estado === "aguardando_ativacao") return null;
  if (mesa.estado === "trabalhando") return { tipo: "digitando" };
  let maisNova: Pick<FalaEscritorio, "de" | "tipo" | "criadoEm"> | null = null;
  let quando = 0;
  for (const f of falas) {
    if (f.de !== mesa.id) continue;
    const t = new Date(f.criadoEm).getTime();
    if (!Number.isFinite(t) || agora - t > JANELA_FALA_MS || t - agora > 5 * 60_000) continue;
    if (t > quando) {
      quando = t;
      maisNova = f;
    }
  }
  if (!maisNova) return null;
  return { tipo: "fala", texto: BALAO_DO_TIPO[maisNova.tipo] ?? "Falei!", falaTipo: maisNova.tipo };
}
