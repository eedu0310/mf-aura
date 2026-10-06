import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MotivoPerda } from "@/lib/types";
import { FUNIL_PADRAO, nomeDaChave, primeiraEtapa, type EtapaFunil } from "@/lib/funil";

export async function marcarOportunidadeComoPerdida(
  oportunidadeId: string,
  motivo: MotivoPerda,
  descricao: string = "",
  funil: EtapaFunil[] = FUNIL_PADRAO,
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("oportunidades")
      .update({
        etapa: nomeDaChave("perda", funil) ?? "Perdidos",
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

/**
 * Tira o negócio de Perdidos e devolve ele ao começo do funil.
 *
 * A etapa era "Prospecção" escrita à mão — e sem sequer receber o funil, o que
 * escondia o problema: numa loja que renomeasse a primeira etapa, o negócio
 * recuperado ia para uma coluna que não existe. Ele sumia do quadro E saía de
 * Perdidos, então também não voltava para a lista de perdidos. Desaparecia
 * dos dois lugares ao mesmo tempo.
 *
 * Volta para a PRIMEIRA etapa aberta do funil da loja, que é o mesmo lugar
 * onde um negócio novo nasce — recuperar é recomeçar.
 */
export async function recuperarOportunidade(
  oportunidadeId: string,
  funil: EtapaFunil[] = FUNIL_PADRAO,
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("oportunidades")
      .update({
        etapa: primeiraEtapa(funil),
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

export async function listarOportunidadesPerdidas(
  funil: EtapaFunil[] = FUNIL_PADRAO,
): Promise<any[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("etapa", nomeDaChave("perda", funil) ?? "Perdidos")
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