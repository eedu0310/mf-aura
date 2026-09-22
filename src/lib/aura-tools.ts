import type { SupabaseClient } from "@supabase/supabase-js";

export interface FerramentaDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const FERRAMENTAS_DEF: FerramentaDef[] = [
  {
    name: "criar_compromisso",
    description:
      "Cria um novo compromisso real na agenda do vendedor (visita, reunião, follow-up ou ligação). Use sempre que o vendedor pedir para agendar, marcar ou lembrar de algo em uma data.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título curto do compromisso." },
        tipo: {
          type: "string",
          enum: ["Visita", "Reunião", "Follow-up", "Ligação", "Outro"],
          description: "Tipo do compromisso.",
        },
        data: {
          type: "string",
          description:
            "Data no formato YYYY-MM-DD. Resolva datas relativas (hoje, amanhã, sexta-feira) usando a data de hoje informada no contexto de dados.",
        },
        hora: { type: "string", description: "Horário no formato HH:MM, se mencionado. Opcional." },
        relacionamento_nome: {
          type: "string",
          description: "Nome do cliente/arquiteto/construtora relacionado, se houver. Opcional.",
        },
        subtitulo: { type: "string", description: "Observação curta adicional. Opcional." },
      },
      required: ["titulo", "tipo", "data"],
    },
  },
  {
    name: "atualizar_proximo_contato",
    description:
      "Atualiza a data/status do próximo contato de um relacionamento já existente no CRM (cliente, arquiteto, construtora).",
    parameters: {
      type: "object",
      properties: {
        relacionamento_nome: {
          type: "string",
          description: "Nome do relacionamento já existente no CRM a ser atualizado.",
        },
        proximo_contato: {
          type: "string",
          description: "Novo valor, ex.: 'hoje', 'amanhã', 'em 7 dias', 'atrasado'.",
        },
      },
      required: ["relacionamento_nome", "proximo_contato"],
    },
  },
  {
    name: "criar_relacionamento",
    description:
      "Cadastra um novo cliente, arquiteto, construtora ou obra no CRM. Use quando o vendedor mencionar um contato novo que ainda não existe no CRM.",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do contato/empresa." },
        categoria: {
          type: "string",
          enum: ["Arquiteto", "Construtora", "Cliente", "Obra"],
          description: "Categoria do relacionamento.",
        },
        cidade: { type: "string", description: "Cidade, opcional." },
        telefone: { type: "string", description: "Telefone, opcional." },
        observacao: { type: "string", description: "Observação inicial sobre o contato, opcional." },
      },
      required: ["nome", "categoria"],
    },
  },
  {
    name: "registrar_atividade",
    description:
      "Registra no histórico uma atividade que o vendedor já realizou (visita, ligação, whatsapp, reunião, e-mail), a partir do relato dele na conversa. Use quando ele contar o que já fez, para catalogar isso.",
    parameters: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          description: "Tipo da atividade, ex.: Visita, Ligação, WhatsApp, Reunião, E-mail.",
        },
        relacionamento_nome: {
          type: "string",
          description: "Nome do cliente/contato envolvido, se mencionado.",
        },
        resumo: { type: "string", description: "Resumo do que aconteceu, com o máximo de detalhe relatado." },
      },
      required: ["tipo", "relacionamento_nome", "resumo"],
    },
  },
  {
    name: "atualizar_status_pos_venda",
    description:
      "Atualiza o status do pós-venda de um cliente (instalação agendada/realizada/pendente, reclamação, concluído). Use quando o usuário (time de pós-venda) contar uma atualização sobre a instalação de um cliente.",
    parameters: {
      type: "object",
      properties: {
        cliente_nome: { type: "string", description: "Nome do cliente cuja venda/instalação está sendo atualizada." },
        novo_status: {
          type: "string",
          enum: [
            "aguardando_instalacao",
            "instalacao_agendada",
            "instalacao_realizada",
            "instalacao_pendente",
            "reclamacao",
            "concluido",
          ],
          description: "Novo status do pós-venda.",
        },
        data_agendamento: {
          type: "string",
          description: "Data da instalação no formato YYYY-MM-DD, se mencionada. Opcional.",
        },
        hora_agendamento: { type: "string", description: "Horário no formato HH:MM, se mencionado. Opcional." },
        observacao: { type: "string", description: "Observação adicional, opcional." },
        reclamacao: { type: "string", description: "Texto da reclamação do cliente, se houver. Opcional." },
      },
      required: ["cliente_nome", "novo_status"],
    },
  },
  {
    name: "registrar_avaliacao_cliente",
    description:
      "Registra que um cliente avaliou a loja após a instalação, com nota de 1 a 5. Use quando o usuário contar que o cliente deu um feedback ou nota.",
    parameters: {
      type: "object",
      properties: {
        cliente_nome: { type: "string", description: "Nome do cliente que avaliou." },
        nota: { type: "number", description: "Nota de 1 a 5 dada pelo cliente." },
        comentario: { type: "string", description: "Comentário do cliente, se houver. Opcional." },
      },
      required: ["cliente_nome", "nota"],
    },
  },
  {
    name: "atualizar_oportunidade",
    description:
      "Atualiza a etapa ou a probabilidade de uma oportunidade existente no pipeline. Use somente quando o vendedor informar claramente a mudança; a ação exige confirmação explícita.",
    parameters: {
      type: "object",
      properties: {
        oportunidade_id: { type: "string", description: "ID exato da oportunidade." },
        etapa: {
          type: "string",
          enum: ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados"],
        },
        probabilidade: { type: "string", enum: ["Baixa", "Média", "Alta"] },
        confirmado: { type: "boolean", description: "Deve ser true para efetivar a alteração." },
      },
      required: ["oportunidade_id", "confirmado"],
    },
  },
  {
    name: "concluir_compromisso",
    description: "Marca como concluído um compromisso da agenda do vendedor.",
    parameters: {
      type: "object",
      properties: {
        compromisso_id: { type: "string", description: "ID exato do compromisso." },
      },
      required: ["compromisso_id"],
    },
  },
];

