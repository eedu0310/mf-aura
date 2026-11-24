import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { NOMES_EMPRESAS } from "@/lib/companies";

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
  const mestre = auth.gestorMestre === true;
  // Só o gestor mestre escolhe a loja. Antes qualquer gestor aprovado mandava
  // `empresa` no corpo e criava gente em outra loja, ou numa loja inventada.
  const empresa = corpo.empresa ? String(corpo.empresa).trim() : auth.empresa;

  if (!nome || !email) return NextResponse.json({ erro: "Informe o nome e o e-mail." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }
  if (!mestre && empresa !== auth.empresa) {
    return NextResponse.json({ erro: "Você só cria acesso para a equipe da sua loja." }, { status: 403 });
  }
  if (!NOMES_EMPRESAS.includes(empresa)) {
    return NextResponse.json({ erro: "Loja inválida." }, { status: 400 });
  }
  // O cargo "Diretor" não existe mais (quem vê as quatro lojas é o gestor
  // mestre); ele cai aqui como qualquer cargo fora da lista.
  if (!CARGOS.includes(cargo)) {
    return NextResponse.json({ erro: `Cargo inválido. Use um destes: ${CARGOS.join(", ")}.` }, { status: 400 });
  }
  // Conta nova nasce sem aprovação nem poder de mestre, a não ser que um mestre
  // diga o contrário. Sem isso, um gestor de loja criava outro gestor já
  // aprovado e contornava a aprovação inteira.
  const querAprovado = corpo.gestorAprovado === true;
  const querMestre = corpo.gestorMestre === true;
  if (!mestre && (querAprovado || querMestre)) {
    return NextResponse.json(
      { erro: "Só o gestor mestre cria uma conta já aprovada ou mestre." },
      { status: 403 },
    );
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  // Senha provisória legível, que o gestor passa para a pessoa trocar depois.
  // Math.random não é aleatório de verdade (dá para prever a sequência); a
  // senha-provisoria já usava randomBytes, esta rota ficou para trás.
  const senhaProvisoria = `Aura@${randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "")}${(randomBytes(1)[0] % 90) + 10}`;

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
    .upsert(
      {
        id: criado.user.id,
        nome,
        cargo,
        empresa,
        ativo: true,
        gestor_aprovado: querAprovado,
        gestor_mestre: querMestre,
      },
      { onConflict: "id" },
    );

  if (erroPerfil) {
    // Não deixa uma conta órfã no Auth se o perfil não entrou.
    await service.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: criado.user.id, email, senhaProvisoria });
}
