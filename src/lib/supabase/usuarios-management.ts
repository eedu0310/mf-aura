import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Usuario {
  id: string;
  nome: string;
  email?: string;
  cargo: string;
  empresa: string;
  ativo: boolean;
  criadoEm: string;
}

export async function listarUsuariosPorEmpresa(empresa: string): Promise<Usuario[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    console.error("Supabase não disponível");
    return [];
  }

  if (!empresa) {
    console.error("Empresa não foi passada");
    return [];
  }

  try {

    // Buscar dados da tabela profiles
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cargo, empresa, ativo, created_at")
      .eq("empresa", empresa)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao listar usuários:", error);
      return [];
    }


    if (!data || data.length === 0) {
      console.warn("Nenhum usuário encontrado para:", empresa);
      return [];
    }

    // Mapear os dados
    return data.map((u: any) => ({
      id: u.id,
      nome: u.nome || "Sem nome",
      cargo: u.cargo || "Sem cargo",
      empresa: u.empresa,
      ativo: u.ativo !== false,
      criadoEm: u.created_at || new Date().toISOString(),
    }));
  } catch (erro) {
    console.error("Erro ao conectar:", erro);
    return [];
  }
}

export async function criarUsuario(
  email: string,
  nome: string,
  cargo: string,
  empresa: string,
  senha: string
): Promise<{ sucesso: boolean; mensagem: string; usuarioId?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { sucesso: false, mensagem: "Supabase não disponível" };

  try {

    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          cargo,
          empresa,
        },
      },
    });

    if (authError) {
      console.error("Erro ao criar auth:", authError);
      return { sucesso: false, mensagem: authError.message };
    }

    if (!authData.user) {
      return { sucesso: false, mensagem: "Erro ao criar usuário" };
    }


    // Criar perfil na tabela profiles (SEM email, pois ele fica no auth)
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        nome,
        cargo,
        empresa,
        ativo: true,
      })
      .select();

    if (profileError) {
      console.error("Erro ao criar perfil:", profileError);
      return { sucesso: false, mensagem: profileError.message };
    }


    return {
      sucesso: true,
      mensagem: "Usuário criado com sucesso!",
      usuarioId: authData.user.id,
    };
  } catch (erro: any) {
    console.error("Erro geral:", erro);
    return { sucesso: false, mensagem: erro.message };
  }
}

export async function excluirUsuario(usuarioId: string): Promise<{
  sucesso: boolean;
  mensagem: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { sucesso: false, mensagem: "Supabase não disponível" };

  try {

    // Desativar no perfil
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ ativo: false })
      .eq("id", usuarioId);

    if (profileError) {
      console.error("Erro ao desativar:", profileError);
      return { sucesso: false, mensagem: profileError.message };
    }

    return { sucesso: true, mensagem: "Usuário desativado com sucesso!" };
  } catch (erro: any) {
    console.error("Erro geral:", erro);
    return { sucesso: false, mensagem: erro.message };
  }
}

export async function atualizarCargoUsuario(
  usuarioId: string,
  novoCargo: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { sucesso: false, mensagem: "Supabase não disponível" };

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ cargo: novoCargo })
      .eq("id", usuarioId);

    if (error) {
      return { sucesso: false, mensagem: error.message };
    }

    return { sucesso: true, mensagem: "Cargo atualizado com sucesso!" };
  } catch (erro: any) {
    return { sucesso: false, mensagem: erro.message };
  }
}