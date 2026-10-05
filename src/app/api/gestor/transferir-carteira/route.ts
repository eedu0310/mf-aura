import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transfere a carteira de um vendedor para outro.
 *
 * POR QUE NUNCA FUNCIONOU: a função antiga do banco descobria quem estava
 * executando com auth.uid(). Esta rota chama pelo servidor, com a chave de
 * serviço, e ali auth.uid() é nulo — então toda transferência caía em
 * "Apenas Gestor ou Diretor pode transferir carteira". A tabela de
 * transferências tinha zero linhas desde que o sistema existe. Agora quem
 * executa vai como parâmetro, conferido aqui e conferido de novo no banco.
 *
 * A função nova também move o que a antiga deixava para trás: tarefas,
 * compromissos, conversas de WhatsApp, leads sem resposta e pós-venda.
 * Herdar os contatos sem herdar as visitas marcadas é herdar meia carteira.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (auth.cargo !== "Gestor" || !auth.gestorAprovado) {
    return NextResponse.json(
      { erro: "Só um gestor aprovado pode transferir carteira." },
      { status: 403 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const origem = String(corpo.origem ?? "").trim();
  const destino = String(corpo.destino ?? "").trim();

  if (!origem || !destino) {
    return NextResponse.json(
      { erro: "Informe quem entrega e quem recebe a carteira." },
      { status: 400 },
    );
  }
  if (origem === destino) {
    return NextResponse.json({ erro: "Escolha dois vendedores diferentes." }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data, error } = await sb.rpc("aura_mover_carteira", {
    p_executor: auth.userId,
    p_origem: origem,
    p_destino: destino,
    p_motivo:
      String(corpo.motivo ?? "").slice(0, 300) || "Transferência realizada pelo painel do gestor",
    p_desativar_origem: Boolean(corpo.desativarOrigem),
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