export function ferramentasParaResponsesAPI() {
  return FERRAMENTAS_DEF.map((f) => ({
    type: "function" as const,
    name: f.name,
    description: f.description,
    parameters: f.parameters,
    strict: false,
  }));
}

export function ferramentasParaChatCompletions() {
  return FERRAMENTAS_DEF.map((f) => ({
    type: "function" as const,
    function: { name: f.name, description: f.description, parameters: f.parameters },
  }));
}

interface ContextoExecucao {
  supabase: SupabaseClient;
  empresa: string;
  userId: string;
}

export async function executarFerramenta(
  nome: string,
  argumentosJSON: string,
  ctx: ContextoExecucao
): Promise<string> {
  let args: Record<string, string>;
  try {
    args = JSON.parse(argumentosJSON);
  } catch {
    return "Erro: não consegui interpretar os parâmetros da ação.";
  }

  if (nome === "criar_compromisso") {
    const { error } = await ctx.supabase.from("compromissos").insert({
      owner_id: ctx.userId,
      titulo: args.titulo,
      tipo: args.tipo ?? "Outro",
      data: args.data,
      hora: args.hora || null,
      relacionamento_nome: args.relacionamento_nome || null,
      subtitulo: args.subtitulo || null,
    });

    if (error) return `Não consegui criar o compromisso: ${error.message}`;
    return `Compromisso "${args.titulo}" criado com sucesso para ${args.data}${args.hora ? ` às ${args.hora}` : ""}.`;
  }

  if (nome === "atualizar_proximo_contato") {
    const { data: encontrados, error: erroBusca } = await ctx.supabase
      .from("relacionamentos")
      .select("id, nome")
      .eq("empresa", ctx.empresa)
      .ilike("nome", `%${args.relacionamento_nome}%`)
      .limit(1);

    if (erroBusca || !encontrados || encontrados.length === 0) {
      return `Não encontrei nenhum relacionamento chamado "${args.relacionamento_nome}" no CRM desta loja.`;
    }

    const alvo = encontrados[0];
    const { error } = await ctx.supabase
      .from("relacionamentos")
      .update({ proximo_contato: args.proximo_contato })
      .eq("id", alvo.id);

    if (error) return `Não consegui atualizar: ${error.message}`;
    return `Próximo contato de "${alvo.nome}" atualizado para "${args.proximo_contato}".`;
  }

  if (nome === "atualizar_oportunidade") {
    if (args.confirmado !== "true" && args.confirmado !== "1") {
      return "A alteração da oportunidade foi preparada, mas precisa de confirmação explícita do vendedor antes de ser executada.";
    }
    if (!args.oportunidade_id) return "Não recebi o ID da oportunidade.";
    const etapas = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados"];
    const probabilidades = ["Baixa", "Média", "Alta"];
    if (args.etapa && !etapas.includes(args.etapa)) return "Etapa de oportunidade inválida.";
    if (args.probabilidade && !probabilidades.includes(args.probabilidade)) return "Probabilidade inválida.";
    if (!args.etapa && !args.probabilidade) return "Informe a etapa ou a probabilidade que deve ser atualizada.";

    const patch: Record<string, string> = {};
    if (args.etapa) patch.etapa = args.etapa;
    if (args.probabilidade) patch.probabilidade = args.probabilidade;
    const { data, error } = await ctx.supabase
      .from("oportunidades")
      .update(patch)
      .eq("id", args.oportunidade_id)
      .eq("empresa", ctx.empresa)
      .select("id")
      .maybeSingle();
    if (error) return `Não consegui atualizar a oportunidade: ${error.message}`;
    if (!data) return "Não encontrei essa oportunidade nesta loja.";
    return "Oportunidade atualizada com sucesso.";
  }

  if (nome === "concluir_compromisso") {
    if (!args.compromisso_id) return "Não recebi o ID do compromisso.";
    const { data, error } = await ctx.supabase
      .from("compromissos")
      .update({ concluido: true })
      .eq("id", args.compromisso_id)
      .eq("owner_id", ctx.userId)
      .select("id")
      .maybeSingle();
    if (error) return `Não consegui concluir o compromisso: ${error.message}`;
    if (!data) return "Não encontrei esse compromisso para o vendedor autenticado.";
    return "Compromisso concluído com sucesso.";
  }

  if (nome === "criar_relacionamento") {
    const { data, error } = await ctx.supabase
      .from("relacionamentos")
      .insert({
        owner_id: ctx.userId,
        empresa: ctx.empresa,
        nome: args.nome,
        categoria: args.categoria || "Cliente Final",
        cidade: args.cidade || "Não informado",
        telefone: args.telefone || null,
        temperatura: "ativo",
        ultimo_contato: "hoje",
        proximo_contato: "a definir",
        observacao: args.observacao || "Relacionamento cadastrado pela AURA Coach.",
        obras_indicadas: 0,
        valor_gerado: 0,
      })
      .select("id, nome")
      .single();

    if (error || !data) return `Não consegui cadastrar "${args.nome}": ${error?.message ?? "erro desconhecido"}`;
    return `Cadastrei "${data.nome}" no CRM como ${args.categoria || "Cliente Final"}.`;
  }

  if (nome === "registrar_atividade") {
    let relacionamentoId: string | null = null;
    if (args.relacionamento_nome) {
      const { data: encontrados } = await ctx.supabase
        .from("relacionamentos")
        .select("id")
        .eq("empresa", ctx.empresa)
        .ilike("nome", `%${args.relacionamento_nome}%`)
        .limit(1);
      relacionamentoId = encontrados?.[0]?.id ?? null;

      if (relacionamentoId) {
        await ctx.supabase
          .from("relacionamentos")
          .update({ ultimo_contato: "hoje" })
          .eq("id", relacionamentoId);
      } else {
        // Sincronismo: se o contato mencionado ainda não existe no CRM,
        // cadastra automaticamente (mesmo comportamento da tela de
        // Registrar Atividade).
        const { data: criado } = await ctx.supabase
          .from("relacionamentos")
          .insert({
            owner_id: ctx.userId,
            empresa: ctx.empresa,
            nome: args.relacionamento_nome,
            categoria: "Cliente Final",
            cidade: "Não informado",
            temperatura: "ativo",
            ultimo_contato: "hoje",
            proximo_contato: "a definir",
            observacao: "Cadastrado automaticamente pela AURA Coach ao registrar uma atividade.",
            obras_indicadas: 0,
            valor_gerado: 0,
          })
          .select("id")
          .single();
        relacionamentoId = criado?.id ?? null;
      }
    }

    const { error } = await ctx.supabase.from("atividades").insert({
      owner_id: ctx.userId,
      empresa: ctx.empresa,
      tipo: args.tipo || "Outro",
      titulo: `${args.tipo || "Atividade"} · registrado via AURA Coach`,
      contexto: args.relacionamento_nome || "Sem contato vinculado",
      observacao: args.resumo,
      relacionamento_id: relacionamentoId,
    });

    if (error) return `Não consegui registrar a atividade: ${error.message}`;
    return `Atividade registrada no histórico${args.relacionamento_nome ? ` com ${args.relacionamento_nome}` : ""}${relacionamentoId ? "" : " (sem vínculo com um contato)"}.`;
  }

  if (nome === "atualizar_status_pos_venda" || nome === "registrar_avaliacao_cliente") {
    const { data: vendasEncontradas } = await ctx.supabase
      .from("vendas")
      .select("id")
      .eq("empresa", ctx.empresa)
      .ilike("cliente", `%${args.cliente_nome}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    const vendaId = vendasEncontradas?.[0]?.id;
    if (!vendaId) {
      return `Não encontrei nenhuma venda para "${args.cliente_nome}" nesta loja.`;
    }

    if (nome === "atualizar_status_pos_venda") {
      const payload: Record<string, unknown> = { status: args.novo_status, updated_at: new Date().toISOString() };
      if (args.data_agendamento) payload.data_agendamento = args.data_agendamento;
      if (args.hora_agendamento) payload.hora_agendamento = args.hora_agendamento;
      if (args.observacao) payload.observacao = args.observacao;
      if (args.reclamacao) payload.reclamacao = args.reclamacao;

      const { error } = await ctx.supabase.from("pos_vendas").update(payload).eq("venda_id", vendaId);
      if (error) return `Não consegui atualizar o pós-venda: ${error.message}`;
      return `Pós-venda de "${args.cliente_nome}" atualizado para "${args.novo_status}".`;
    }

    // registrar_avaliacao_cliente
    const nota = Math.min(5, Math.max(1, Math.round(Number(args.nota))));
    const { error } = await ctx.supabase
      .from("pos_vendas")
      .update({
        avaliou_loja: true,
        nota_avaliacao: nota,
        comentario_avaliacao: args.comentario || null,
        updated_at: new Date().toISOString(),
      })
      .eq("venda_id", vendaId);

    if (error) return `Não consegui registrar a avaliação: ${error.message}`;
    return `Avaliação de "${args.cliente_nome}" registrada: ${nota} estrela${nota !== 1 ? "s" : ""}.`;
  }

  return `Ferramenta "${nome}" desconhecida.`;
}
