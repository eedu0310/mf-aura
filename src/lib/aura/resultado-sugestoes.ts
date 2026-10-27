/**
 * O que aconteceu com cada sugestão de resposta da AURA.
 *
 * A AURA sugere uma resposta em cada conversa do WhatsApp e, até aqui, nunca
 * sabia o destino dela. Agora, quando o vendedor manda a próxima mensagem,
 * comparamos com a sugestão (usou como estava, adaptou ou ignorou) e, quando
 * o cliente responde, marcamos que respondeu. A rodada da noite lê isto para
 * aprender quais sugestões funcionam — e o que o vendedor escreve no lugar
 * dela quando não usa, que muitas vezes é o melhor professor.
 *
 * "Respondeu" é um sinal modesto e de propósito: não quer dizer que a venda
 * andou, quer dizer que a conversa não morreu ali. O resultado do negócio
 * entra por outro caminho (aura_aprendizado_origem).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsoDaSugestao = "usou" | "adaptou" | "ignorou" | "automatica";

/** Janela em que a resposta do cliente ainda conta como resposta àquela mensagem. */
const JANELA_RESPOSTA_MS = 48 * 60 * 60 * 1000;
/** Sem resposta depois disto, a mensagem conta como "cliente sumiu". */
export const SUMIU_DEPOIS_MS = 24 * 60 * 60 * 1000;

function palavras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 1);
}

/** Parecença entre dois textos, de 0 a 1 (coeficiente de Dice sobre as palavras). */
export function similaridade(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.length || !pb.length) return 0;
  const conta = new Map<string, number>();
  for (const p of pa) conta.set(p, (conta.get(p) ?? 0) + 1);
  let comuns = 0;
  for (const p of pb) {
    const n = conta.get(p) ?? 0;
    if (n > 0) {
      comuns++;
      conta.set(p, n - 1);
    }
  }
  return (2 * comuns) / (pa.length + pb.length);
}

export function classificarUso(sim: number): Exclude<UsoDaSugestao, "automatica"> {
  if (sim >= 0.85) return "usou";
  if (sim >= 0.35) return "adaptou";
  return "ignorou";
}

export async function registrarEnvio(
  sb: SupabaseClient,
  dados: {
    empresa: string;
    ownerId: string;
    chatJid: string;
    sugestao: string;
    enviado: string;
    automatica?: boolean;
  },
): Promise<void> {
  const sim = similaridade(dados.sugestao, dados.enviado);
  const { error } = await sb.from("aura_sugestoes_resultado").insert({
    empresa: dados.empresa,
    owner_id: dados.ownerId,
    chat_jid: dados.chatJid,
    sugestao: dados.sugestao.slice(0, 2000),
    enviado: dados.enviado.slice(0, 2000),
    similaridade: Math.round(sim * 100) / 100,
    uso: dados.automatica ? "automatica" : classificarUso(sim),
  });
  if (error) console.error("[sugestoes] registrar envio:", error.message);
}

