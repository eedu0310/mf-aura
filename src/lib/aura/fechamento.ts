/**
 * O que a AURA faz quando um negócio é decidido.
 *
 * O vendedor marca Fechado ou Perdido (a decisão é dele, nunca da IA) e este
 * módulo faz UMA chamada de IA que serve a dois propósitos de uma vez:
 *
 *   1. escreve o feedback para o vendedor — o que ele acertou na jornada e
 *      onde errou, à luz do manual de vendas e dos materiais da loja;
 *   2. colhe o aprendizado daquela conversa — a objeção que apareceu e a
 *      resposta que destravou (ou que não destravou) o negócio.
 *
 * Por que na mesma chamada: a conversa já está em mão neste instante e o
 * resultado já é conhecido. Juntar as duas tarefas custa uma chamada em vez de
 * duas, e o aprendizado nasce com o rótulo que importa — fechou ou não fechou.
 *
 * Por que aqui e não numa rotina noturna: as mensagens do WhatsApp não vão para
 * o banco. Elas vivem nos arquivos de sessão do Baileys e na memória do
 * processo. Uma rotina que varresse o Supabase de madrugada não encontraria
 * nada para aprender.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { modeloDeRaciocinio } from "./modelos";
import { registrarUsoIA } from "./custo-ia";
import { guardarAprendizado, type TipoAprendizado } from "./aprendizado";

export type Resultado = "fechado" | "perdido";

export interface Fala {
  deMim: boolean;
  texto: string;
  em?: string;
}

export interface Laudo {
  resumo: string;
  acertos: string[];
  erros: string[];
  etapasPuladas: string[];
  pontoFraco: string | null;
  aprendizados: {
    tipo: TipoAprendizado;
    gatilho: string;
    resposta: string;
  }[];
}

/** Mesma leitura de chave do supervisor, para não haver dois jeitos de achar
 *  a credencial e um deles ficar desatualizado. */
function clienteIA(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  return key ? new Anthropic({ apiKey: key }) : null;
}

const PONTOS_FRACOS = [
  "abordagem",
  "comunicacao",
  "qualificacao",
  "preco",
  "prazo",
  "produto",
  "follow-up",
  "concorrencia",
  "nenhum",
] as const;

const FERRAMENTA = {
  name: "laudo",
  description:
    "Entrega a análise do fechamento ou da perda, mais o que dá para aprender da conversa.",
  input_schema: {
    type: "object" as const,
    properties: {
      resumo: {
        type: "string",
        description:
          "2 a 4 frases faladas DIRETAMENTE ao vendedor, em segunda pessoa. Num negócio fechado, reconheça o que ele fez bem antes de sugerir. Numa perda, seja direto sobre o que faltou sem humilhar — a pessoa vai ler isto.",
      },
      acertos: {
        type: "array",
        items: { type: "string" },
        description:
          "Até 3 coisas que o vendedor fez bem, citando o que ele escreveu. Mesmo numa perda existe acerto; procure.",
      },
      erros: {
        type: "array",
        items: { type: "string" },
        description:
          "Até 3 falhas concretas, cada uma amarrada a uma regra do manual e ao trecho da conversa. Se não houver falha clara, devolva lista vazia em vez de inventar.",
      },
      etapas_puladas: {
        type: "array",
        items: { type: "string" },
        description:
          "Etapas do funil que o negócio nunca visitou de verdade (ex.: foi de Prospecção direto a preço, sem Apresentação). Lista vazia se seguiu o funil.",
      },
      ponto_fraco: {
        type: "string",
        enum: [...PONTOS_FRACOS],
        description:
          "Onde mais doeu, em uma palavra, para o gestor agrupar a falha recorrente da pessoa. 'nenhum' quando foi bem conduzido.",
      },
      aprendizados: {
        type: "array",
        description:
          "O que esta conversa ensina para as próximas. Só inclua o que for REUTILIZÁVEL com outros clientes — nada específico deste negócio (nome, endereço, medida exata). Lista vazia é resposta válida e preferível a encher de obviedade.",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["objecao", "pergunta", "abordagem"] },
            gatilho: {
              type: "string",
              description: "O que o cliente disse ou perguntou, em poucas palavras.",
            },
            resposta: {
              type: "string",
              description:
                "Num negócio fechado: a resposta que funcionou. Numa perda: o que deveria ter sido respondido, segundo o manual.",
            },
          },
          required: ["tipo", "gatilho", "resposta"],
        },
      },
    },
    required: ["resumo", "acertos", "erros", "etapas_puladas", "ponto_fraco", "aprendizados"],
  },
};

