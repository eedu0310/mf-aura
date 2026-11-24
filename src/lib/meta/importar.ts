/**
 * Puxa para o AURA o que já existe no Instagram da loja: as conversas
 * recentes do direct e os comentários das últimas publicações.
 *
 * O webhook só traz o que acontece depois da conexão; sem isto a caixa abria
 * vazia mesmo com dezenas de conversas na conta. Pode rodar de novo à
 * vontade: conversa, mensagem e comentário são gravados por id da Meta, então
 * não duplicam.
 */
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { paginaDaConta, tentar, type ContaMeta, type Opcao } from "@/lib/meta/cliente";

const JANELA_MS = 24 * 3600_000;

interface Resumo {
  conversas: number;
  mensagens: number;
  comentarios: number;
  avisos: string[];
}

export async function importarHistorico(conta: ContaMeta): Promise<Resumo> {
  const resumo: Resumo = { conversas: 0, mensagens: 0, comentarios: 0, avisos: [] };
  const sb = getSupabaseServiceClient();
  if (!sb) {
    resumo.avisos.push("Serviço indisponível.");
    return resumo;
  }
  const ig = conta.igUserId ?? "me";

  // --- Direct ---------------------------------------------------------------
  const camposConversa =
    "fields=id,updated_time,participants,messages.limit(25){id,created_time,from,to,message,attachments{image_data,video_data,file_url,mime_type}}&limit=40";
  // Pelo login do Facebook as conversas moram na Página ligada ao Instagram.
  const pagina = await paginaDaConta(conta);
  const opcoesConversa: Opcao[] = [];
  if (pagina.ok)
    opcoesConversa.push({ host: "fb", caminho: `${pagina.id}/conversations?platform=instagram&${camposConversa}`, token: pagina.token });
  opcoesConversa.push(
    { host: "fb", caminho: `${ig}/conversations?platform=instagram&${camposConversa}` },
    { host: "ig", caminho: `me/conversations?platform=instagram&${camposConversa}` },
  );
  const conversas = await tentar<{ data?: any[] }>(opcoesConversa, conta.token);
  if (!pagina.ok) resumo.avisos.push(`Página: ${pagina.erros.join(" | ")}`);
  if (!conversas.ok) {
    resumo.avisos.push(`Conversas: ${conversas.erros.join(" | ")}`);
  } else {
    for (const c of conversas.dados.data ?? []) {
      const outro = (c.participants?.data ?? []).find((p: any) => String(p.id) !== String(conta.igUserId));
      if (!outro?.id) continue;
      const msgs: any[] = c.messages?.data ?? [];
      const ultima = msgs[0];
      const ultimaDoCliente = msgs.find((m) => String(m.from?.id) === String(outro.id));
      const respondeAte = ultimaDoCliente
        ? new Date(new Date(ultimaDoCliente.created_time).getTime() + JANELA_MS).toISOString()
        : null;

      const { data: conv, error } = await sb
        .from("meta_conversas")
        .upsert(
          {
            empresa: conta.empresa,
            conta_id: conta.id,
            ig_thread_id: String(outro.id),
            cliente_ig_id: String(outro.id),
            cliente_usuario: outro.username ?? null,
            ultima_mensagem: (ultima?.message ?? (ultima?.attachments ? "[anexo]" : "")).slice(0, 200),
            ultima_em: ultima?.created_time ?? c.updated_time ?? new Date().toISOString(),
            responde_ate: respondeAte,
          },
          { onConflict: "conta_id,ig_thread_id" },
        )
        .select("id")
        .maybeSingle();
      if (error || !conv) {
        resumo.avisos.push(`Conversa ${outro.username ?? outro.id}: ${error?.message ?? "não gravou"}`);
        continue;
      }
      resumo.conversas++;

      const linhas = msgs
        .filter((m) => m.id)
        .map((m) => {
          const anexo = m.attachments?.data?.[0];
          const url = anexo?.image_data?.url ?? anexo?.video_data?.url ?? anexo?.file_url ?? null;
          const tipo = anexo?.image_data ? "image" : anexo?.video_data ? "video" : anexo ? "file" : "text";
          return {
            conversa_id: conv.id,
            mid: String(m.id),
            de_mim: String(m.from?.id) !== String(outro.id),
            texto: m.message ?? "",
            tipo,
            midia_url: url,
            criado_em: m.created_time,
          };
        });
      if (linhas.length) {
        const { error: e2 } = await sb.from("meta_mensagens").upsert(linhas, { onConflict: "mid", ignoreDuplicates: true });
        if (e2) resumo.avisos.push(`Mensagens de ${outro.username ?? outro.id}: ${e2.message}`);
        else resumo.mensagens += linhas.length;
      }
    }
  }

  // --- Comentários das últimas publicações -----------------------------------
  const camposMidia =
    "fields=id,permalink,timestamp,comments.limit(50){id,text,username,timestamp,from,replies{from}}&limit=15";
  const midias = await tentar<{ data?: any[] }>(
    [
      { host: "fb", caminho: `${ig}/media?${camposMidia}` },
      { host: "ig", caminho: `me/media?${camposMidia}` },
    ],
    conta.token,
  );
  if (!midias.ok) {
    resumo.avisos.push(`Comentários: ${midias.erros.join(" | ")}`);
  } else {
    const linhas: Record<string, unknown>[] = [];
    for (const m of midias.dados.data ?? []) {
      for (const c of m.comments?.data ?? []) {
        // O comentário da própria loja não precisa de resposta.
        if (c.from?.id && String(c.from.id) === String(conta.igUserId)) continue;
        const respondido = (c.replies?.data ?? []).some((r: any) => String(r.from?.id) === String(conta.igUserId));
        linhas.push({
          empresa: conta.empresa,
          conta_id: conta.id,
          comentario_id: String(c.id),
          post_id: String(m.id),
          post_url: m.permalink ?? null,
          autor_usuario: c.username ?? c.from?.username ?? null,
          texto: c.text ?? "",
          respondido,
          criado_em: c.timestamp ?? m.timestamp,
        });
      }
    }
    if (linhas.length) {
      const { error } = await sb.from("meta_comentarios").upsert(linhas, { onConflict: "comentario_id" });
      if (error) resumo.avisos.push(`Comentários: ${error.message}`);
      else resumo.comentarios = linhas.length;
    }
  }

  return resumo;
}
