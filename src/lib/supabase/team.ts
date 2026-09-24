import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface MembroEquipe {
  id: string;
  nome: string;
  empresa: string;
  ativo: boolean;
  cargo: string;
  vendasTotal: number;
  vendasEsteMes: number;
  vendasMesPassado: number;
  atividades7dias: number;
  souEu: boolean;
}

function chaveMes(offsetMeses: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMeses);
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Carrega os vendedores reais da mesma loja (só quem já se cadastrou),
 * com métricas calculadas a partir de vendas e atividades reais.
 * Retorna null se o Supabase não estiver configurado (modo demonstração).
 */
export async function carregarEquipe(): Promise<MembroEquipe[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: perfis, error: erroPerfis } = await supabase
    .from("profiles")
    .select("id, nome, empresa, ativo, cargo")
    .order("created_at", { ascending: true });

  // Compatibilidade com bancos criados antes da coluna profiles.ativo.
  if (erroPerfis) {
    const legado = await supabase
      .from("profiles")
      .select("id, nome, empresa")
      .order("created_at", { ascending: true });
    perfis = legado.data?.map((perfil) => ({ ...perfil, ativo: true, cargo: "Vendedor" })) ?? null;
    erroPerfis = legado.error;
  }

  if (erroPerfis || !perfis) {
    console.error("Erro ao carregar equipe:", {
      message: erroPerfis?.message,
      code: erroPerfis?.code,
      details: erroPerfis?.details,
      hint: erroPerfis?.hint,
    });
    return [];
  }

  const [{ data: vendas }, { data: contagemAtividades }] = await Promise.all([
    supabase.from("vendas").select("owner_id, valor, data"),
    supabase.rpc("contagem_atividades_recentes", { dias: 7 }),
  ]);

  const mesAtual = chaveMes(0);
  const mesPassado = chaveMes(-1);

  const mapaAtividades = new Map<string, number>(
    (contagemAtividades ?? []).map((c: { owner_id: string; total: number }) => [c.owner_id, Number(c.total)])
  );

  // Conta desativada some de tudo que usa "a equipe". Sem isso o card do
  // Meu Dia mostrava "11º de 11" com nove contas de teste desligadas.
  return perfis
    .filter((p) => p.ativo !== false)
    .map((p) => {
    const vendasDoVendedor = (vendas ?? []).filter((v) => v.owner_id === p.id);

    return {
      id: p.id,
      nome: p.nome,
      empresa: p.empresa,
      ativo: p.ativo ?? true,
      cargo: p.cargo ?? "",
      vendasTotal: vendasDoVendedor.reduce((s, v) => s + Number(v.valor), 0),
      vendasEsteMes: vendasDoVendedor
        .filter((v) => (v.data as string)?.startsWith(mesAtual))
        .reduce((s, v) => s + Number(v.valor), 0),
      vendasMesPassado: vendasDoVendedor
        .filter((v) => (v.data as string)?.startsWith(mesPassado))
        .reduce((s, v) => s + Number(v.valor), 0),
      atividades7dias: mapaAtividades.get(p.id) ?? 0,
      souEu: p.id === user.id,
    };
  });
}
