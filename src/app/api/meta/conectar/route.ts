import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { SITE, assinarEstado, credenciais, urlDeAutorizacao } from "@/lib/meta/conectar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?empresa=LF Lareiras — leva o gestor mestre para a tela da Meta. */
export async function GET(request: Request) {
  const voltar = (msg: string) =>
    NextResponse.redirect(`${SITE}/gestor?aba=instagram&ig=erro&msg=${encodeURIComponent(msg)}`);

  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.redirect(`${SITE}/login`);
  if (!auth.gestorMestre) return voltar("Só um gestor mestre conecta contas do Instagram.");

  const empresa = (new URL(request.url).searchParams.get("empresa") ?? "").trim();
  if (!NOMES_EMPRESAS.includes(empresa)) return voltar("Loja inválida.");

  const app = credenciais();
  if (!app) {
    return voltar("Falta configurar o app da Meta no servidor (META_APP_ID, META_APP_SECRET e META_LOGIN_CONFIG_ID no .env.local).");
  }
  return NextResponse.redirect(urlDeAutorizacao(app, assinarEstado({ empresa, userId: auth.userId }, app.segredo)));
}
