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
import { importarHistorico } from "@/lib/meta/importar";

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

  // Que contas a pessoa enxerga: o gestor mestre vê todas as conectadas (uma
  // sub-aba por loja); os demais, só a da própria loja.
  const { data: contas } = await sb
    .from("meta_contas_visiveis")
    .select("empresa, nome_usuario, conectada")
    .order("empresa");
  const visiveis = (contas ?? [])
    .filter((c: any) => c.conectada && (auth.gestorMestre || c.empresa === auth.empresa))
    .map((c: any) => ({ empresa: String(c.empresa), usuario: (c.nome_usuario as string) ?? null }));
  const gestor = mandaNaLoja(auth) || auth.gestorMestre;
  return { auth, sb, visiveis, gestor };
}

/** A loja pedida, se a pessoa pode vê-la; senão a primeira que ela vê (ou a dela). */
function lojaPedida(pedida: string | null | undefined, auth: { empresa: string; gestorMestre?: boolean }, visiveis: { empresa: string }[]) {
  if (pedida && (visiveis.some((v) => v.empresa === pedida) || pedida === auth.empresa)) return pedida;
  if (visiveis.some((v) => v.empresa === auth.empresa)) return auth.empresa;
  return visiveis[0]?.empresa ?? auth.empresa;
}

/**
 * GET             → conversas e comentários da loja
 * GET ?conversa=  → mensagens de uma conversa
 */
export async function GET(request: NextRequest) {
  const { erro, auth, sb, visiveis, gestor } = await quemPode();
  if (erro) return erro;

  const sp = request.nextUrl.searchParams;
  const conversa = sp.get("conversa");
  const empresa = lojaPedida(sp.get("empresa"), auth!, visiveis!);

  if (conversa) {
    const { data: dona } = await sb!.from("meta_conversas").select("empresa").eq("id", conversa).maybeSingle();
    if (!dona || !(dona.empresa === auth!.empresa || visiveis!.some((v) => v.empresa === dona.empresa))) {
      return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
    }
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
    sb!.from("meta_contas_visiveis").select("*").eq("empresa", empresa).maybeSingle(),
    sb!
      .from("meta_conversas")
      .select("*")
      .eq("empresa", empresa)
      .eq("ignorado", false)
      .order("ultima_em", { ascending: false, nullsFirst: false })
      .limit(100),
    sb!
      .from("meta_comentarios")
      .select("*")
      .eq("empresa", empresa)
      .order("criado_em", { ascending: false })
      .limit(60),
  ]);

  return NextResponse.json({
    empresa,
    contas: visiveis,
    gestor,
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
  const { erro, auth, sb, visiveis, gestor } = await quemPode();
  if (erro) return erro;

  const body = await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "");
  const empresa = lojaPedida(body.empresa, auth!, visiveis!);

  const conta = await contaDaLoja(empresa);
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
      if (!conversa || conversa.empresa !== empresa) {
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

    if (acao === "importar") {
      if (!gestor) return NextResponse.json({ erro: "Só o gestor puxa o histórico." }, { status: 403 });
      return NextResponse.json({ ok: true, ...(await importarHistorico(conta)) });
    }

    // Comentário de outra loja não se responde daqui.
    if (body.comentario) {
      const { data: dono } = await sb!
        .from("meta_comentarios")
        .select("empresa")
        .eq("comentario_id", String(body.comentario))
        .maybeSingle();
      if (!dono || dono.empresa !== empresa) {
        return NextResponse.json({ erro: "Comentário não encontrado." }, { status: 404 });
      }
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
