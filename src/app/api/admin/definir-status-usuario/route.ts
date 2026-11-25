import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
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
  if (!mandaNaLoja(auth)) {
    return NextResponse.json(
      { erro: "Só um gestor aprovado pode fazer isso." },
      { status: 403 },
    );
  }

  // JSON quebrado (ou "null") virava 500 aqui; agora é pedido inválido.
  const corpo = await request.json().catch(() => null);
  const { usuarioId, ativo } = (corpo && typeof corpo === "object" ? corpo : {}) as { usuarioId?: string; ativo?: unknown };
  if (!usuarioId || typeof ativo !== "boolean") {
    return NextResponse.json({ erro: "Parâmetros ausentes." }, { status: 400 });
  }

  // Desativar a si mesmo tranca o gestor fora do CRM, e se ele for o único
  // gestor da loja não sobra ninguém para reabrir a porta.
  if (usuarioId === auth.userId) {
    return NextResponse.json({ erro: "Você não pode mudar o seu próprio acesso." }, { status: 400 });
  }

  const { data: alvo } = await auth.supabase
    .from("profiles")
    .select("empresa, nome, excluido_em, gestor_mestre")
    .eq("id", usuarioId)
    .single();

  if (!alvo) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  // Reativar quem foi excluído traria de volta alguém que já teve a carteira
  // repassada: os clientes agora são de outra pessoa, e a conta voltaria a
  // receber lead novo sem ninguém ter decidido isso. Quem precisa voltar
  // entra como cadastro novo.
  if (alvo.excluido_em) {
    return NextResponse.json(
      {
        erro: `${alvo.nome} foi excluído da equipe e não volta por aqui. A carteira dele já foi repassada; cadastre a pessoa de novo se ela retornou.`,
      },
      { status: 400 },
    );
  }
  // Mesma régua de editar-usuario e senha-provisoria. Esta rota não tinha
  // nenhuma: qualquer gestor aprovado bloqueava o acesso de qualquer pessoa
  // das outras três lojas — inclusive de um gestor mestre.
  if (!auth.gestorMestre && alvo.empresa !== auth.empresa) {
    return NextResponse.json({ erro: "Esta pessoa é de outra loja." }, { status: 403 });
  }
  if (alvo.gestor_mestre && !auth.gestorMestre) {
    return NextResponse.json(
      { erro: "Só um gestor mestre muda o acesso de outro gestor mestre." },
      { status: 403 },
    );
  }

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
