import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CARGOS_QUE_VENDEM } from "@/lib/types";

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
  if (!supabase) throw new Error("Sem conexão com o banco.");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Sessão expirada. Entre de novo.");

  /*
   * O .select() não é enfeite. Um UPDATE barrado pela RLS volta sem erro e com
   * ZERO linhas: sem conferir o que voltou, a tela diria "aprovado" e nada
   * teria sido aprovado.
   */
  const { data, error } = await supabase
    .from("compromissos_mensais")
    .update({
      status: "aprovado",
      aprovado_por: user.id,
      feedback_gestor: feedbackGestor || null,
      notificacao_visualizada: false,
    })
    .eq("id", compromissoId)
    .select("id, vendedor_id, mes");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Nenhuma meta foi aprovada. Isso acontece quando a meta já foi alterada por outra pessoa ou quando seu acesso de gestor não cobre essa loja.",
    );
  }

  await avisarVendedor(
    supabase,
    String(data[0].vendedor_id),
    "Meta aprovada",
    `Sua meta de ${rotuloDoMes(String(data[0].mes))} foi aprovada.` +
      (feedbackGestor ? ` Recado do gestor: ${feedbackGestor}` : ""),
    "meta_atingida",
  );

  return true;
}

export async function rejeitarCompromisso(compromissoId: string, feedback: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Sem conexão com o banco.");

  const { data, error } = await supabase
    .from("compromissos_mensais")
    .update({
      status: "ajuste_solicitado",
      feedback_gestor: feedback,
      notificacao_visualizada: false,
    })
    .eq("id", compromissoId)
    .select("id, vendedor_id, mes");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Nenhuma meta foi devolvida para ajuste. A meta pode já ter mudado de status ou estar fora do seu acesso de gestor.",
    );
  }

  await avisarVendedor(
    supabase,
    String(data[0].vendedor_id),
    "Ajuste pedido na sua meta",
    `O gestor pediu ajuste na meta de ${rotuloDoMes(String(data[0].mes))}. Motivo: ${feedback}`,
    "alerta",
  );

  return true;
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
/* ------------------------------------------------------------------ *
 * Panorama e remoção de metas pelo gestor
 * ------------------------------------------------------------------ */

function rotuloDoMes(mes: string): string {
  const [ano, m] = String(mes ?? "").split("-");
  if (!ano || !m) return String(mes ?? "");
  return new Date(Number(ano), Number(m) - 1, 1).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Notificação do gestor para o vendedor. Não derruba a operação principal se
 * falhar — mas devolve o motivo, porque dizer "avisei o vendedor" sem ter
 * avisado é pior do que não avisar.
 */
async function avisarVendedor(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  vendedorId: string,
  titulo: string,
  mensagem: string,
  tipo: "alerta" | "meta_atingida" | "compromisso",
  acaoUrl = "/meu-dia",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("notificacoes")
    .insert([{ vendedor_id: vendedorId, titulo, mensagem, tipo, acao_url: acaoUrl }])
    .select("id");
  if (error) return error.message;
  if (!data || data.length === 0) return "a notificação não foi gravada (sem permissão)";
  return null;
}

export interface MetaNoPanorama {
  vendedorId: string;
  vendedorNome: string;
  cargo: string;
  empresa: string;
  /** null = esse vendedor ainda não mandou meta nenhuma para o mês. */
  compromisso: CompromissoMensal | null;
}

/**
 * Todo mundo que deveria ter meta no mês, com meta ou sem.
 *
 * Listar só o que existe na tabela esconde justamente o caso que importa: o
 * vendedor que não mandou nada. A linha sem meta é a informação.
 */
export async function buscarPanoramaDeMetas(mes?: string): Promise<MetaNoPanorama[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Sem conexão com o banco.");
  const alvo = mes || mesAtual();

  const [rPessoas, rMetas] = await Promise.all([
    supabase.from("profiles").select("id, nome, cargo, empresa").eq("ativo", true),
    supabase.from("compromissos_mensais").select("*").eq("mes", alvo),
  ]);

  if (rPessoas.error) throw new Error(`Não consegui ler a equipe: ${rPessoas.error.message}`);
  if (rMetas.error) throw new Error(`Não consegui ler as metas: ${rMetas.error.message}`);

  const porVendedor = new Map<string, Record<string, any>>();
  for (const linha of rMetas.data ?? []) {
    const id = String(linha.vendedor_id);
    const anterior = porVendedor.get(id);
    // Se houver duplicata, a aprovada manda; depois a mais recente.
    if (
      !anterior ||
      (linha.status === "aprovado" && anterior.status !== "aprovado") ||
      (anterior.status !== "aprovado" &&
        String(linha.created_at ?? "") > String(anterior.created_at ?? ""))
    ) {
      porVendedor.set(id, linha);
    }
  }

  return (rPessoas.data ?? [])
    .filter((p: any) => (CARGOS_QUE_VENDEM as readonly string[]).includes(String(p.cargo)) || porVendedor.has(String(p.id)))
    .map((p: any) => {
      const linha = porVendedor.get(String(p.id));
      return {
        vendedorId: String(p.id),
        vendedorNome: String(p.nome ?? "Sem nome"),
        cargo: String(p.cargo ?? ""),
        empresa: String(p.empresa ?? ""),
        compromisso: linha ? doBanco(linha) : null,
      };
    })
    .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.vendedorNome.localeCompare(b.vendedorNome));
}

export interface ResultadoRemocao {
  removidas: number;
  /** null quando o vendedor foi avisado; o motivo quando o aviso não saiu. */
  avisoFalhou: string | null;
}

/**
 * Apaga a meta do mês de um vendedor para ele preencher de novo, e avisa.
 *
 * Até a migração 078 a tabela não tinha policy de DELETE nenhuma: o pedido
 * voltava "ok" com zero linhas apagadas. Por isso aqui se confere o que
 * voltou em vez de confiar na ausência de erro.
 */
export async function removerCompromisso(compromissoId: string, motivo?: string): Promise<ResultadoRemocao> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Sem conexão com o banco.");

  const { data: antes, error: erroLeitura } = await supabase
    .from("compromissos_mensais")
    .select("id, vendedor_id, mes")
    .eq("id", compromissoId)
    .maybeSingle();
  if (erroLeitura) throw new Error(`Não consegui ler a meta: ${erroLeitura.message}`);
  if (!antes) throw new Error("Essa meta já não existe mais. Atualize a tela.");

  const { data, error } = await supabase
    .from("compromissos_mensais")
    .delete()
    .eq("id", compromissoId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Nada foi excluído. Seu acesso de gestor não cobre esse vendedor, ou a meta já tinha sido removida.",
    );
  }

  const avisoFalhou = await avisarVendedor(
    supabase,
    String(antes.vendedor_id),
    "Mande sua meta de novo",
    `O gestor removeu sua meta de ${rotuloDoMes(String(antes.mes))} e pediu que você preencha de novo.` +
      (motivo ? ` Motivo: ${motivo}` : ""),
    "compromisso",
  );

  return { removidas: data.length, avisoFalhou };
}
