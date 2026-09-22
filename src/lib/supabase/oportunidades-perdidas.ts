import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MotivoPerda } from "@/lib/types";

export async function marcarOportunidadeComoPerdida(
  oportunidadeId: string,
  motivo: MotivoPerda,
  descricao: string = ""
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("oportunidades")
      .update({
        etapa: "Perdidos",
        motivo_perda: motivo,
        descricao_perda: descricao || null,
        data_perda: new Date().toISOString(),
      })
      .eq("id", oportunidadeId);

    if (error) {
      console.error("Erro ao marcar como perdido:", error);
      return false;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao marcar oportunidade como perdida:", erro);
    return false;
  }
}

export async function recuperarOportunidade(oportunidadeId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("oportunidades")
      .update({
        etapa: "Prospecção",
        motivo_perda: null,
        descricao_perda: null,
        data_perda: null,
      })
      .eq("id", oportunidadeId);

    if (error) {
      console.error("Erro ao recuperar oportunidade:", error);
      return false;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao recuperar oportunidade:", erro);
    return false;
  }
}

export async function listarOportunidadesPerdidas(): Promise<any[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("etapa", "Perdidos")
      .order("data_perda", { ascending: false });

    if (error) {
      console.error("Erro ao listar perdidas:", error);
      return [];
    }

    return data || [];
  } catch (erro) {
    console.error("Erro ao listar oportunidades perdidas:", erro);
    return [];
  }
}