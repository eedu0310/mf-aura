import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("aura_recomendacoes")
    .select("id,titulo,descricao,prioridade,status,entidade_tipo,entidade_id,prazo,criado_em")
    .eq("vendedor_id", auth.userId)
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ erro: "Não foi possível carregar as recomendações." }, { status: 500 });
  return NextResponse.json({ recomendacoes: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  let body: { id?: string; status?: "concluida" | "dispensada" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!body.id || !body.status) return NextResponse.json({ erro: "Informe id e status." }, { status: 400 });

  const { error } = await auth.supabase
    .from("aura_recomendacoes")
    .update({ status: body.status, concluida_em: body.status === "concluida" ? new Date().toISOString() : null })
    .eq("id", body.id)
    .eq("vendedor_id", auth.userId);
  if (error) return NextResponse.json({ erro: "Não foi possível atualizar a recomendação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
