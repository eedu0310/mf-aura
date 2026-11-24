import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { contaDaLoja, ligarAvisos, paginaDaConta, tentar, type Opcao } from "@/lib/meta/cliente";
import { importarHistorico } from "@/lib/meta/importar";
import { ultimosAvisos } from "@/lib/meta/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Diagnóstico do Instagram de uma loja (só o gestor mestre).
 *
 * GET  ?empresa=LF Lareiras → o que a Meta responde com o token gravado, se
 *      a conta está assinando os avisos e os últimos avisos que chegaram.
 * POST ?empresa=...&acao=assinar  → liga os avisos de novo.
 * POST ?empresa=...&acao=importar → puxa conversas e comentários recentes.
 *
 * Nunca devolve o token.
 */
async function preparar(request: NextRequest) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!auth.gestorMestre) return { erro: NextResponse.json({ erro: "Só o gestor mestre." }, { status: 403 }) };
  const empresa = request.nextUrl.searchParams.get("empresa") ?? "";
  const conta = await contaDaLoja(empresa);
  if (!conta) return { erro: NextResponse.json({ erro: `A ${empresa || "loja"} não tem Instagram conectado.` }, { status: 404 }) };
  return { conta };
}

export async function GET(request: NextRequest) {
  const { erro, conta } = await preparar(request);
  if (erro) return erro;
  const ig = conta!.igUserId ?? "me";
  const pagina = await paginaDaConta(conta!);
  const pelaPagina = (caminho: string): Opcao[] =>
    pagina.ok ? [{ host: "fb", caminho: caminho.replace("{pagina}", pagina.id), token: pagina.token }] : [];

  const [perfil, assinatura, assinaturaPagina, conversas, midias] = await Promise.all([
    tentar(
      [
        { host: "fb", caminho: `${ig}?fields=id,username,name` },
        { host: "ig", caminho: "me?fields=user_id,username" },
      ],
      conta!.token,
    ),
    tentar(
      [
        { host: "fb", caminho: `${ig}/subscribed_apps` },
        { host: "ig", caminho: "me/subscribed_apps" },
      ],
      conta!.token,
    ),
    pagina.ok ? tentar(pelaPagina("{pagina}/subscribed_apps"), conta!.token) : Promise.resolve({ ok: false as const, erros: pagina.erros }),
    tentar(
      [
        ...pelaPagina("{pagina}/conversations?platform=instagram&limit=3"),
        { host: "fb", caminho: `${ig}/conversations?platform=instagram&limit=3` },
        { host: "ig", caminho: "me/conversations?platform=instagram&limit=3" },
      ],
      conta!.token,
    ),
    tentar(
      [
        { host: "fb", caminho: `${ig}/media?fields=id,comments_count&limit=3` },
        { host: "ig", caminho: "me/media?fields=id,comments_count&limit=3" },
      ],
      conta!.token,
    ),
  ]);

  const resumir = (r: Awaited<ReturnType<typeof tentar>>) =>
    r.ok ? { ok: true, via: r.via, dados: r.dados } : { ok: false, erros: r.erros };

  return NextResponse.json({
    empresa: conta!.empresa,
    igUserId: conta!.igUserId,
    perfil: resumir(perfil),
    pagina: pagina.ok ? { ok: true, id: pagina.id, nome: pagina.nome } : { ok: false, erros: pagina.erros },
    avisosAssinados: resumir(assinatura),
    avisosDaPagina: resumir(assinaturaPagina),
    conversas: conversas.ok
      ? { ok: true, via: conversas.via, quantas: (conversas.dados as any)?.data?.length ?? 0 }
      : { ok: false, erros: conversas.erros },
    publicacoes: resumir(midias),
    webhook: {
      segredoConfigurado: Boolean(process.env.META_APP_SECRET),
      ultimosAvisos: ultimosAvisos(),
    },
  });
}

export async function POST(request: NextRequest) {
  const { erro, conta } = await preparar(request);
  if (erro) return erro;
  const acao = request.nextUrl.searchParams.get("acao");
  if (acao === "assinar") {
    const r = await ligarAvisos(conta!);
    return NextResponse.json(r.ok ? { ok: true, via: r.via, dados: r.dados } : { ok: false, erros: r.erros });
  }
  if (acao === "importar") {
    return NextResponse.json(await importarHistorico(conta!));
  }
  return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
}
