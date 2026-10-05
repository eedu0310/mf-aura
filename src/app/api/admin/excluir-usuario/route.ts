import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exclui alguém da equipe. Diferente de desativar: a pessoa sai de todas as
 * listas do sistema e não volta pelo botão de reativar.
 *
 * A CARTEIRA É CONDIÇÃO, NÃO OPÇÃO. Cada vendedor só vê a própria carteira;
 * um contato cujo dono não existe mais fica invisível para toda a equipe —
 * seria cliente perdido sem ninguém perceber. Quem não tem nada na mão pode
 * sair sem herdeiro, e a função do banco é quem decide isso, não esta rota.
 *
 * O ACESSO SAI JUNTO. Marcar o perfil não derruba a sessão nem impede o
 * login; quem faz isso é o banimento no cadastro de acesso, abaixo.
 *
 * O QUE NÃO ACONTECE: a linha da pessoa não é apagada do banco. Ela aponta
 * para o cadastro de acesso com exclusão em cascata, e dessa cascata descem
 * as VENDAS dela. Apagar a conta mudaria o faturamento dos meses passados.
 * O nome fica guardado para o histórico continuar fazendo sentido.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  if (!auth.gestorMestre) {
    return NextResponse.json(
      { erro: "Só um gestor mestre pode excluir alguém da equipe." },
      { status: 403 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const alvo = String(corpo.usuarioId ?? "").trim();
  const herdeiro = String(corpo.herdeiroId ?? "").trim() || null;
  const motivo = String(corpo.motivo ?? "").slice(0, 300) || null;

  if (!alvo) return NextResponse.json({ erro: "Informe quem será excluído." }, { status: 400 });
  if (herdeiro && herdeiro === alvo) {
    return NextResponse.json(
      { erro: "A carteira não pode ficar com a própria pessoa excluída." },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { data, error } = await service.rpc("aura_excluir_funcionario", {
    p_executor: auth.userId,
    p_alvo: alvo,
    p_herdeiro: herdeiro,
    p_motivo: motivo,
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  // Banimento longo em vez de apagar a conta de acesso: apagar levaria em
  // cascata as vendas, as oportunidades e os relacionamentos dela.
  const { error: erroAuth } = await service.auth.admin.updateUserById(alvo, {
    ban_duration: "876000h",
  });
  if (erroAuth) {
    console.error("[admin] perfil excluído mas o acesso não foi bloqueado:", erroAuth);
    return NextResponse.json({
      ok: true,
      ...(data ?? {}),
      aviso:
        "A pessoa saiu das listas, mas não consegui bloquear o login dela. Troque a senha dessa conta no Supabase.",
    });
  }

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
