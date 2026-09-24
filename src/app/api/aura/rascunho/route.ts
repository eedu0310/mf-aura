import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";

export const runtime = "nodejs";

const schema = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    resultado: { type: "string" },
    proximoPasso: { type: "string" },
    prazoDias: { type: "integer", minimum: 0, maximum: 90 },
    origem: { type: "string" },
    categoria: { type: "string" },
    nomeCliente: { type: "string" },
    produto: { type: "string" },
    valorEstimado: { type: "number", minimum: 0 },
    confianca: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["resumo", "resultado", "proximoPasso", "prazoDias", "origem", "categoria", "nomeCliente", "produto", "valorEstimado", "confianca"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const openai = getOpenAIClient();
  if (!openai) return NextResponse.json({ erro: "AURA IA não configurada." }, { status: 503 });

  let relato = "";
  try {
    const body = (await request.json()) as { relato?: unknown };
    relato = typeof body.relato === "string" ? body.relato.trim() : "";
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (relato.length < 12 || relato.length > 6000) {
    return NextResponse.json({ erro: "Descreva o contato com pelo menos 12 caracteres e no máximo 6.000." }, { status: 400 });
  }

  try {
    const resposta = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é a AURA, supervisora comercial da empresa ${auth.empresa}. Transforme o relato do vendedor em um RASCUNHO para revisão humana. Não invente informações. Quando um campo não estiver claro, use string vazia, 0 ou uma sugestão conservadora. prazoDias deve ser 0 quando não houver prazo. Use somente estes valores quando aplicável: resultado Positivo, Neutro, Negativo, Sem resposta ou Agendado; proximoPasso Ligar, Retornar, Enviar orçamento, Nova visita, Agendar reunião, Aguardar retorno ou Encerrado; origem Marketing, Loja, Prospecção, Indicação, Site, WhatsApp ou Outro. A resposta deve ser JSON compatível com o schema.`,
        },
        { role: "user", content: relato },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "rascunho_atividade_aura", strict: true, schema },
      },
      temperature: 0.1,
    }, { __funcao: "rascunho" } as never);

    const conteudo = resposta.choices[0]?.message?.content;
    if (!conteudo) return NextResponse.json({ erro: "A AURA não conseguiu estruturar o relato." }, { status: 502 });
    return NextResponse.json({ rascunho: JSON.parse(conteudo), empresa: auth.empresa });
  } catch (error) {
    console.error("Erro ao gerar rascunho da AURA:", error);
    return NextResponse.json({ erro: "Não foi possível gerar o rascunho. Revise e tente novamente." }, { status: 502 });
  }
}
