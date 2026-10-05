import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARGOS = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda", "Marketing", "Gestor"];

/**
 * Cria o acesso de um novo integrante da equipe.
 *
 * Antes isso era feito com supabase.auth.signUp direto no navegador, o que
 * trocava a sessão do gestor pela do usuário recém-criado (ele era
 * "deslogado" do próprio CRM). Aqui a conta é criada pelo servidor, já
 * confirmada, com uma senha provisória que o gestor entrega à pessoa.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mandaNaLoja(auth)) {
    return NextResponse.json({ erro: "Só o Gestor pode criar usuários." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const nome = String(corpo.nome ?? "").trim();
  const email = String(corpo.email ?? "").trim().toLowerCase();
  const cargo = String(corpo.cargo ?? "").trim();
  // O Gestor enxerga todas as lojas, então pode escolher em qual criar.
  const empresa = corpo.empresa ? String(corpo.empresa).trim() : auth.empresa;

  if (!nome || !email) return NextResponse.json({ erro: "Informe o nome e o e-mail." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }
  if (!CARGOS.includes(cargo)) {
    return NextResponse.json({ erro: `Cargo inválido. Use um destes: ${CARGOS.join(", ")}.` }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  // Senha provisória legível, que o gestor passa para a pessoa trocar depois.
  const senhaProvisoria = `Aura@${Math.random().toString(36).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  const { data: criado, error: erroAuth } = await service.auth.admin.createUser({
    email,
    password: senhaProvisoria,
    email_confirm: true,
    user_metadata: { nome, cargo, empresa },
  });

  if (erroAuth || !criado?.user) {
    const msg = erroAuth?.message ?? "Não consegui criar o acesso.";
    const jaExiste = /already|registered|exists/i.test(msg);
    return NextResponse.json(
      { erro: jaExiste ? "Já existe uma conta com esse e-mail." : msg },
      { status: jaExiste ? 409 : 500 },
    );
  }

  const { error: erroPerfil } = await service
    .from("profiles")
    .upsert({ id: criado.user.id, nome, cargo, empresa, ativo: true }, { onConflict: "id" });

  if (erroPerfil) {
    // Não deixa uma conta órfã no Auth se o perfil não entrou.
    await service.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: criado.user.id, email, senhaProvisoria });
}
