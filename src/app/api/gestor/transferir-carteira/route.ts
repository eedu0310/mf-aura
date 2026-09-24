import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transfere a carteira de um vendedor para outro.
 *
 * Antes o painel chamava a função do banco direto do navegador, com a
 * sessão de quem estava logado. Como a função é SECURITY DEFINER e o
 * EXECUTE estava liberado para todo usuário autenticado, qualquer vendedor
 * conseguia puxar a carteira de um colega para si chamando a API do
 * Supabase na mão. Agora o EXECUTE é só do servidor e a checagem de cargo
 * acontece aqui.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (auth.cargo !== "Gestor") {
    return NextResponse.json({ erro: "Só o gestor pode transferir carteira." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const origem = String(corpo.origem ?? "").trim();
  const destino = String(corpo.destino ?? "").trim();

  if (!origem || !destino) {
    return NextResponse.json({ erro: "Informe quem entrega e quem recebe a carteira." }, { status: 400 });
  }
  if (origem === destino) {
    return NextResponse.json({ erro: "Escolha dois vendedores diferentes." }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data, error } = await sb.rpc("aura_transferir_carteira", {
    p_usuario_origem: origem,
    p_usuario_destino: destino,
    p_motivo: String(corpo.motivo ?? "").slice(0, 300) || "Transferência realizada pelo painel do gestor",
    p_desativar_origem: Boolean(corpo.desativarOrigem),
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
