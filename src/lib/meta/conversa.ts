/**
 * Gravar no AURA o que a loja mandou no direct, seja pelo vendedor ou pelo
 * agente de IA.
 *
 * A mensagem é gravada pelo id que a Meta devolve (mid). O mesmo envio volta
 * pelo webhook como "eco" segundos depois, com o mesmo mid: com a chave
 * única, os dois caminhos caem na mesma linha e nada duplica.
 */
import type { getSupabaseServiceClient } from "@/lib/supabase/service";
import { resumoDaMidia } from "./midia";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

export async function registrarEnviada(
  sb: ClienteServico,
  conversaId: string,
  m: {
    mid?: string | null;
    texto?: string;
    tipo?: string;
    midiaUrl?: string | null;
    porIa?: boolean;
    autorId?: string | null;
  },
) {
  const linha = {
    conversa_id: conversaId,
    mid: m.mid ?? null,
    de_mim: true,
    texto: m.texto ?? "",
    tipo: m.tipo ?? "text",
    midia_url: m.midiaUrl ?? null,
    por_ia: Boolean(m.porIa),
    autor_id: m.autorId ?? null,
  };
  if (linha.mid) await sb.from("meta_mensagens").upsert(linha, { onConflict: "mid" });
  else await sb.from("meta_mensagens").insert(linha);

  const resumo = (m.texto ?? "").trim() || resumoDaMidia(m.tipo ?? "text");
  const patch: Record<string, unknown> = {
    ultima_mensagem: (m.porIa ? `🤖 ${resumo}` : resumo).slice(0, 200),
    ultima_em: new Date().toISOString(),
    nao_lidas: 0,
  };
  if (m.porIa) patch.ia_respondeu_em = new Date().toISOString();
  await sb.from("meta_conversas").update(patch).eq("id", conversaId);
}
