import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusCompromisso = "rascunho" | "pendente_aprovacao" | "aprovado" | "ajuste_solicitado" | "rejeitado";

export interface CompromissoMensal {
  id: string;
  vendedorId: string;
  empresa: string;
  mes: string;
  metaFaturamento: number;
  metaClientesNovos: number;
  metaArquitetos: number;
  metaConstrutoras: number;
  metaObras: number;
  metaVisitas: number;
  metaLigacoes: number;
  objetivoPessoal: string | null;
  status: StatusCompromisso;
  feedbackGestor: string | null;
  aprovadoPor?: string | null;
  dataEnvio?: string;
  notificacao_visualizada?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompromissoMensalComVendedor extends CompromissoMensal {
  vendedorNome: string;
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function doBanco(linha: Record<string, any>): CompromissoMensal {
  return {
    id: linha.id as string,
    vendedorId: linha.vendedor_id as string,
    empresa: linha.empresa as string,
    mes: linha.mes as string,
    metaFaturamento: Number(linha.meta_faturamento) || 0,
    metaClientesNovos: Number(linha.meta_clientes_novos) || 0,
    metaArquitetos: Number(linha.meta_arquitetos) || 0,
    metaConstrutoras: Number(linha.meta_construtoras) || 0,
    metaObras: Number(linha.meta_obras) || 0,
    metaVisitas: Number(linha.meta_visitas) || 0,
    metaLigacoes: Number(linha.meta_ligacoes) || 0,
    objetivoPessoal: (linha.objetivo_pessoal as string) ?? null,
    status: (linha.status as StatusCompromisso) || "rascunho",
    feedbackGestor: (linha.feedback_gestor as string) ?? null,
    aprovadoPor: (linha.aprovado_por as string) ?? null,
    dataEnvio: (linha.data_envio as string) ?? undefined,
    notificacao_visualizada: (linha.notificacao_visualizada as boolean) ?? false,
  };
}

export async function buscarCompromissoDoMes(): Promise<CompromissoMensal | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const mes = mesAtual();

    const { data, error } = await supabase
      .from("compromissos_mensais")
      .select("*")
      .eq("vendedor_id", user.id)
      .eq("mes", mes)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar compromisso:", error);
      return null;
    }

    return data ? doBanco(data) : null;
  } catch (erro) {
    console.error("Erro ao buscar compromisso do mês:", erro);
    return null;
  }
}

export async function salvarCompromisso(compromisso: Partial<CompromissoMensal>): Promise<CompromissoMensal | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const agora = new Date().toISOString();
    const dados = {
      vendedor_id: user.id,
      empresa: compromisso.empresa || "",
      mes: compromisso.mes || mesAtual(),
      meta_faturamento: compromisso.metaFaturamento || 0,
      meta_clientes_novos: compromisso.metaClientesNovos || 0,
      meta_arquitetos: compromisso.metaArquitetos || 0,
      meta_construtoras: compromisso.metaConstrutoras || 0,
      meta_obras: compromisso.metaObras || 0,
      meta_visitas: compromisso.metaVisitas || 0,
      meta_ligacoes: compromisso.metaLigacoes || 0,
      objetivo_pessoal: compromisso.objetivoPessoal || null,
      status: compromisso.status || "rascunho",
      feedback_gestor: compromisso.feedbackGestor || null,
      data_envio: compromisso.status === "pendente_aprovacao" ? agora : compromisso.dataEnvio,
    };

    if (compromisso.id) {
      const { data, error } = await supabase
        .from("compromissos_mensais")
        .update(dados)
        .eq("id", compromisso.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar compromisso:", error);
        return null;
      }
      return data ? doBanco(data) : null;
    } else {
      const { data, error } = await supabase
        .from("compromissos_mensais")
        .insert([dados])
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar compromisso:", error);
        return null;
      }
      return data ? doBanco(data) : null;
    }
  } catch (erro) {
    console.error("Erro ao salvar compromisso:", erro);
    return null;
  }
}

export async function buscarCompromissosPendentes(): Promise<CompromissoMensalComVendedor[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    // Buscar apenas compromissos (sem tentar relacionamento automático)
    const { data: compromissos, error } = await supabase
      .from("compromissos_mensais")
      .select("*")
      .in("status", ["pendente_aprovacao", "ajuste_solicitado"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar compromissos:", error);
      return [];
    }

    if (!compromissos || compromissos.length === 0) return [];

    // Buscar nomes dos vendedores em batch
    const vendedorIds = [...new Set(compromissos.map((c: any) => c.vendedor_id))];

    const { data: vendedores } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", vendedorIds);

    const vendedorMap = new Map(
      (vendedores || []).map((v: any) => [v.id, v.nome])
    );

    return compromissos.map((c: any) => ({
      ...doBanco(c),
      vendedorNome: vendedorMap.get(c.vendedor_id) || "Desconhecido",
    }));
  } catch (erro) {
    console.error("Erro ao buscar compromissos pendentes:", erro);
    return [];
  }
}

export async function aprovarCompromisso(compromissoId: string, feedbackGestor?: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return false;

    const { error } = await supabase
      .from("compromissos_mensais")
      .update({
        status: "aprovado",
        aprovado_por: user.id,
        feedback_gestor: feedbackGestor || null,
        notificacao_visualizada: false,
      })
      .eq("id", compromissoId);

    if (error) {
      console.error("Erro ao aprovar compromisso:", error);
      return false;
    }
    return true;
  } catch (erro) {
    console.error("Erro ao aprovar compromisso:", erro);
    return false;
  }
}

export async function rejeitarCompromisso(compromissoId: string, feedback: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("compromissos_mensais")
      .update({
        status: "ajuste_solicitado",
        feedback_gestor: feedback,
      })
      .eq("id", compromissoId);

    if (error) {
      console.error("Erro ao rejeitar compromisso:", error);
      return false;
    }
    return true;
  } catch (erro) {
    console.error("Erro ao rejeitar compromisso:", erro);
    return false;
  }
}

export async function buscarCompromissosPorEmpresa(empresa: string): Promise<CompromissoMensalComVendedor[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    const { data: compromissos, error } = await supabase
      .from("compromissos_mensais")
      .select("*")
      .eq("empresa", empresa)
      .order("mes", { ascending: false });

    if (error) {
      console.error("Erro ao buscar compromissos por empresa:", error);
      return [];
    }

    if (!compromissos || compromissos.length === 0) return [];

    // Buscar nomes dos vendedores em batch
    const vendedorIds = [...new Set(compromissos.map((c: any) => c.vendedor_id))];

    const { data: vendedores } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", vendedorIds);

    const vendedorMap = new Map(
      (vendedores || []).map((v: any) => [v.id, v.nome])
    );

    return compromissos.map((c: any) => ({
      ...doBanco(c),
      vendedorNome: vendedorMap.get(c.vendedor_id) || "Desconhecido",
    }));
  } catch (erro) {
    console.error("Erro ao buscar compromissos por empresa:", erro);
    return [];
  }
}