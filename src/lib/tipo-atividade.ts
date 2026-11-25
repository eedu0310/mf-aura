/**
 * Os nomes de tipo que o banco aceita, num lugar só.
 *
 * ATIVIDADES — o código usa "Email" (TipoAtividade), mas a tela de registrar
 * atividade gravava o RÓTULO do botão, "E-mail". Resultado: no banco havia
 * "E-mail" e nenhum "Email", e todo filtro, contagem e cor por tipo tratava
 * aquela atividade como um tipo desconhecido. Lendo, os dois viram o mesmo
 * tipo; gravando, sai sempre o nome do código.
 *
 * COMPROMISSOS — o banco tem uma trava (CHECK) que só aceita Visita, Reunião,
 * Follow-up, Ligação e Outro. A AURA aceitava qualquer texto no tipo ("call",
 * "visita técnica", "apresentação") e o insert falhava: o vendedor pedia o
 * compromisso e ele não era criado. Agora o texto livre é traduzido para um
 * dos cinco, e o que não se reconhece vira "Outro".
 */
import type { TipoAtividade } from "@/lib/types";

/** Tira acento, hífen, espaço e caixa: "E-mail" e "email" viram "email". */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const TIPOS_ATIVIDADE: TipoAtividade[] = [
  "Ligação",
  "Email",
  "Visita",
  "Reunião",
  "Follow-up",
  "WhatsApp",
  "Orçamento",
  "Venda",
  "Prospecção",
  "Pós-venda",
  "Treinamento",
  "Outro",
];

const ATIVIDADE_POR_CHAVE = new Map<string, TipoAtividade>(
  TIPOS_ATIVIDADE.map((t) => [chave(t), t]),
);

/**
 * O tipo da atividade no nome do código. "E-mail", "email", "EMAIL" → "Email".
 * Tipo que não está na lista volta como veio (aparado): não inventamos um tipo
 * para o que o vendedor escreveu.
 */
export function normalizarTipoAtividade(tipo: string | null | undefined): TipoAtividade {
  const bruto = String(tipo ?? "").trim();
  if (!bruto) return "Outro";
  return ATIVIDADE_POR_CHAVE.get(chave(bruto)) ?? (bruto as TipoAtividade);
}

export const TIPOS_COMPROMISSO = ["Visita", "Reunião", "Follow-up", "Ligação", "Outro"] as const;
export type TipoCompromisso = (typeof TIPOS_COMPROMISSO)[number];

/** Palavras que a IA (ou o vendedor) costuma usar para cada tipo da agenda. */
const COMPROMISSO_POR_PALAVRA: [RegExp, TipoCompromisso][] = [
  [/visita|instalac|medic|vistoria|obra/, "Visita"],
  [/reuniao|apresentac|meeting|encontro|videochamada|call/, "Reunião"],
  [/followup|retorno|acompanhamento|cobrar/, "Follow-up"],
  [/ligac|ligar|telefon|chamada/, "Ligação"],
];

/** O tipo do compromisso dentro dos cinco que o banco aceita (padrão "Outro"). */
export function normalizarTipoCompromisso(tipo: string | null | undefined): TipoCompromisso {
  const k = chave(String(tipo ?? ""));
  if (!k) return "Outro";
  const exato = TIPOS_COMPROMISSO.find((t) => chave(t) === k);
  if (exato) return exato;
  for (const [padrao, valor] of COMPROMISSO_POR_PALAVRA) {
    if (padrao.test(k)) return valor;
  }
  return "Outro";
}
