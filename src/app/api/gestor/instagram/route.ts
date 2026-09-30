import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Conexão do Instagram por loja, e quem atende cada uma.
 *
 * São quatro contas — MF International (fábrica), Sole, A&G e LF — e em cada
 * loja só o vendedor interno responde. Por isso a liberação é por pessoa, com
 * a permissão `usar_instagram`, e não por cargo.
 *
 * O token nunca sai daqui: a tela lê a visão `meta_contas_visiveis`, que diz
 * apenas se a conta está conectada. Quem grava e quem usa o token é o
 * servidor, com o cliente de serviço.
 */
const LOJAS = ["MF International", "LF Lareiras", "A&G Aquecimento", "Sole Aquecimento"];

async function somenteMestre() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb.from("profiles").select("gestor_mestre").eq("id", auth.userId).maybeSingle();
  if (!eu?.gestor_mestre) {
    return { erro: NextResponse.json({ erro: "Só um gestor mestre conecta contas e libera acesso." }, { status: 403 }) };
  }
  return { auth, sb };
}

/** GET — as quatro lojas, se estão conectadas, e quem atende cada uma. */
export async function GET() {
  const { erro, sb } = await somenteMestre();
  if (erro) return erro;

  const [{ data: contas }, { data: pessoas }] = await Promise.all([
    sb!.from("meta_contas_visiveis").select("*"),
    sb!
      .from("profiles")
      .select("id, nome, cargo, empresa, ativo, permissoes")
      .eq("ativo", true)
      .order("empresa")
      .order("nome"),
  ]);

  const porLoja = LOJAS.map((loja) => {
    const conta = (contas ?? []).find((c: any) => c.empresa === loja) ?? null;
    return {
      empresa: loja,
      conectada: Boolean(conta?.conectada),
      usuario: conta?.nome_usuario ?? null,
      conectadaEm: conta?.conectado_em ?? null,
      expiraEm: conta?.token_expira_em ?? null,
      equipe: (pessoas ?? [])
        .filter((p: any) => p.empresa === loja)
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          cargo: p.cargo,
          atende: Boolean((p.permissoes ?? {}).usar_instagram),
        })),
    };
  });

  return NextResponse.json({ lojas: porLoja });
}

/** POST — conecta (ou atualiza) a conta de uma loja com o token da Meta. */
export async function POST(request: Request) {
  const { erro, auth, sb } = await somenteMestre();
  if (erro) return erro;

  const body = await request.json().catch(() => ({}));
  const empresa = String(body.empresa ?? "").trim();
  const token = String(body.token ?? "").trim();
  const usuario = String(body.usuario ?? "").trim() || null;

  if (!LOJAS.includes(empresa)) return NextResponse.json({ erro: "Loja inválida." }, { status: 400 });
  if (token.length < 20) return NextResponse.json({ erro: "Token muito curto — confira se copiou inteiro." }, { status: 400 });

  // O token de longa duração da Meta vale 60 dias. Guardamos o vencimento
  // para a tela avisar antes de a conta cair sozinha num sábado.
  const expira = new Date(Date.now() + 60 * 86400_000).toISOString();

  const { error } = await sb!.from("meta_contas").upsert(
    {
      empresa,
      token,
      nome_usuario: usuario,
      token_expira_em: expira,
      conectado_em: new Date().toISOString(),
      conectado_por: auth!.userId,
      ativo: true,
    },
    { onConflict: "empresa" },
  );
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PATCH — liga ou desliga o atendimento do Instagram para uma pessoa. */
export async function PATCH(request: Request) {
  const { erro, sb } = await somenteMestre();
  if (erro) return erro;

  const body = await request.json().catch(() => ({}));
  const pessoaId = String(body.pessoaId ?? "").trim();
  const atende = Boolean(body.atende);
  if (!pessoaId) return NextResponse.json({ erro: "Pessoa não informada." }, { status: 400 });

  const { data: pessoa } = await sb!.from("profiles").select("permissoes").eq("id", pessoaId).maybeSingle();
  if (!pessoa) return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });

  const permissoes = { ...((pessoa.permissoes as Record<string, unknown>) ?? {}), usar_instagram: atende };
  const { error } = await sb!.from("profiles").update({ permissoes }).eq("id", pessoaId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE — desconecta a conta da loja. As conversas ficam no histórico. */
export async function DELETE(request: Request) {
  const { erro, sb } = await somenteMestre();
  if (erro) return erro;
  const empresa = String(new URL(request.url).searchParams.get("empresa") ?? "").trim();
  if (!LOJAS.includes(empresa)) return NextResponse.json({ erro: "Loja inválida." }, { status: 400 });

  const { error } = await sb!
    .from("meta_contas")
    .update({ token: null, ativo: false, nome_usuario: null, token_expira_em: null })
    .eq("empresa", empresa);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
