import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  apagarComentario,
  contaDaLoja,
  dentroDaJanela,
  enviarMensagem,
  enviarMidia,
  ocultarComentario,
  reagirMensagem,
  responderComentario,
  responderNoPrivado,
  quantoFaltaDaJanela,
  FORA_DA_JANELA,
} from "@/lib/meta/cliente";
import { importarHistorico } from "@/lib/meta/importar";
import { salvarMidia } from "@/lib/meta/midia";
import { registrarEnviada } from "@/lib/meta/conversa";

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
      .select("*")
      .eq("conversa_id", conversa)
      .order("criado_em", { ascending: true })
      .limit(300);
    await sb!.from("meta_conversas").update({ nao_lidas: 0 }).eq("id", conversa);
    // Nome de quem respondeu, para a bolha dizer "Deise" ou "Agente de IA".
    const ids = [...new Set((msgs ?? []).map((m: any) => m.autor_id).filter(Boolean))];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: perfis } = await sb!.from("profiles").select("id, nome").in("id", ids);
      for (const p of perfis ?? []) nomes.set(String(p.id), String(p.nome ?? "").split(" ")[0]);
    }
    return NextResponse.json({
      mensagens: (msgs ?? []).map((m: any) => ({ ...m, autor_nome: m.autor_id ? nomes.get(String(m.autor_id)) ?? null : null })),
    });
  }

  const [{ data: conta }, { data: conversas }, { data: comentarios }, { data: ia }] = await Promise.all([
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
      .limit(80),
    sb!.from("meta_ia_config").select("ativa, esperar_horas").eq("empresa", empresa).maybeSingle(),
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
    comentarios: (comentarios ?? []).filter((c: any) => !c.apagado),
    agente: ia?.ativa ? { ativo: true, horas: Number(ia.esperar_horas ?? 2) } : { ativo: false, horas: 0 },
  });
}

/** A conversa existe e é desta loja? */
async function conversaDaLoja(sb: any, conversaId: string, empresa: string) {
  if (!conversaId) return null;
  const { data } = await sb
    .from("meta_conversas")
    .select("id, cliente_ig_id, responde_ate, empresa")
    .eq("id", conversaId)
    .maybeSingle();
  return data && data.empresa === empresa ? data : null;
}

/**
 * POST — tudo o que se faz no direct e nos comentários.
 *
 * JSON: responder · reagir · pausar_ia · importar · responder_comentario ·
 *       privado_comentario · ocultar_comentario · apagar_comentario
 * FormData (foto, vídeo, áudio): conversa, empresa, arquivo, texto opcional.
 */
