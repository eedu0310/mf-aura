import type { SupabaseClient } from "@supabase/supabase-js";

export type AuraTaskAction =
  | "registrar_atividade"
  | "criar_compromisso"
  | "atualizar_proximo_contato"
  | "atualizar_oportunidade"
  | "concluir_compromisso";

export type AuraTaskInput = {
  action: AuraTaskAction;
  relacionamentoNome?: string;
  oportunidadeId?: string;
  compromissoId?: string;
  tipo?: string;
  titulo?: string;
  resumo?: string;
  data?: string;
  hora?: string;
  subtitulo?: string;
  proximoContato?: string;
  etapa?: string;
  probabilidade?: string;
  confirmado?: boolean;
};

export type AuraTaskResult = {
  ok: boolean;
  action: AuraTaskAction;
  status: "completed" | "needs_confirmation" | "not_found" | "error";
  message: string;
  entityId?: string;
};

type ExecutorContext = {
  supabase: SupabaseClient;
  empresa: string;
  userId: string;
};

const ETAPAS = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados"] as const;
const PROBABILIDADES = ["Baixa", "Média", "Alta"] as const;

function resposta(input: AuraTaskInput, result: Omit<AuraTaskResult, "action">): AuraTaskResult {
  return { action: input.action, ...result };
}

function obrigatorio(value: string | undefined, nome: string) {
  if (!value?.trim()) throw new Error(`O campo ${nome} é obrigatório.`);
  return value.trim();
}

