/**
 * AURA no Claude: transforma as métricas exatas em recados curtos e práticos.
 * - Cache de 30 min por usuário+tela (economiza créditos da API).
 * - Se a IA falhar ou não houver chave, devolve os recados automáticos.
 */
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { Insight } from "./metricas";

export interface RespostaAura {
  manchete: string;
  foco: string;
  insights: Insight[];
  fonte: "ia" | "regras";
  geradoEm: string;
}

const CACHE_MS = 30 * 60 * 1000;
const g = globalThis as unknown as {
  __auraCache?: Map<string, { at: number; valor: RespostaAura }>;
  __auraChaveInvalida?: string;
};
const cache = (g.__auraCache ??= new Map());

function chave() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
}

export function iaDisponivel() {
  const k = chave();
  return !!k && g.__auraChaveInvalida !== k;
}

let cliente: Anthropic | null = null;
let clienteChave = "";
function ai() {
  const k = chave();
  if (!k || g.__auraChaveInvalida === k) return null;
  if (!cliente || clienteChave !== k) {
    cliente = new Anthropic({ apiKey: k });
    clienteChave = k;
  }
  return cliente;
}

function manual(): string {
  try {
    const dir = path.join(process.cwd(), "manual-treinamento");
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n\n")
      .slice(0, 12_000);
  } catch {
    return "";
  }
}

const TELAS: Record<string, string> = {
  "meu-dia": "Meu Dia — o que o vendedor precisa fazer HOJE",
  agenda: "Agenda — compromissos e contatos programados",
  relacionamentos: "Relacionamentos — carteira de clientes",
  pipeline: "Pipeline — negócios em andamento por etapa",
  vendas: "Vendas — resultado do mês e meta",
  atividades: "Atividades — ligações, visitas, WhatsApp, orçamentos",
  relatorio: "Relatório — desempenho do período",
  ranking: "Ranking — posição entre os vendedores da loja",
  whatsapp: "WhatsApp — atendimento aos clientes",
  gestor: "Visão do Gestor — equipe e lojas",
};

const FERRAMENTA_RECADOS = {
  name: "recados",
  description: "Entrega os recados da AURA para a tela.",
  input_schema: {
    type: "object" as const,
    properties: {
      manchete: { type: "string", description: "Até 8 palavras." },
      foco: { type: "string", description: "Uma frase curta com a ação nº 1." },
      insights: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["alerta", "oportunidade", "dica", "conquista"] },
            titulo: { type: "string", description: "Até 9 palavras." },
            detalhe: { type: "string", description: "Até 18 palavras, com nome/valor/número." },
            acao: {
              type: "object",
              properties: { label: { type: "string" }, href: { type: "string" } },
              required: ["label", "href"],
            },
          },
          required: ["tipo", "titulo"],
        },
      },
    },
    required: ["manchete", "foco", "insights"],
  },
};

export function limparCache(prefixo?: string) {
  for (const k of cache.keys()) if (!prefixo || k.startsWith(prefixo)) cache.delete(k);
}

