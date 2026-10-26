import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { LOGO_MF, caminhoDaCopia } from "@/lib/site-mf/materiais";

/**
 * Troca o endereço do Bitrix pela cópia na AURA, quando ela já existe.
 * Uma consulta à pasta por página; se a pasta não responder, fica o
 * endereço antigo (a página nunca quebra por causa disso).
 */
export async function fotosCopiadas(): Promise<(url: string) => string> {
  const sb = getSupabaseServiceClient();
  const copiadas = new Set<string>();
  if (sb) {
    const { data } = await sb.storage.from("site").list("materiais", { limit: 1000 });
    for (const a of data ?? []) copiadas.add(`materiais/${a.name}`);
  }
  return (url: string) => {
    const caminho = caminhoDaCopia(url);
    if (!sb || !caminho || !copiadas.has(caminho)) return url;
    return sb.storage.from("site").getPublicUrl(caminho).data.publicUrl;
  };
}

/** Logo do topo das páginas: o que a equipe pôs no chat, ou o logo branco da MF. */
export async function logoDasPaginas(foto: (url: string) => string): Promise<string> {
  const sb = getSupabaseServiceClient();
  const { data } = sb
    ? await sb.from("site_chat_config").select("logo_url").eq("empresa", "MF International").maybeSingle()
    : { data: null };
  return foto((data?.logo_url as string | null) || LOGO_MF);
}
