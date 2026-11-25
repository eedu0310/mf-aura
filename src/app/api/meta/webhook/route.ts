import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { contaDaLoja, perfilDoCliente } from "@/lib/meta/cliente";
import { registrarAviso } from "@/lib/meta/registro";
import { resumoDaMidia } from "@/lib/meta/midia";
import { agenteNaHora } from "@/lib/meta/agente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Onde a Meta avisa o AURA.
 *
 * Este endereço é público por obrigação — a Meta precisa alcançá-lo — então
 * ele não pode confiar em quem bate. Duas travas:
 *
 *  1. No cadastro, a Meta manda um desafio e espera o eco. Só responde quem
 *     souber o verify token combinado.
 *  2. Em cada aviso vem a assinatura X-Hub-Signature-256, feita com o segredo
 *     do aplicativo. Sem conferir isso, qualquer um na internet inventaria
 *     mensagens de clientes dentro do CRM de vocês.
 */

const JANELA_MS = 24 * 3600_000;

/** GET — o aperto de mão do cadastro do webhook no painel da Meta. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const esperado = process.env.META_VERIFY_TOKEN;
  if (!esperado) return new NextResponse("META_VERIFY_TOKEN não configurado.", { status: 503 });

  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === esperado) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Não autorizado.", { status: 403 });
}

/** A assinatura bate com o corpo recebido? */
function assinaturaConfere(corpoCru: string, assinatura: string | null) {
  const segredo = process.env.META_APP_SECRET;
  if (!segredo) return false;
  if (!assinatura?.startsWith("sha256=")) return false;
  const nosso = "sha256=" + crypto.createHmac("sha256", segredo).update(corpoCru, "utf8").digest("hex");
  // timingSafeEqual exige o mesmo tamanho; comparar direto vazaria tempo.
  const a = Buffer.from(nosso);
  const b = Buffer.from(assinatura);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** A loja dona da conta que recebeu o aviso. */
async function lojaDaConta(igUserId: string): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb.from("meta_contas").select("empresa").eq("ig_user_id", igUserId).maybeSingle();
  return data?.empresa ?? null;
}

/** Coração (ou outro emoji) que alguém pôs ou tirou de uma mensagem. */
async function guardarReacao(igUserId: string, evento: any) {
  const sb = getSupabaseServiceClient();
  const r = evento?.reaction;
  if (!sb || !r?.mid) return;
  const daLoja = String(evento?.sender?.id ?? "") === igUserId;
  const valor = r.action === "unreact" ? null : r.emoji || (r.reaction === "love" ? "❤️" : r.reaction ?? "❤️");
  await sb
    .from("meta_mensagens")
    .update(daLoja ? { reacao: valor } : { reacao_cliente: valor })
    .eq("mid", String(r.mid));
}

async function guardarMensagem(empresa: string, igUserId: string, evento: any) {
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  if (evento?.reaction) return guardarReacao(igUserId, evento);

  // O cliente desfez o envio: fica o aviso no lugar.
  if (evento?.message?.is_deleted && evento?.message?.mid) {
    await sb
      .from("meta_mensagens")
      .update({ texto: "(mensagem apagada pelo cliente)", midia_url: null, tipo: "text" })
      .eq("mid", String(evento.message.mid));
    return;
  }

  const daLoja = evento?.message?.is_echo === true || String(evento?.sender?.id ?? "") === igUserId;
  const clienteId = daLoja ? evento?.recipient?.id : evento?.sender?.id;
  const anexo = evento?.message?.attachments?.[0];
  const texto: string = evento?.message?.text ?? "";
  const resumo = texto || (anexo ? resumoDaMidia(String(anexo.type ?? "")) : "");
  const mid: string | undefined = evento?.message?.mid;
  if (!clienteId || !mid) return;

  const conta = await contaDaLoja(empresa);
  if (!conta) return;

  const { data: existente } = await sb
    .from("meta_conversas")
    .select("id, cliente_nome")
    .eq("conta_id", conta.id)
    .eq("ig_thread_id", clienteId)
    .maybeSingle();

  // A janela de 24h só reinicia quando quem escreve é o cliente.
  const respondeAte = daLoja ? undefined : new Date(Date.now() + JANELA_MS).toISOString();

  let conversaId = existente?.id;
  if (!conversaId) {
    const perfil = await perfilDoCliente(conta, clienteId);
    const { data: nova } = await sb
      .from("meta_conversas")
      .insert({
        empresa,
        conta_id: conta.id,
        ig_thread_id: clienteId,
        cliente_ig_id: clienteId,
        cliente_nome: perfil.nome,
        cliente_usuario: perfil.usuario,
        cliente_foto: perfil.foto,
        ultima_mensagem: resumo.slice(0, 200),
        ultima_em: new Date().toISOString(),
        nao_lidas: daLoja ? 0 : 1,
        responde_ate: respondeAte ?? null,
      })
      .select("id")
      .maybeSingle();
    conversaId = nova?.id;
  } else {
    // O eco do que o AURA mandou já foi gravado (com o 🤖 do agente, se
    // for o caso); só a resposta dada pelo celular atualiza o resumo.
    const { data: jaTem } = daLoja
      ? await sb.from("meta_mensagens").select("id").eq("mid", mid).maybeSingle()
      : { data: null };
    const patch: Record<string, unknown> = jaTem
      ? {}
      : { ultima_mensagem: resumo.slice(0, 200), ultima_em: new Date().toISOString() };
    if (respondeAte) patch.responde_ate = respondeAte;
    if (!daLoja) patch.nao_lidas = (await contarNaoLidas(conversaId)) + 1;
    if (Object.keys(patch).length) await sb.from("meta_conversas").update(patch).eq("id", conversaId);
  }
  if (!conversaId) return;

  await sb.from("meta_mensagens").upsert(
    {
      conversa_id: conversaId,
      mid,
      de_mim: daLoja,
      texto,
      tipo: anexo?.type ?? "text",
      midia_url: anexo?.payload?.url ?? null,
      criado_em: new Date(Number(evento?.timestamp) || Date.now()).toISOString(),
    },
    { onConflict: "mid" },
  );

  // Fora do horário da loja o agente de IA pode responder já (se ligado).
  if (!daLoja) void agenteNaHora(conversaId).catch(() => {});
}

