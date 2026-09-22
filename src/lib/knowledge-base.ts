import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna o vector_store_id salvo para a empresa, criando um novo na OpenAI
 * (e salvando no Supabase) se ainda não existir.
 */
export async function getOrCreateVectorStore(
  supabase: SupabaseClient,
  openai: OpenAI,
  empresa: string
): Promise<string> {
  const { data } = await supabase
    .from("playbook")
    .select("vector_store_id")
    .eq("empresa", empresa)
    .maybeSingle();

  if (data?.vector_store_id) {
    return data.vector_store_id as string;
  }

  const vectorStore = await openai.vectorStores.create({
    name: `AURA - ${empresa}`,
  });

  await supabase
    .from("playbook")
    .upsert({ empresa, vector_store_id: vectorStore.id }, { onConflict: "empresa" });

  return vectorStore.id;
}
