import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  contaDaLoja,
  dentroDaJanela,
  enviarMensagem,
  ocultarComentario,
  responderComentario,
  quantoFaltaDaJanela,
  FORA_DA_JANELA,
} from "@/lib/meta/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O Instagram do vendedor.
 *
 * Só entra quem o gestor liberou: a permissão `usar_instagram` é por pessoa,
 * porque em cada loja quem responde é o vendedor interno. Sem ela, a rota
 * recusa — não basta esconder o item no menu, senão bastaria digitar o
 * endereço para ver a caixa de entrada da loja.
 */
async function quemPode() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb.from("profiles").select("permissoes").eq("id", auth.userId).maybeSingle();
  /**
   * Antes, o cargo cru liberava: `["Gestor","Diretor"].includes(cargo)`. Como
   * qualquer pessoa escolhe "Gestor" na tela de cadastro e a conta nasce
   * esperando aprovação, bastava se cadastrar como gestor para ler e responder
   * a caixa de Instagram da loja inteira antes de alguém aprovar.
   *
   * mandaNaLoja exige cargo Gestor E gestor_aprovado — é a régua única do
   * sistema. O gestor mestre passa por cima, como em todo lugar.
   */
  const liberado =
    Boolean((eu?.permissoes ?? {}).usar_instagram) || mandaNaLoja(auth) || auth.gestorMestre;
  if (!liberado) {
    return { erro: NextResponse.json({ erro: "Seu gestor ainda não liberou o Instagram para você." }, { status: 403 }) };
  }
  return { auth, sb };
}

/**
 * GET             → conversas e comentários da loja
 * GET ?conversa=  → mensagens de uma conversa
 */
export async function GET(request: NextRequest) {
  const { erro, auth, sb } = await quemPode();
  if (erro) return erro;

  const sp = request.nextUrl.searchParams;
  const conversa = sp.get("conversa");

  if (conversa) {
    const { data: msgs } = await sb!
      .from("meta_mensagens")
      .select("id, mid, de_mim, texto, tipo, midia_url, criado_em")
      .eq("conversa_id", conversa)
      .order("criado_em", { ascending: true })
      .limit(300);
    await sb!.from("meta_conversas").update({ nao_lidas: 0 }).eq("id", conversa);
    return NextResponse.json({ mensagens: msgs ?? [] });
  }

  const [{ data: conta }, { data: conversas }, { data: comentarios }] = await Promise.all([
    sb!.from("meta_contas_visiveis").select("*").eq("empresa", auth!.empresa).maybeSingle(),
    sb!
      .from("meta_conversas")
      .select("*")
      .eq("empresa", auth!.empresa)
      .eq("ignorado", false)
      .order("ultima_em", { ascending: false, nullsFirst: false })
      .limit(100),
    sb!
      .from("meta_comentarios")
      .select("*")
      .eq("empresa", auth!.empresa)
      .order("criado_em", { ascending: false })
      .limit(60),
  ]);

  return NextResponse.json({
    conectada: Boolean(conta?.conectada),
    usuario: conta?.nome_usuario ?? null,
    conversas: (conversas ?? []).map((c: any) => ({
      ...c,
      podeResponder: dentroDaJanela(c.responde_ate),
      prazo: quantoFaltaDaJanela(c.responde_ate),
    })),
    comentarios: comentarios ?? [],
  });
}

/** POST — responder uma DM, responder ou ocultar um comentário. */
export async function POST(request: Request) {
  const { erro, auth, sb } = await quemPode();
  if (erro) return erro;

  const body = await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "");

  const conta = await contaDaLoja(auth!.empresa);
  if (!conta) {
    return NextResponse.json({ erro: "A conta do Instagram desta loja ainda não está conectada." }, { status: 503 });
  }

  try {
    if (acao === "responder") {
      const texto = String(body.texto ?? "").trim();
      const conversaId = String(body.conversa ?? "");
      if (!texto || !conversaId) return NextResponse.json({ erro: "Faltou a mensagem." }, { status: 400 });

      const { data: conversa } = await sb!
        .from("meta_conversas")
        .select("id, cliente_ig_id, responde_ate, empresa")
        .eq("id", conversaId)
        .maybeSingle();
      if (!conversa || conversa.empresa !== auth!.empresa) {
        return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
      }
      // Conferir a janela ANTES de chamar a Meta: assim o vendedor lê o
      // motivo em português em vez de um erro da API.
      if (!dentroDaJanela(conversa.responde_ate)) {
        return NextResponse.json({ erro: FORA_DA_JANELA }, { status: 409 });
      }

      await enviarMensagem(conta, String(conversa.cliente_ig_id), texto);
      await sb!.from("meta_mensagens").insert({
        conversa_id: conversaId,
        de_mim: true,
        texto,
        tipo: "text",
      });
      await sb!
        .from("meta_conversas")
        .update({ ultima_mensagem: texto.slice(0, 200), ultima_em: new Date().toISOString(), nao_lidas: 0 })
        .eq("id", conversaId);
      return NextResponse.json({ ok: true });
    }

    if (acao === "responder_comentario") {
      const texto = String(body.texto ?? "").trim();
      const comentarioId = String(body.comentario ?? "");
      if (!texto || !comentarioId) return NextResponse.json({ erro: "Faltou a resposta." }, { status: 400 });
      await responderComentario(conta, comentarioId, texto);
      await sb!.from("meta_comentarios").update({ respondido: true }).eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    if (acao === "ocultar_comentario") {
      const comentarioId = String(body.comentario ?? "");
      const oculto = Boolean(body.oculto);
      await ocultarComentario(conta, comentarioId, oculto);
      await sb!.from("meta_comentarios").update({ oculto }).eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "A Meta recusou a operação." }, { status: 502 });
  }
}