export async function POST(request: Request) {
  const { erro, auth, sb, visiveis, gestor } = await quemPode();
  if (erro) return erro;

  const multipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
  const form = multipart ? await request.formData().catch(() => null) : null;
  const body: Record<string, any> = multipart
    ? { acao: "midia", conversa: form?.get("conversa"), empresa: form?.get("empresa"), texto: form?.get("texto") }
    : await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "");
  const empresa = lojaPedida(body.empresa ? String(body.empresa) : null, auth!, visiveis!);

  const conta = await contaDaLoja(empresa);
  if (!conta) {
    return NextResponse.json({ erro: "A conta do Instagram desta loja ainda não está conectada." }, { status: 503 });
  }

  try {
    if (acao === "responder" || acao === "midia") {
      const conversa = await conversaDaLoja(sb, String(body.conversa ?? ""), empresa);
      if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
      // Conferir a janela ANTES de chamar a Meta: assim o vendedor lê o
      // motivo em português em vez de um erro da API.
      if (!dentroDaJanela(conversa.responde_ate)) {
        return NextResponse.json({ erro: FORA_DA_JANELA }, { status: 409 });
      }
      const cliente = String(conversa.cliente_ig_id);
      const texto = String(body.texto ?? "").trim().slice(0, 1000);

      if (acao === "midia") {
        const arquivo = form?.get("arquivo");
        if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Escolha um arquivo." }, { status: 400 });
        const salvo = await salvarMidia(sb!, empresa, arquivo);
        if ("erro" in salvo) return NextResponse.json({ erro: salvo.erro }, { status: 400 });
        const r = await enviarMidia(conta, cliente, salvo.tipo, salvo.url);
        await registrarEnviada(sb!, conversa.id, {
          mid: r?.message_id,
          tipo: salvo.tipo,
          midiaUrl: salvo.url,
          autorId: auth!.userId,
        });
        // Legenda vai como mensagem à parte, logo depois (o direct não tem legenda).
        if (texto) {
          const r2 = await enviarMensagem(conta, cliente, texto);
          await registrarEnviada(sb!, conversa.id, { mid: r2?.message_id, texto, autorId: auth!.userId });
        }
        return NextResponse.json({ ok: true });
      }

      if (!texto) return NextResponse.json({ erro: "Faltou a mensagem." }, { status: 400 });
      const r = await enviarMensagem(conta, cliente, texto);
      await registrarEnviada(sb!, conversa.id, { mid: r?.message_id, texto, autorId: auth!.userId });
      return NextResponse.json({ ok: true });
    }

    if (acao === "reagir") {
      const conversa = await conversaDaLoja(sb, String(body.conversa ?? ""), empresa);
      if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
      const { data: msg } = await sb!
        .from("meta_mensagens")
        .select("id, mid, conversa_id")
        .eq("id", String(body.mensagem ?? ""))
        .maybeSingle();
      if (!msg || msg.conversa_id !== conversa.id || !msg.mid) {
        return NextResponse.json({ erro: "Essa mensagem não pode receber reação." }, { status: 400 });
      }
      if (!dentroDaJanela(conversa.responde_ate)) return NextResponse.json({ erro: FORA_DA_JANELA }, { status: 409 });
      const ligar = body.ligar !== false;
      await reagirMensagem(conta, String(conversa.cliente_ig_id), String(msg.mid), ligar);
      await sb!.from("meta_mensagens").update({ reacao: ligar ? "❤️" : null }).eq("id", msg.id);
      return NextResponse.json({ ok: true });
    }

    if (acao === "pausar_ia") {
      const conversa = await conversaDaLoja(sb, String(body.conversa ?? ""), empresa);
      if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
      await sb!.from("meta_conversas").update({ ia_pausada: Boolean(body.pausada) }).eq("id", conversa.id);
      return NextResponse.json({ ok: true });
    }

    if (acao === "importar") {
      if (!gestor) return NextResponse.json({ erro: "Só o gestor puxa o histórico." }, { status: 403 });
      return NextResponse.json({ ok: true, ...(await importarHistorico(conta)) });
    }

    // Comentário de outra loja não se mexe daqui.
    const comentarioId = String(body.comentario ?? "");
    if (acao.endsWith("_comentario")) {
      const { data: dono } = await sb!
        .from("meta_comentarios")
        .select("empresa")
        .eq("comentario_id", comentarioId)
        .maybeSingle();
      if (!comentarioId || !dono || dono.empresa !== empresa) {
        return NextResponse.json({ erro: "Comentário não encontrado." }, { status: 404 });
      }
    }

    if (acao === "responder_comentario") {
      const texto = String(body.texto ?? "").trim();
      if (!texto) return NextResponse.json({ erro: "Faltou a resposta." }, { status: 400 });
      await responderComentario(conta, comentarioId, texto);
      await sb!.from("meta_comentarios").update({ respondido: true }).eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    if (acao === "privado_comentario") {
      const texto = String(body.texto ?? "").trim();
      if (!texto) return NextResponse.json({ erro: "Faltou a mensagem." }, { status: 400 });
      await responderNoPrivado(conta, comentarioId, texto);
      await sb!
        .from("meta_comentarios")
        .update({ resposta_privada: true, respondido: true })
        .eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    if (acao === "ocultar_comentario") {
      const oculto = Boolean(body.oculto);
      await ocultarComentario(conta, comentarioId, oculto);
      await sb!.from("meta_comentarios").update({ oculto }).eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    if (acao === "apagar_comentario") {
      await apagarComentario(conta, comentarioId);
      await sb!.from("meta_comentarios").update({ apagado: true }).eq("comentario_id", comentarioId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ erro: traduzirErroMeta(e?.message) }, { status: 502 });
  }
}

/** Os recados mais comuns da Meta, em português. */
function traduzirErroMeta(msg: string | undefined) {
  const m = msg ?? "";
  if (/outside of allowed window|24 hour/i.test(m)) return FORA_DA_JANELA;
  if (/private repl(y|ies).*(already|only once)|already.*private/i.test(m))
    return "Esse comentário já recebeu uma resposta privada. A Meta deixa só uma por comentário.";
  if (/7 days|seven days/i.test(m)) return "A resposta privada só vale até 7 dias depois do comentário.";
  if (/media.*(download|fetch)|url.*(invalid|unreachable)/i.test(m))
    return "O Instagram não conseguiu baixar o arquivo. Tente outro formato (foto JPG/PNG, vídeo MP4).";
  return m || "A Meta recusou a operação.";
}
