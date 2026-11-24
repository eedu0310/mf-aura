import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apaga uma conta de acesso que nunca terminou o cadastro (sem linha em
 * profiles): testes, cadastros por engano. Como a conta não tem perfil, não
 * tem venda, cliente nem histórico — apagar não leva nada junto.
 *
 * Conta COM perfil não passa por aqui: essa sai pela exclusão normal, que
 * guarda o histórico e passa a carteira adiante.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!auth.gestorMestre) {
    return NextResponse.json({ erro: "Só um gestor mestre apaga contas de acesso." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const id = String(corpo.id ?? "").trim();
  if (!id) return NextResponse.json({ erro: "Informe a conta." }, { status: 400 });
  if (id === auth.userId) return NextResponse.json({ erro: "Você não pode apagar a própria conta." }, { status: 400 });

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { data: perfil } = await service.from("profiles").select("id").eq("id", id).maybeSingle();
  if (perfil) {
    return NextResponse.json(
      { erro: "Essa conta tem cadastro completo. Use o botão de excluir da lista da equipe." },
      { status: 400 },
    );
  }

  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