/** O cliente escreveu: fecha a última mensagem nossa ainda sem resposta naquela conversa. */
export async function registrarRespostaDoCliente(
  sb: SupabaseClient,
  ownerId: string,
  chatJid: string,
  texto: string,
): Promise<void> {
  const desde = new Date(Date.now() - JANELA_RESPOSTA_MS).toISOString();
  const { error } = await sb
    .from("aura_sugestoes_resultado")
    .update({
      cliente_respondeu: true,
      resposta_cliente: texto.slice(0, 500) || null,
      respondeu_em: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("chat_jid", chatJid)
    .is("cliente_respondeu", null)
    .gte("enviado_em", desde);
  if (error) console.error("[sugestoes] resposta do cliente:", error.message);
}

interface LinhaDeSugestao {
  sugestao: string;
  enviado: string | null;
  uso: UsoDaSugestao;
  enviado_em: string;
  cliente_respondeu: boolean | null;
  resposta_cliente: string | null;
}

function resultado(l: LinhaDeSugestao, agora: number): "respondeu" | "sumiu" | "aguardando" {
  if (l.cliente_respondeu) return "respondeu";
  return agora - new Date(l.enviado_em).getTime() >= SUMIU_DEPOIS_MS ? "sumiu" : "aguardando";
}

export interface ResumoDasSugestoes {
  dias: number;
  total: number;
  usou: number;
  adaptou: number;
  ignorou: number;
  automatica: number;
  /** % do cliente responder, entre as já decididas (respondeu ou sumiu), por uso. */
  respondeuQuandoUsou: number | null;
  respondeuQuandoIgnorou: number | null;
}

/** Números para o gestor: quanto a equipe usa a AURA e se funciona. */
export async function resumoDasSugestoes(
  sb: SupabaseClient,
  empresa: string,
  dias = 7,
): Promise<ResumoDasSugestoes> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("aura_sugestoes_resultado")
    .select("sugestao, enviado, uso, enviado_em, cliente_respondeu, resposta_cliente")
    .eq("empresa", empresa)
    .gte("enviado_em", desde)
    .limit(5000);
  const linhas = (data ?? []) as LinhaDeSugestao[];
  const agora = Date.now();
  const taxa = (filtro: (l: LinhaDeSugestao) => boolean): number | null => {
    const decididas = linhas.filter((l) => filtro(l) && resultado(l, agora) !== "aguardando");
    if (decididas.length < 5) return null; // pouco caso para virar porcentagem
    return Math.round((decididas.filter((l) => l.cliente_respondeu).length / decididas.length) * 100);
  };
  return {
    dias,
    total: linhas.length,
    usou: linhas.filter((l) => l.uso === "usou").length,
    adaptou: linhas.filter((l) => l.uso === "adaptou").length,
    ignorou: linhas.filter((l) => l.uso === "ignorou").length,
    automatica: linhas.filter((l) => l.uso === "automatica").length,
    respondeuQuandoUsou: taxa((l) => l.uso === "usou" || l.uso === "adaptou"),
    respondeuQuandoIgnorou: taxa((l) => l.uso === "ignorou"),
  };
}

/**
 * Casos das últimas horas para a rodada da noite estudar: metade em que o
 * cliente respondeu, metade em que sumiu. Os "ignorou" vão junto porque o
 * texto que o vendedor escreveu no lugar é exatamente o que a AURA precisa
 * ver para melhorar a próxima sugestão.
 */
export async function casosDeSugestoes(
  sb: SupabaseClient,
  empresa: string,
  desdeIso: string,
  limite = 16,
): Promise<string> {
  const { data } = await sb
    .from("aura_sugestoes_resultado")
    .select("sugestao, enviado, uso, enviado_em, cliente_respondeu, resposta_cliente")
    .eq("empresa", empresa)
    .gte("enviado_em", desdeIso)
    .order("enviado_em", { ascending: false })
    .limit(400);
  const agora = Date.now();
  const linhas = ((data ?? []) as LinhaDeSugestao[]).filter((l) => resultado(l, agora) !== "aguardando");
  const deuCerto = linhas.filter((l) => l.cliente_respondeu).slice(0, Math.ceil(limite / 2));
  const sumiu = linhas.filter((l) => !l.cliente_respondeu).slice(0, Math.floor(limite / 2));
  const corta = (t: string | null, n = 300) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const ROTULO: Record<UsoDaSugestao, string> = {
    usou: "o vendedor mandou como a AURA sugeriu",
    adaptou: "o vendedor adaptou a sugestão",
    ignorou: "o vendedor ignorou a sugestão e escreveu outra coisa",
    automatica: "resposta automática da AURA",
  };
  return [...deuCerto, ...sumiu]
    .map((l, i) => {
      const fim = l.cliente_respondeu ? `CLIENTE RESPONDEU: "${corta(l.resposta_cliente, 200)}"` : "CLIENTE NÃO RESPONDEU EM 24 h";
      const enviado = l.uso === "usou" || l.uso === "automatica" ? "" : `\n  Enviado: "${corta(l.enviado)}"`;
      return `Caso ${i + 1} (${ROTULO[l.uso]})\n  Sugestão da AURA: "${corta(l.sugestao)}"${enviado}\n  ${fim}`;
    })
    .join("\n");
}
