import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista a equipe para o gestor, já com o e-mail de acesso de cada pessoa.
 *
 * O e-mail não fica na tabela de perfis (ele vive no cadastro de acesso do
 * Supabase), então a tela mostrava "Sem email registrado" para todo mundo.
 * Aqui o servidor junta as duas coisas.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (auth.cargo !== "Gestor") {
    return NextResponse.json({ erro: "Somente o gestor pode ver a equipe." }, { status: 403 });
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const loja = searchParams.get("loja")?.trim() || auth.empresa;

  const { data: perfis, error } = await service
    .from("profiles")
    .select("id, nome, cargo, empresa, ativo, created_at")
    .eq("empresa", loja)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // O cadastro de acesso é paginado; 1000 cobre com folga uma operação destas.
  const emails = new Map<string, string>();
  try {
    const { data: contas } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const conta of contas?.users ?? []) {
      if (conta.email) emails.set(conta.id, conta.email);
    }
  } catch (e) {
    console.error("[admin] não consegui ler os e-mails de acesso:", e);
  }

  const usuarios = (perfis ?? []).map((p) => ({
    ...p,
    email: emails.get(p.id) ?? null,
  }));

  return NextResponse.json({ usuarios });
}