async function encontrarRelacionamento(ctx: ExecutorContext, nome: string) {
  const { data, error } = await ctx.supabase
    .from("relacionamentos")
    .select("id, nome")
    .eq("empresa", ctx.empresa)
    .ilike("nome", `%${nome}%`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Executor de ações da AURA. Este módulo é aditivo: não altera rotas ou telas
 * existentes. Todas as escritas usam o cliente autenticado e, portanto, passam
 * pelas políticas RLS atuais do Supabase.
 */
export async function executarTarefaAura(
  input: AuraTaskInput,
  ctx: ExecutorContext,
): Promise<AuraTaskResult> {
  try {
    if (input.action === "registrar_atividade") {
      const tipo = obrigatorio(input.tipo, "tipo");
      const resumo = obrigatorio(input.resumo, "resumo");
      const nome = input.relacionamentoNome?.trim() || null;
      let relacionamentoId: string | null = null;

      if (nome) {
        const encontrados = await encontrarRelacionamento(ctx, nome);
        if (encontrados.length > 1 && !input.confirmado) {
          return resposta(input, {
            ok: false,
            status: "needs_confirmation",
            message: `Encontrei mais de um relacionamento parecido com "${nome}". Confirme o cliente antes de registrar a atividade.`,
          });
        }
        if (encontrados.length === 0) {
          return resposta(input, {
            ok: false,
            status: "not_found",
            message: `Não encontrei "${nome}" no CRM. A atividade não foi registrada.`,
          });
        }
        relacionamentoId = encontrados[0].id as string;
      }

      const { data, error } = await ctx.supabase
        .from("atividades")
        .insert({
          owner_id: ctx.userId,
          empresa: ctx.empresa,
          tipo,
          titulo: input.titulo?.trim() || `${tipo} registrada pela AURA`,
          contexto: nome ? `${nome}: ${resumo}` : resumo,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      if (relacionamentoId) {
        await ctx.supabase
          .from("relacionamentos")
          .update({ ultimo_contato: "hoje" })
          .eq("id", relacionamentoId)
          .eq("empresa", ctx.empresa);
      }

      return resposta(input, {
        ok: true,
        status: "completed",
        entityId: data?.id as string | undefined,
        message: `Atividade registrada${nome ? ` para ${nome}` : ""}.`,
      });
    }

    if (input.action === "criar_compromisso") {
      const titulo = obrigatorio(input.titulo, "título");
      const data = obrigatorio(input.data, "data");
      const nome = input.relacionamentoNome?.trim() || null;

      const { data: criado, error } = await ctx.supabase
        .from("compromissos")
        .insert({
          owner_id: ctx.userId,
          titulo,
          subtitulo: input.subtitulo?.trim() || null,
          tipo: input.tipo?.trim() || "Outro",
          relacionamento_nome: nome,
          data,
          hora: input.hora?.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      return resposta(input, {
        ok: true,
        status: "completed",
        entityId: criado?.id as string | undefined,
        message: `Compromisso "${titulo}" criado para ${data}${input.hora ? ` às ${input.hora}` : ""}.`,
      });
    }

    if (input.action === "atualizar_proximo_contato") {
      const nome = obrigatorio(input.relacionamentoNome, "relacionamento");
      const proximoContato = obrigatorio(input.proximoContato, "próximo contato");
      const encontrados = await encontrarRelacionamento(ctx, nome);

      if (encontrados.length === 0) {
        return resposta(input, { ok: false, status: "not_found", message: `Não encontrei "${nome}" no CRM.` });
      }
      if (encontrados.length > 1 && !input.confirmado) {
        return resposta(input, {
          ok: false,
          status: "needs_confirmation",
          message: `Encontrei mais de um relacionamento parecido com "${nome}". Confirme qual deve ser atualizado.`,
        });
      }

      const alvo = encontrados[0];
      const { error } = await ctx.supabase
        .from("relacionamentos")
        .update({ proximo_contato: proximoContato })
        .eq("id", alvo.id)
        .eq("empresa", ctx.empresa);
      if (error) throw new Error(error.message);

      return resposta(input, {
        ok: true,
        status: "completed",
        entityId: alvo.id as string,
        message: `Próximo contato de "${alvo.nome}" atualizado para "${proximoContato}".`,
      });
    }

    if (input.action === "atualizar_oportunidade") {
      const oportunidadeId = obrigatorio(input.oportunidadeId, "oportunidadeId");
      if (!input.confirmado) {
        return resposta(input, {
          ok: false,
          status: "needs_confirmation",
          message: "A alteração da oportunidade foi preparada, mas precisa da confirmação do vendedor.",
        });
      }
      if (input.etapa && !ETAPAS.includes(input.etapa as (typeof ETAPAS)[number])) {
        throw new Error("Etapa de oportunidade inválida.");
      }
      if (input.probabilidade && !PROBABILIDADES.includes(input.probabilidade as (typeof PROBABILIDADES)[number])) {
        throw new Error("Probabilidade de oportunidade inválida.");
      }
      if (!input.etapa && !input.probabilidade) {
        throw new Error("Informe etapa ou probabilidade para atualizar a oportunidade.");
      }

      const patch: Record<string, string> = {};
      if (input.etapa) patch.etapa = input.etapa;
      if (input.probabilidade) patch.probabilidade = input.probabilidade;
      const { data, error } = await ctx.supabase
        .from("oportunidades")
        .update(patch)
        .eq("id", oportunidadeId)
        .eq("empresa", ctx.empresa)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return resposta(input, { ok: false, status: "not_found", message: "Oportunidade não encontrada." });

      return resposta(input, {
        ok: true,
        status: "completed",
        entityId: data.id as string,
        message: "Oportunidade atualizada com sucesso.",
      });
    }

    if (input.action === "concluir_compromisso") {
      const compromissoId = obrigatorio(input.compromissoId, "compromissoId");
      const { data, error } = await ctx.supabase
        .from("compromissos")
        .update({ concluido: true })
        .eq("id", compromissoId)
        .eq("owner_id", ctx.userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return resposta(input, { ok: false, status: "not_found", message: "Compromisso não encontrado." });

      return resposta(input, {
        ok: true,
        status: "completed",
        entityId: data.id as string,
        message: "Compromisso concluído.",
      });
    }

    return resposta(input, { ok: false, status: "error", message: "Ação não suportada." });
  } catch (error) {
    return resposta(input, {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Não foi possível executar a tarefa.",
    });
  }
}

export const AURA_TASK_ACTIONS = [
  {
    name: "registrar_atividade",
    description: "Registra uma atividade já realizada e atualiza o último contato quando houver relacionamento.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string" },
        relacionamentoNome: { type: "string" },
        titulo: { type: "string" },
        resumo: { type: "string" },
      },
      required: ["tipo", "resumo"],
    },
  },
  {
    name: "criar_compromisso",
    description: "Cria um compromisso na agenda do vendedor.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        tipo: { type: "string" },
        relacionamentoNome: { type: "string" },
        data: { type: "string", description: "YYYY-MM-DD" },
        hora: { type: "string", description: "HH:MM" },
        subtitulo: { type: "string" },
      },
      required: ["titulo", "data"],
    },
  },
  {
    name: "atualizar_proximo_contato",
    description: "Atualiza o próximo contato de um relacionamento existente.",
    parameters: {
      type: "object",
      properties: {
        relacionamentoNome: { type: "string" },
        proximoContato: { type: "string" },
      },
      required: ["relacionamentoNome", "proximoContato"],
    },
  },
  {
    name: "atualizar_oportunidade",
    description: "Atualiza a etapa ou probabilidade de uma oportunidade. Exige confirmação.",
    parameters: {
      type: "object",
      properties: {
        oportunidadeId: { type: "string" },
        etapa: { type: "string", enum: [...ETAPAS] },
        probabilidade: { type: "string", enum: [...PROBABILIDADES] },
        confirmado: { type: "boolean" },
      },
      required: ["oportunidadeId"],
    },
  },
  {
    name: "concluir_compromisso",
    description: "Marca um compromisso do vendedor como concluído.",
    parameters: {
      type: "object",
      properties: { compromissoId: { type: "string" } },
      required: ["compromissoId"],
    },
  },
] as const;
