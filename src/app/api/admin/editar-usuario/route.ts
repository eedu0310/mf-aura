import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARGOS = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda", "Marketing", "Gestor"];

/**
 * Edita os dados de alguém da equipe: nome, e-mail de acesso, telefone,
 * cargo e loja (pedido do Elton em 24/11: trocar o acesso da Sabrina, que
 * saiu, para a Jaqueline, que entrou).
 *
 * - Gestor mestre: edita qualquer pessoa e pode mudar a loja.
 * - Gestor de loja aprovado: edita a equipe da própria loja, sem mudar a
 *   loja nem promover alguém a Gestor.
 *
 * O e-mail muda no cadastro de acesso (é com ele que a pessoa entra) e já
 * vale confirmado; a senha continua a mesma — para a pessoa nova, gere uma
 * senha provisória no botão da chave.
 *
 * Permissões continuam na rota /api/gestor/permissoes (só o mestre).
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mandaNaLoja(auth)) {
    return NextResponse.json({ erro: "Só o gestor edita os dados da equipe." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const id = String(corpo.id ?? "").trim();
  if (!id) return NextResponse.json({ erro: "Informe a pessoa." }, { status: 400 });

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { data: alvo } = await service
    .from("profiles")
    .select("id, nome, cargo, empresa, gestor_mestre, excluido_em")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
  if (alvo.excluido_em) {
    return NextResponse.json({ erro: "Essa pessoa foi excluída. Traga de volta antes de editar." }, { status: 400 });
  }

  const mestre = auth.gestorMestre === true;
  if (!mestre && alvo.empresa !== auth.empresa) {
    return NextResponse.json({ erro: "Você só edita a equipe da sua loja." }, { status: 403 });
  }
  if (!mestre && alvo.gestor_mestre) {
    return NextResponse.json({ erro: "Só um gestor mestre edita outro gestor mestre." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};

  if (corpo.nome !== undefined) {
    const nome = String(corpo.nome).trim().replace(/\s+/g, " ");
    if (nome.length < 2) return NextResponse.json({ erro: "Informe o nome." }, { status: 400 });
    patch.nome = nome.slice(0, 120);
  }
  if (corpo.telefone !== undefined) {
    const tel = String(corpo.telefone).trim();
    patch.telefone = tel ? tel.slice(0, 30) : null;
  }
  if (corpo.cargo !== undefined) {
    const cargo = String(corpo.cargo).trim();
    if (!CARGOS.includes(cargo)) {
      return NextResponse.json({ erro: `Cargo inválido. Use um destes: ${CARGOS.join(", ")}.` }, { status: 400 });
    }
    if (cargo !== alvo.cargo) {
      if (cargo === "Gestor" && !mestre) {
        return NextResponse.json({ erro: "Só o gestor mestre promove alguém a Gestor." }, { status: 403 });
      }
      patch.cargo = cargo;
      // Virar gestor passa pela aprovação, como no cadastro.
      if (cargo === "Gestor") patch.gestor_aprovado = false;
    }
  }
  if (corpo.empresa !== undefined) {
    const empresa = String(corpo.empresa).trim();
    if (empresa !== alvo.empresa) {
      if (!mestre) return NextResponse.json({ erro: "Só o gestor mestre muda a loja de alguém." }, { status: 403 });
      if (!NOMES_EMPRESAS.includes(empresa)) {
        return NextResponse.json({ erro: "Loja inválida." }, { status: 400 });
      }
      patch.empresa = empresa;
    }
  }

  // E-mail de acesso: muda no cadastro de login.
  let emailNovo: string | null = null;
  if (corpo.email !== undefined) {
    const email = String(corpo.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
    }
    const { data: conta } = await service.auth.admin.getUserById(id);
    if (conta?.user && (conta.user.email ?? "").toLowerCase() !== email) emailNovo = email;
  }

  if (emailNovo) {
    const { error } = await service.auth.admin.updateUserById(id, {
      email: emailNovo,
      email_confirm: true,
      user_metadata: { nome: (patch.nome as string) ?? alvo.nome },
    });
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      return NextResponse.json(
        { erro: jaExiste ? "Já existe outra conta com esse e-mail." : error.message },
        { status: jaExiste ? 409 : 500 },
      );
    }
  }

  if (Object.keys(patch).length) {
    const { error } = await service.from("profiles").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json(
        {
          erro: emailNovo
            ? `O e-mail foi trocado, mas os outros dados não salvaram: ${error.message}`
            : error.message,
        },
        { status: 500 },
      );
    }
  }

  if (!emailNovo && !Object.keys(patch).length) return NextResponse.json({ ok: true, nadaMudou: true });
  return NextResponse.json({ ok: true, emailTrocado: !!emailNovo, lojaTrocada: "empresa" in patch });
}