function transcricao(falas: Fala[], cliente: string): string {
  return falas
    .slice(-60) // conversa longa: o fim é o que decidiu o negócio
    .map((f) => `${f.deMim ? "VENDEDOR" : cliente.toUpperCase()}: ${f.texto}`)
    .join("\n");
}

/**
 * Gera o laudo. Devolve null quando não há IA configurada ou a chamada falha —
 * nunca lança, porque isto roda logo depois de o vendedor marcar o fechamento e
 * uma falha aqui não pode impedir a venda de ser registrada.
 */
export async function analisarFechamento(opts: {
  resultado: Resultado;
  cliente: string;
  valor: number | null;
  etapasVisitadas: string[];
  motivoInformado?: string | null;
  manual: string;
  aprendizado: string;
  falas: Fala[];
  userId?: string;
  empresa?: string;
}): Promise<Laudo | null> {
  const client = clienteIA();
  if (!client) return null;

  const fechou = opts.resultado === "fechado";

  const system = `Você é o Supervisor AURA, um gerente comercial experiente de uma empresa de lareiras, churrasqueiras e aquecimento. Um negócio acabou de ser ${fechou ? "FECHADO" : "PERDIDO"} e você vai escrever o retorno para o vendedor.

COMO ESCREVER
- Fale com o vendedor, não sobre ele. Segunda pessoa.
- Toda crítica tem de vir amarrada a DUAS coisas: uma regra do manual e um trecho do que de fato aconteceu na conversa. Sem isso, não é crítica, é opinião — e não serve.
- ${fechou
      ? "Num negócio fechado, comece reconhecendo o que ele fez bem. Depois, se houver, aponte o que deixaria o próximo melhor. Não transforme um elogio em sermão."
      : "Numa perda, seja direto sobre o que faltou, sem humilhar. A pessoa vai ler isto e precisa sair com o que fazer diferente, não com vergonha."}
- Se a conversa não dá base para afirmar algo, diga que não dá. Inventar falha para preencher lista é pior que lista vazia.
- Não repita o manual de cor: aplique ao caso.

O FUNIL DA CASA, em ordem: Prospecção, Apresentação, Proposta, Negociação, Fechados/Perdidos. Pular etapa é falha de processo mesmo quando o negócio fecha — quem vai direto ao preço sem apresentar ganha menos margem.

MANUAL DE VENDAS E MATERIAIS DA LOJA (a regra da casa):
${opts.manual || "(nenhum material cadastrado — use boas práticas de venda consultiva)"}
${opts.aprendizado ? `\nO QUE JÁ APRENDEMOS EM CONVERSAS ANTERIORES (revisado pelo gestor):\n${opts.aprendizado}` : ""}`;

  const user = `Resultado: ${fechou ? "FECHADO" : "PERDIDO"}
Cliente: ${opts.cliente}
Valor: ${opts.valor != null ? `R$ ${opts.valor.toLocaleString("pt-BR")}` : "não informado"}
Etapas que este negócio realmente visitou: ${opts.etapasVisitadas.join(" → ") || "não registrado"}
${opts.motivoInformado ? `Motivo que o vendedor informou: ${opts.motivoInformado}` : ""}

CONVERSA (mais recentes por último):
${transcricao(opts.falas, opts.cliente) || "(não há conversa de WhatsApp registrada para este negócio)"}`;

  try {
    const resp = await client.messages.create({
      // Raciocínio, não volume: isto roda uma vez por negócio decidido, e é o
      // texto que a pessoa vai ler sobre o próprio trabalho. Economizar modelo
      // aqui sai caro em qualidade de julgamento.
      model: modeloDeRaciocinio(),
      max_tokens: 2000,
      // Mesmo motivo do supervisor: o manual e o aprendizado são idênticos em
      // todo fechamento da mesma loja. Só o que vem depois, no user, muda.
      system: [
        {
          type: "text" as const,
          text: system,
          cache_control: { type: "ephemeral" as const, ttl: "1h" as const },
        },
      ],
      messages: [{ role: "user", content: user }],
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: "laudo" },
    });

    void registrarUsoIA({
      funcao: "aura/fechamento",
      modelo: modeloDeRaciocinio(),
      uso: resp.usage,
      usuarioId: opts.userId ?? null,
      empresa: opts.empresa ?? null,
    });

    const bloco = resp.content?.find((c: { type: string }) => c.type === "tool_use") as
      | { input?: Record<string, unknown> }
      | undefined;
    const d = bloco?.input;
    if (!d) return null;

    const lista = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 3) : [];

    const fraco = typeof d.ponto_fraco === "string" ? d.ponto_fraco : null;

    return {
      resumo: typeof d.resumo === "string" ? d.resumo : "",
      acertos: lista(d.acertos),
      erros: lista(d.erros),
      etapasPuladas: Array.isArray(d.etapas_puladas)
        ? (d.etapas_puladas as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      pontoFraco: fraco && fraco !== "nenhum" ? fraco : null,
      aprendizados: Array.isArray(d.aprendizados)
        ? (d.aprendizados as Record<string, unknown>[])
            .filter(
              (a) =>
                typeof a?.gatilho === "string" &&
                typeof a?.resposta === "string" &&
                typeof a?.tipo === "string",
            )
            .slice(0, 5)
            .map((a) => ({
              tipo: a.tipo as TipoAprendizado,
              gatilho: a.gatilho as string,
              resposta: a.resposta as string,
            }))
        : [],
    };
  } catch (e) {
    console.error("[aura/fechamento]", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Grava o laudo, guarda o aprendizado e avisa quem precisa saber.
 * O aprendizado entra como "sugerido": vira conhecimento da casa só depois que
 * o gestor aprovar, para a AURA não passar a repetir um erro que ela mesma
 * tirou de uma conversa ruim.
 */
export async function registrarLaudo(
  sb: SupabaseClient,
  dados: {
    laudo: Laudo;
    empresa: string;
    vendedorId: string;
    vendedorNome: string;
    oportunidadeId: string | null;
    relacionamentoId: string | null;
    cliente: string;
    resultado: Resultado;
    valor: number | null;
    motivoInformado?: string | null;
    gestores: string[];
  },
): Promise<void> {
  const { laudo: l } = dados;
  const fechou = dados.resultado === "fechado";

  const { error } = await sb.from("aura_feedback_fechamento").insert({
    empresa: dados.empresa,
    vendedor_id: dados.vendedorId,
    oportunidade_id: dados.oportunidadeId,
    relacionamento_id: dados.relacionamentoId,
    cliente: dados.cliente,
    resultado: dados.resultado,
    valor: dados.valor,
    resumo: l.resumo,
    acertos: l.acertos,
    erros: l.erros,
    etapas_puladas: l.etapasPuladas,
    ponto_fraco: l.pontoFraco,
    motivo_informado: dados.motivoInformado ?? null,
  });
  if (error) console.error("[aura/fechamento] gravar laudo:", error.message);

  // Aprendizado da conversa, um a um, para um item ruim não derrubar os outros.
  for (const a of l.aprendizados) {
    try {
      await guardarAprendizado(sb, {
        empresa: dados.empresa,
        canal: "whatsapp",
        tipo: a.tipo,
        gatilho: a.gatilho,
        resposta: a.resposta,
        fechou,
        fonte: dados.oportunidadeId ?? undefined,
      });
    } catch (e) {
      console.error("[aura/fechamento] guardar aprendizado:", e);
    }
  }

  const valorTexto =
    dados.valor != null ? ` (R$ ${dados.valor.toLocaleString("pt-BR")})` : "";

  // Para o vendedor: o retorno sobre o próprio trabalho.
  const avisos: Record<string, string>[] = [
    {
      vendedor_id: dados.vendedorId,
      titulo: fechou
        ? `Venda fechada: ${dados.cliente}`
        : `Negócio perdido: ${dados.cliente}`,
      mensagem: l.resumo.slice(0, 400),
      tipo: "fechamento",
      acao_url: "/meu-dia",
    },
  ];

  // Para o gestor: aviso de cada fechamento, com o ponto fraco já destacado,
  // que é o que ele usa para conversar com a pessoa.
  for (const g of dados.gestores) {
    if (g === dados.vendedorId) continue; // não avisa duas vezes quem já recebeu
    avisos.push({
      vendedor_id: g,
      titulo: `${fechou ? "Fechou" : "Perdeu"}: ${dados.vendedorNome} · ${dados.cliente}${valorTexto}`,
      mensagem:
        (l.pontoFraco ? `Ponto fraco: ${l.pontoFraco}. ` : "") + l.resumo.slice(0, 300),
      tipo: "fechamento",
      acao_url: "/gestor",
    });
  }

  const { error: eAviso } = await sb.from("notificacoes").insert(avisos);
  if (eAviso) console.error("[aura/fechamento] avisos:", eAviso.message);
}