export async function gerarRecados(opts: {
  cacheKey: string;
  pagina: string;
  pessoa: { nome: string; cargo: string; loja: string };
  metricas: unknown;
  recadosBase: Insight[];
  /** Manuais e playbooks enviados pelo gestor (biblioteca da AURA). */
  materiais?: string;
  forcar?: boolean;
}): Promise<RespostaAura> {
  const hit = cache.get(opts.cacheKey);
  if (!opts.forcar && hit && Date.now() - hit.at < CACHE_MS) return hit.valor;

  const regras: RespostaAura = {
    manchete: opts.recadosBase[0]?.titulo ?? "Tudo em dia",
    foco: opts.recadosBase[0]?.detalhe ?? "Continue assim.",
    insights: opts.recadosBase,
    fonte: "regras",
    geradoEm: new Date().toISOString(),
  };

  const client = ai();
  if (!client) return regras;

  const gestor = opts.pessoa.cargo === "Gestor" || opts.pessoa.cargo === "Diretor";
  const system = `Você é a AURA, supervisora comercial com IA do CRM de uma empresa de lareiras, churrasqueiras e aquecimento (lojas LF Lareiras e MF International). Você acompanha ${gestor ? "a equipe inteira para o gestor" : "o vendedor"} em tempo real.

REGRAS DE ESCRITA (muito importante — vendedor não lê texto longo):
- Português do Brasil, direto, tom de líder parceiro. Sem enrolação, sem "olá".
- "manchete": no máximo 8 palavras, o ponto mais importante AGORA.
- "foco": UMA frase curta com a ação número 1.
- "insights": de 2 a 4 itens. "titulo" com no máximo 9 palavras; "detalhe" com no máximo 18 palavras e sempre com nome de cliente/valor/número quando houver.
- Use SOMENTE os números e nomes das MÉTRICAS. Nunca invente cliente, valor ou prazo.
- Cada insight é: "alerta" (risco de perder), "oportunidade" (dinheiro a ganhar), "dica" (como fazer melhor, baseada no manual) ou "conquista" (algo bom para comemorar).
- Quando fizer sentido, inclua "acao" com um destes links: /meu-dia, /agenda, /relacionamentos, /pipeline, /vendas, /atividades, /registrar-atividade, /relatorio, /ranking, /whatsapp${gestor ? ", /gestor" : ""}.

Entregue a resposta chamando a ferramenta "recados".

MATERIAIS DE TREINAMENTO DA EMPRESA (manual, playbook, regras da casa):
${opts.materiais || manual() || "(sem material cadastrado — use boas práticas de venda consultiva)"}`;

  const user = `Tela: ${TELAS[opts.pagina] ?? opts.pagina}
Pessoa: ${opts.pessoa.nome} (${opts.pessoa.cargo}, ${opts.pessoa.loja})
Data/hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

MÉTRICAS (exatas):
${JSON.stringify(opts.metricas)}

Recados automáticos já calculados (use como base, pode reescrever e priorizar):
${JSON.stringify(opts.recadosBase)}`;

  try {
    // Resposta via "ferramenta" com esquema fixo: o JSON sempre vem válido.
    const resp = await client.messages.create({
      model: process.env.AURA_IA_MODEL || process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [FERRAMENTA_RECADOS],
      tool_choice: { type: "tool", name: "recados" },
    });
    const bloco = resp.content.find((b) => b.type === "tool_use");
    if (!bloco || bloco.type !== "tool_use") throw new Error("IA não devolveu os recados.");
    const j = bloco.input as any;
    const tipos = ["alerta", "oportunidade", "dica", "conquista"];
    const insights: Insight[] = (Array.isArray(j.insights) ? j.insights : [])
      .slice(0, 4)
      .map((i: any) => ({
        tipo: tipos.includes(i?.tipo) ? i.tipo : "dica",
        titulo: String(i?.titulo ?? "").slice(0, 90),
        detalhe: i?.detalhe ? String(i.detalhe).slice(0, 180) : undefined,
        acao:
          i?.acao?.href && typeof i.acao.href === "string" && i.acao.href.startsWith("/")
            ? { label: String(i.acao.label ?? "Abrir").slice(0, 30), href: i.acao.href }
            : undefined,
      }))
      .filter((i: Insight) => i.titulo);
    const valor: RespostaAura = {
      manchete: String(j.manchete ?? regras.manchete).slice(0, 80),
      foco: String(j.foco ?? regras.foco).slice(0, 180),
      insights: insights.length ? insights : regras.insights,
      fonte: "ia",
      geradoEm: new Date().toISOString(),
    };
    cache.set(opts.cacheKey, { at: Date.now(), valor });
    return valor;
  } catch (e: any) {
    if (e?.status === 401) g.__auraChaveInvalida = chave();
    console.error("[aura] IA indisponível:", e?.message ?? e);
    cache.set(opts.cacheKey, { at: Date.now() - CACHE_MS + 5 * 60 * 1000, valor: regras });
    return regras;
  }
}