async function contarNaoLidas(conversaId: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return 0;
  const { data } = await sb.from("meta_conversas").select("nao_lidas").eq("id", conversaId).maybeSingle();
  return Number(data?.nao_lidas ?? 0);
}

async function guardarComentario(empresa: string, igUserId: string, valor: any) {
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  const conta = await contaDaLoja(empresa);
  if (!conta || !valor?.id) return;
  // Resposta da própria loja: marca o comentário-pai como respondido.
  if (valor?.from?.id && String(valor.from.id) === igUserId) {
    if (valor?.parent_id) {
      await sb.from("meta_comentarios").update({ respondido: true }).eq("comentario_id", String(valor.parent_id));
    }
    return;
  }

  await sb.from("meta_comentarios").upsert(
    {
      empresa,
      conta_id: conta.id,
      comentario_id: String(valor.id),
      post_id: valor?.media?.id ?? null,
      post_url: valor?.media?.media_url ?? null,
      autor_usuario: valor?.from?.username ?? null,
      texto: valor?.text ?? "",
      criado_em: valor?.timestamp ? new Date(Number(valor.timestamp) * (String(valor.timestamp).length <= 10 ? 1000 : 1)).toISOString() : new Date().toISOString(),
    },
    { onConflict: "comentario_id" },
  );
}

/** POST — as mensagens e os comentários que a Meta empurra. */
export async function POST(request: Request) {
  const corpoCru = await request.text();
  let corpo: any = {};
  try {
    corpo = JSON.parse(corpoCru);
  } catch {
    corpo = {};
  }
  const envelope = {
    em: new Date().toISOString(),
    objeto: corpo?.object ?? null,
    contas: (corpo?.entry ?? []).map((e: any) => String(e?.id ?? "")),
    campos: (corpo?.entry ?? []).flatMap((e: any) => [
      ...(e?.messaging?.length ? ["messaging"] : []),
      ...(e?.changes ?? []).map((c: any) => String(c?.field ?? "?")),
    ]),
  };

  if (!assinaturaConfere(corpoCru, request.headers.get("x-hub-signature-256"))) {
    registrarAviso({ ...envelope, assinaturaOk: false, lojas: [], erro: "assinatura não confere (META_APP_SECRET?)" });
    return new NextResponse("Assinatura inválida.", { status: 401 });
  }

  // A Meta reenvia o aviso se não receber 200 rápido. Por isso respondemos já
  // e processamos depois: um erro nosso não pode virar uma enxurrada de
  // reenvios nem mensagem duplicada (o upsert por mid também protege disso).
  void (async () => {
    const lojas: (string | null)[] = [];
    try {
      for (const entrada of corpo?.entry ?? []) {
        const igUserId = String(entrada?.id ?? "");
        const empresa = await lojaDaConta(igUserId);
        lojas.push(empresa);
        if (!empresa) continue;

        for (const evento of entrada?.messaging ?? []) {
          await guardarMensagem(empresa, igUserId, evento);
        }
        for (const mudanca of entrada?.changes ?? []) {
          if (mudanca?.field === "comments") await guardarComentario(empresa, igUserId, mudanca.value);
          // Algumas contas mandam a DM como "change" e não em "messaging".
          if (mudanca?.field === "messages" || mudanca?.field === "message_reactions")
            await guardarMensagem(empresa, igUserId, mudanca.value);
        }
      }
      registrarAviso({ ...envelope, assinaturaOk: true, lojas });
    } catch (e: any) {
      registrarAviso({ ...envelope, assinaturaOk: true, lojas, erro: e?.message ?? String(e) });
      console.error("[meta/webhook]", e?.message ?? e);
    }
  })();

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
