import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { DadosTarefas } from "@/lib/obter-dados-tarefas";

// Usa a chave do Claude (ou a da OpenAI, se existir) pela ponte comum.

export interface TarefaDiaria {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "urgente" | "alta" | "média" | "baixa";
  icone: string;
  relacionamentoId?: string;
  estimativaMinutos?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { dados, cargo } = (await request.json()) as {
      dados: DadosTarefas;
      cargo: string;
    };

    if (!dados) {
      return NextResponse.json(
        { erro: "Dados não fornecidos" },
        { status: 400 }
      );
    }

    const prompt = montarPromptTarefas(dados, cargo);

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ erro: "IA não configurada no servidor." }, { status: 503 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }, { __funcao: "tarefas-do-dia" } as never);

    const tarefasTexto = response.choices[0].message.content || "";
    const tarefas = parseaTarefas(tarefasTexto);

    return NextResponse.json({
      sucesso: true,
      tarefas,
      tokens: response.usage?.total_tokens || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (erro) {
    console.error("Erro ao gerar tarefas:", erro);
    return NextResponse.json(
      { erro: "Erro ao gerar tarefas" },
      { status: 500 }
    );
  }
}

function montarPromptTarefas(dados: DadosTarefas, cargo: string): string {
  const relacionamentosComRisco = dados.relacionamentos.filter(
    (r) => r.diasSemContato > 14
  );

  const atividadesUrgentes = dados.atividadesPendentes.filter(
    (f) => f.diasAtrasado > 3
  );

  return `
Você é AURA Coach, um assistente de vendas inteligente. Seu trabalho é gerar 5-7 tarefas ESPECÍFICAS e INTELIGENTES para ${dados.nomeusuario} fazer hoje.

CONTEXTO ATUAL:
Cargo: ${cargo}
Empresa: ${dados.empresa}

META DE FATURAMENTO:
- Meta: R$ ${dados.metaFaturamento.toLocaleString("pt-BR")}
- Faturado: R$ ${dados.faturamentoAtual.toLocaleString("pt-BR")}
- Progresso: ${dados.percentualMeta}%
- Dias do mês: ${dados.performance.diasDoMes}/${dados.performance.diasDoMes + dados.performance.diasRestantes}

ATIVIDADES HOJE:
- Já atendeu: ${dados.atividadesHoje.length > 0 ? dados.atividadesHoje.map((a) => a.nomeRelacionamento).join(", ") : "Nenhuma"}

RELACIONAMENTOS EM RISCO:
${relacionamentosComRisco.length > 0
  ? relacionamentosComRisco
      .slice(0, 5)
      .map(
        (r) =>
          `- ${r.nome} (${r.diasSemContato} dias sem contato) [${r.status}]`
      )
      .join("\n")
  : "- Nenhum"}

ATIVIDADES ATRASADAS:
${atividadesUrgentes.length > 0
  ? atividadesUrgentes
      .slice(0, 5)
      .map(
        (f) =>
          `- ${f.nomeRelacionamento}: ${f.diasAtrasado} dias atrasado [${f.prioridade.toUpperCase()}]`
      )
      .join("\n")
  : "- Nenhuma"}

INSTRUÇÕES:
1. Gere 5-7 tarefas específicas
2. Considere o cargo de ${cargo}
3. INCLUA: Atividades atrasadas, relacionamentos em risco, metas
4. Use NOMES REAIS
5. Priorize por urgência

FORMATO (JSON válido):
{
  "tarefas": [
    {
      "titulo": "Título da tarefa",
      "descricao": "Descrição",
      "prioridade": "urgente|alta|média|baixa",
      "icone": "emoji",
      "estimativaMinutos": 15
    }
  ]
}
`;
}

function parseaTarefas(texto: string): TarefaDiaria[] {
  try {
    const textoLimpo = texto
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const json = JSON.parse(textoLimpo);
    const tarefas: TarefaDiaria[] = [];

    if (json.tarefas && Array.isArray(json.tarefas)) {
      json.tarefas.forEach((tarefa: any, index: number) => {
        tarefas.push({
          id: `tarefa-${index + 1}`,
          titulo: tarefa.titulo || "Tarefa",
          descricao: tarefa.descricao || "",
          prioridade: tarefa.prioridade || "média",
          icone: tarefa.icone || "✅",
          estimativaMinutos: tarefa.estimativaMinutos || 30,
        });
      });
    }

    if (tarefas.length === 0) throw new Error("AURA não retornou tarefas estruturadas");

    return tarefas;
  } catch (erro) {
    console.error("Erro ao parsear tarefas da AURA:", erro);
    return [];
  }
}
