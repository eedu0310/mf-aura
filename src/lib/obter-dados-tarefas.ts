import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface DadosTarefas {
  meuId: string;
  nomeusuario: string;
  cargo: string;
  empresa: string;
  
  metaFaturamento: number;
  faturamentoAtual: number;
  percentualMeta: number;
  
  relacionamentos: {
    id: string;
    nome: string;
    categoria: "cliente_novo" | "arquiteto" | "construtora" | "obra";
    ultimaAtividade?: string;
    diasSemContato: number;
    status: "ativo" | "esfriando" | "parado";
  }[];
  
  atividadesPendentes: {
    id: string;
    nomeRelacionamento: string;
    dataPromessa?: string;
    diasAtrasado: number;
    prioridade: "urgente" | "alta" | "média";
  }[];
  
  atividadesHoje: {
    id: string;
    nomeRelacionamento: string;
    tipo: string;
    hora?: string;
  }[];
  
  performance: {
    diasDoMes: number;
    diasRestantes: number;
    vendasEsseSemana: number;
    tendenciaDeAlcance: number;
  };
  
  compromissosMes?: {
    metaClientes?: number;
    metaArquitetos?: number;
    metaConstrutoras?: number;
    metaObras?: number;
    metaVisitas?: number;
    metaLigacoes?: number;
  };
}

export async function obterDadosTarefas(usuarioId: string): Promise<DadosTarefas | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;

    const { data: usuario } = await supabase
      .from("profiles")
      .select("id, nome, cargo, empresa")
      .eq("id", usuarioId)
      .single();

    if (!usuario) return null;

    const { data: compromissoMes } = await supabase
      .from("compromissos_mensais")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("data_criacao", { ascending: false })
      .limit(1)
      .single();

    const agora = new Date();
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
    const { data: vendas = [] } = await supabase
      .from("vendas")
      .select("valor, data_venda")
      .eq("usuario_id", usuarioId)
      .gte("data_venda", primeiroDia.toISOString())
      .lte("data_venda", agora.toISOString());

    const faturamentoAtual = (vendas || []).reduce((sum, v) => sum + (v.valor || 0), 0);

    const { data: relacionamentos = [] } = await supabase
      .from("relacionamentos")
      .select(`
        id,
        nome,
        categoria,
        atividades (
          data_atividade,
          tipo_atividade
        )
      `)
      .eq("usuario_id", usuarioId);

    const relacionamentosProcessados = (relacionamentos || []).map((rel: any) => {
      const ultimaAtividade = rel.atividades?.[0]?.data_atividade;
      const diasSemContato = ultimaAtividade
        ? Math.floor(
            (new Date().getTime() - new Date(ultimaAtividade).getTime()) /
            (1000 * 60 * 60 * 24)
          )
        : 999;

      let status: "ativo" | "esfriando" | "parado" = "ativo";
      if (diasSemContato > 30) status = "parado";
      else if (diasSemContato > 14) status = "esfriando";

      return {
        id: rel.id,
        nome: rel.nome,
        categoria: rel.categoria,
        ultimaAtividade,
        diasSemContato,
        status,
      };
    });

    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

    const { data: atividadesHoje = [] } = await supabase
      .from("atividades")
      .select(`
        id,
        data_atividade,
        tipo_atividade,
        relacionamentos (nome)
      `)
      .eq("usuario_id", usuarioId)
      .gte("data_atividade", inicioHoje.toISOString())
      .lt("data_atividade", fimHoje.toISOString());

    const atividadesHojeProcessadas = (atividadesHoje || []).map((at: any) => ({
      id: at.id,
      nomeRelacionamento: at.relacionamentos?.nome || "Desconhecido",
      tipo: at.tipo_atividade,
      hora: at.data_atividade,
    }));

    const { data: atividadesPendentes = [] } = await supabase
      .from("metas_atividade")
      .select(`
        id,
        data_prevista,
        relacionamentos (nome)
      `)
      .eq("usuario_id", usuarioId)
      .is("data_conclusao", null)
      .order("data_prevista", { ascending: true });

    const atividadesPendentesProcessadas = (atividadesPendentes || [])
      .map((at: any) => {
        const diasAtrasado = at.data_prevista
          ? Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(at.data_prevista).getTime()) /
                (1000 * 60 * 60 * 24)
              )
            )
          : 0;

        let prioridade: "urgente" | "alta" | "média" = "média";
        if (diasAtrasado > 7) prioridade = "urgente";
        else if (diasAtrasado > 3) prioridade = "alta";

        return {
          id: at.id,
          nomeRelacionamento: at.relacionamentos?.nome || "Desconhecido",
          dataPromessa: at.data_prevista,
          diasAtrasado,
          prioridade,
        };
      })
      .sort((a, b) => b.diasAtrasado - a.diasAtrasado);

    const diasDoMes = agora.getDate();
    const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const diasRestantes = ultimoDiaMes - diasDoMes;

    const vendasEsseSemana = (vendas || []).filter((v: any) => {
      const dataVenda = new Date(v.data_venda);
      const inicioSemana = new Date();
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      return dataVenda >= inicioSemana;
    }).length;

    const metaFaturamento = compromissoMes?.meta_faturamento ?? 0;
    const tendenciaDeAlcance = metaFaturamento > 0 ? faturamentoAtual / metaFaturamento : 0;

    return {
      meuId: usuario.id,
      nomeusuario: usuario.nome,
      cargo: usuario.cargo,
      empresa: usuario.empresa,
      
      metaFaturamento,
      faturamentoAtual,
      percentualMeta: metaFaturamento > 0 ? Math.round((faturamentoAtual / metaFaturamento) * 100) : 0,
      
      relacionamentos: relacionamentosProcessados,
      atividadesPendentes: atividadesPendentesProcessadas,
      atividadesHoje: atividadesHojeProcessadas,
      
      performance: {
        diasDoMes,
        diasRestantes,
        vendasEsseSemana,
        tendenciaDeAlcance: Math.round(tendenciaDeAlcance * 100),
      },
      
      compromissosMes: {
        metaClientes: compromissoMes?.meta_clientes_novos,
        metaArquitetos: compromissoMes?.meta_arquitetos,
        metaConstrutoras: compromissoMes?.meta_construtoras,
        metaObras: compromissoMes?.meta_obras,
        metaVisitas: compromissoMes?.meta_visitas,
        metaLigacoes: compromissoMes?.meta_ligacoes,
      },
    };
  } catch (erro) {
    console.error("Erro ao obter dados para tarefas:", erro);
    return null;
  }
}
