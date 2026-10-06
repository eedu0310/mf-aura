import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dá uma senha nova a alguém da equipe, para o gestor entregar na mão.
 *
 * POR QUE PRECISA EXISTIR. A tela de login tem "Esqueci minha senha", mas ela
 * manda um e-mail — e isso só resolve quando a pessoa ainda tem acesso àquela
 * caixa e o envio de e-mail está configurado. Sem este botão, uma senha
 * esquecida só se resolvia pelo painel do Supabase, e o caminho que parece
 * óbvio lá — apagar a conta e criar de novo — não funciona: a conta é
 * referenciada por notificações, tarefas e leads, e o banco recusa a exclusão.
 * Foi o que aconteceu com o Alexandre.
 *
 * A SENHA APARECE UMA VEZ SÓ, na resposta desta chamada. Não fica guardada em
 * lugar nenhum: o Supabase guarda o hash, e aqui não há onde reler. Se o
 * gestor perder, gera outra.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mandaNaLoja(auth)) {
    return NextResponse.json(
      { erro: "Só um gestor aprovado pode redefinir a senha de alguém." },
      { status: 403 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const alvo = String(corpo.usuarioId ?? "").trim();
  if (!alvo) return NextResponse.json({ erro: "Informe de quem é a senha." }, { status: 400 });

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { data: pessoa } = await service
    .from("profiles")
    .select("nome, empresa, excluido_em, gestor_mestre")
    .eq("id", alvo)
    .maybeSingle();

  if (!pessoa) return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
  if (pessoa.excluido_em) {
    return NextResponse.json(
      { erro: `${pessoa.nome} está excluído da equipe. Traga de volta antes de dar uma senha nova.` },
      { status: 400 },
    );
  }
  // Gestor de loja não mexe na senha de quem é de outra loja.
  if (!auth.gestorMestre && pessoa.empresa !== auth.empresa) {
    return NextResponse.json({ erro: "Esta pessoa é de outra loja." }, { status: 403 });
  }
  // E ninguém além de um mestre troca a senha de um mestre.
  if (pessoa.gestor_mestre && !auth.gestorMestre) {
    return NextResponse.json(
      { erro: "Só um gestor mestre redefine a senha de outro gestor mestre." },
      { status: 403 },
    );
  }

  /**
   * Sorteada com crypto, não com Math.random: senha de acesso ao CRM da casa
   * não se tira de um gerador previsível.
   */
  const senha = `Aura@${randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "")}${randomBytes(1)[0] % 90 + 10}`;

  const { error } = await service.auth.admin.updateUserById(alvo, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, nome: pessoa.nome, senhaProvisoria: senha });
}
