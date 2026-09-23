import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Desativa (ou reativa) um vendedor/SDR/pós-venda. Não apaga nada —
 * só bloqueia o acesso da pessoa e a tira da distribuição automática
 * de leads. Histórico de vendas, atividades e relacionamentos fica
 * intacto pra sempre.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!["Gestor"].includes(auth.cargo)) {
    return NextResponse.json({ erro: "Só o Gestor pode fazer isso." }, { status: 403 });
  }

  const { usuarioId, ativo } = await request.json();
  if (!usuarioId || typeof ativo !== "boolean") {
    return NextResponse.json({ erro: "Parâmetros ausentes." }, { status: 400 });
  }

  const { data: alvo } = await auth.supabase
    .from("profiles")
    .select("empresa")
    .eq("id", usuarioId)
    .single();

  if (!alvo) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }
  // O Gestor agora têm acesso total às 4 lojas — sem
  // restrição adicional aqui além de já ser um dos dois papéis
  // (verificado acima).

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { error: erroPerfil } = await service
    .from("profiles")
    .update({ ativo })
    .eq("id", usuarioId);

  if (erroPerfil) {
    return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });
  }

  const { error: erroAuth } = await service.auth.admin.updateUserById(usuarioId, {
    ban_duration: ativo ? "none" : "87600h",
  });

  if (erroAuth) {
    console.error("Erro ao atualizar acesso do usuário:", erroAuth);
  }

  return NextResponse.json({ ok: true });
}
