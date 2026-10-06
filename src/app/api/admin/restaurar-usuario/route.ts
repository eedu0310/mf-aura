import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Traz de volta alguém que foi excluído da equipe.
 *
 * A exclusão foi construída para ser definitiva, e faltou a porta de volta. A
 * primeira pessoa excluída no sistema foi excluída por engano, num teste — e
 * o caminho que parece óbvio, apagar a conta no Supabase e criar de novo, não
 * funciona: a conta é referenciada por notificações, tarefas e leads, e o
 * banco recusa. A pessoa fica num limbo, fora da equipe e impossível de
 * recriar.
 *
 * DUAS COISAS NÃO VOLTAM, e é de propósito:
 *
 *  - A CARTEIRA. Os clientes já são de quem recebeu, e devolver na marra
 *    passaria por cima de um trabalho que talvez já tenha começado. Para
 *    desfazer, usa-se a transferência de carteira, que registra a devolução.
 *  - OS PODERES. Gestor volta esperando aprovação, e ninguém volta como
 *    gestor mestre. Devolver poder junto com o acesso seria repor, sem
 *    ninguém decidir, exatamente o que a exclusão tirou.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!auth.gestorMestre) {
    return NextResponse.json(
      { erro: "Só um gestor mestre pode trazer alguém de volta." },
      { status: 403 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const alvo = String(corpo.usuarioId ?? "").trim();
  if (!alvo) return NextResponse.json({ erro: "Informe quem deve voltar." }, { status: 400 });

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { data, error } = await service.rpc("aura_restaurar_funcionario", {
    p_executor: auth.userId,
    p_alvo: alvo,
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  // O banimento é o que de fato impede o login; tirá-lo é o que devolve o
  // acesso. Sem isto a pessoa voltaria para as listas e continuaria sem entrar.
  const { error: erroAuth } = await service.auth.admin.updateUserById(alvo, {
    ban_duration: "none",
  });
  if (erroAuth) {
    console.error("[admin] perfil restaurado mas o acesso continua bloqueado:", erroAuth);
    return NextResponse.json({
      ok: true,
      ...(data ?? {}),
      aviso:
        "Voltou para a equipe, mas não consegui desbloquear o login. Desbloqueie a conta no Supabase (Authentication → Users).",
    });
  }

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
