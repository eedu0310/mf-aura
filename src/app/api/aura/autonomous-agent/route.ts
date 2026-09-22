import { getClaudeClient } from "@/lib/claude-client";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { logarAcao } from "@/lib/agent-logger";
import { precisaAprovacao, descricaoAcao, TipoAcao } from "@/lib/approval-system";

interface RequestBody {
  userId: string;
  empresa: string;
  dataAtual: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase credentials not configured");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { userId, empresa, dataAtual } = (await request.json()) as RequestBody;

    if (!userId || !empresa) {
      return Response.json(
        { error: "userId and empresa são obrigatórios" },
        { status: 400 }
      );
    }

    const claude = getClaudeClient();

    // 1. Buscar dados do vendedor
    const { data: vendedorData, error: vendedorError } = await supabase
      .from("vendedores")
      .select("*")
      .eq("auth_id", userId)
      .eq("empresa_id", empresa)
      .single();

    if (vendedorError || !vendedorData) {
      return Response.json(
        { error: "Vendedor não encontrado" },
        { status: 404 }
      );
    }

    // 2. Buscar próximas atividades vencidas
    const { data: proximasAtividades } = await supabase
      .from("compromissos")
      .select("*")
      .eq("vendedor_id", vendedorData.id)
      .eq("status", "pendente")
      .lt("data_hora", dataAtual)
      .limit(10);

    // 3. Buscar leads novos
    const { data: leadsNovos } = await supabase
      .from("leads")
      .select("*")
      .eq("empresa_id", empresa)
      .eq("atribuido_para", vendedorData.id)
      .order("criado_em", { ascending: false })
      .limit(5);

    // 4. Criar contexto do agente
    const systemPrompt = `Você é um agente autônomo de CRM. Você deve analisar os dados do vendedor e tomar ações automáticas.

Dados do Vendedor:
- Nome: ${vendedorData.nome}
- Email: ${vendedorData.email}
- Empresa: ${empresa}

Próximas Atividades Vencidas (${proximasAtividades?.length || 0}):
${proximasAtividades?.map((a) => `- ${a.titulo} (venceu em ${a.data_hora})`).join("\n") || "Nenhuma"}

Leads Novos (${leadsNovos?.length || 0}):
${leadsNovos?.map((l) => `- ${l.nome_empresa} (${l.email})`).join("\n") || "Nenhum"}

Com base nessas informações, sugira e execute ações apropriadas. Use as ferramentas disponíveis para:
1. Criar compromissos para atividades vencidas
2. Enviar mensagens WhatsApp para leads novos
3. Registrar atividades de acompanhamento
4. Atualizar próximos contatos

Seja proativo e inteligente nas suas sugestões.`;

    // 5. Chamar Claude com tool_use
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Por favor, analise os dados e tome as ações necessárias para o dia ${dataAtual}.`,
        },
      ],
      tools: [
        {
          name: "criar_compromisso",
          description: "Cria um novo compromisso no sistema",
          input_schema: {
            type: "object" as const,
            properties: {
              titulo: {
                type: "string",
                description: "Título do compromisso",
              },
              descricao: {
                type: "string",
                description: "Descrição detalhada",
              },
              data_hora: {
                type: "string",
                description: "Data e hora do compromisso (ISO 8601)",
              },
              relacionamento_id: {
                type: "string",
                description: "ID do relacionamento associado",
              },
            },
            required: ["titulo", "data_hora"],
          },
        },
        {
          name: "enviar_mensagem_whatsapp",
          description: "Envia uma mensagem via WhatsApp",
          input_schema: {
            type: "object" as const,
            properties: {
              numero_destino: {
                type: "string",
                description: "Número do destinatário (formato: 55XXXXX)",
              },
              mensagem: {
                type: "string",
                description: "Conteúdo da mensagem",
              },
            },
            required: ["numero_destino", "mensagem"],
          },
        },
        {
          name: "registrar_atividade",
          description: "Registra uma atividade realizada",
          input_schema: {
            type: "object" as const,
            properties: {
              tipo_atividade: {
                type: "string",
                enum: ["ligacao", "visita", "reuniao", "envio_documento"],
                description: "Tipo de atividade",
              },
              relacionamento_id: {
                type: "string",
                description: "ID do relacionamento",
              },
              observacoes: {
                type: "string",
                description: "Notas sobre a atividade",
              },
            },
            required: ["tipo_atividade", "relacionamento_id"],
          },
        },
      ],
    });

    // 6. Processar tool calls
    const acoes = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const tipoAcao = block.name as TipoAcao;
        const parametros = block.input as Record<string, unknown>;

        // Verificar se precisa aprovação
        if (precisaAprovacao(tipoAcao, parametros)) {
          // Inserir em acoes_pendentes_aprovacao
          await supabase.from("acoes_pendentes_aprovacao").insert([
            {
              user_id: userId,
              empresa_id: empresa,
              tipo_acao: tipoAcao,
              descricao: descricaoAcao(tipoAcao, parametros),
              parametros,
              status: "pendente",
            },
          ]);

          acoes.push({
            tipo: tipoAcao,
            status: "aguardando_aprovacao",
            descricao: descricaoAcao(tipoAcao, parametros),
          });

          await logarAcao({
            user_id: userId,
            empresa_id: empresa,
            tipo_acao: tipoAcao,
            parametros,
            sucesso: false,
            erro: "Aguardando aprovação manual",
            criado_por: "autonomous_agent",
          });
        } else {
          // Executar imediatamente
          try {
            // Aqui você implementaria a lógica para executar cada ferramenta
            // Por enquanto, apenas registramos o sucesso

            await logarAcao({
              user_id: userId,
              empresa_id: empresa,
              tipo_acao: tipoAcao,
              parametros,
              resultado: { status: "executado" },
              sucesso: true,
              criado_por: "autonomous_agent",
            });

            acoes.push({
              tipo: tipoAcao,
              status: "executado",
              descricao: descricaoAcao(tipoAcao, parametros),
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";

            await logarAcao({
              user_id: userId,
              empresa_id: empresa,
              tipo_acao: tipoAcao,
              parametros,
              sucesso: false,
              erro: errorMsg,
              criado_por: "autonomous_agent",
            });

            acoes.push({
              tipo: tipoAcao,
              status: "erro",
              erro: errorMsg,
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      acoes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro no agente autônomo:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
