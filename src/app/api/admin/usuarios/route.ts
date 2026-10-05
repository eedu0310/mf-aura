import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista a equipe para o gestor, já com o e-mail de acesso de cada pessoa.
 *
 * DOIS MOTIVOS PARA ALGUÉM NÃO APARECER AQUI, OS DOIS CORRIGIDOS:
 *
 * 1. A consulta filtrava pela loja de quem olhava. Um gestor mestre responde
 *    pelo grupo inteiro, e ainda assim só via a própria loja: das 17 contas
 *    cadastradas, 9 eram invisíveis para ele — toda a Sole, toda a A&G e a MF.
 *    Agora o mestre vê as quatro lojas, com a loja escrita em cada pessoa.
 *
 * 2. Quem criou o acesso mas não terminou o cadastro não tem linha em
 *    profiles, e esta tela lê profiles. A pessoa ficava invisível em todo o
 *    sistema: o gestor não tinha como saber que ela existia nem como ajudar.
 *    Agora essas contas aparecem marcadas como cadastro incompleto.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (auth.cargo !== "Gestor" || !auth.gestorAprovado) {
    return NextResponse.json(
      { erro: "Somente um gestor aprovado pode ver a equipe." },
      { status: 403 },
    );
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const lojaPedida = searchParams.get("loja")?.trim();
  const incluirExcluidos = searchParams.get("incluirExcluidos") === "1";

  // O mestre vê tudo e pode escolher uma loja; o gestor de loja fica na dele,
  // mesmo que peça outra na URL.
  const loja = auth.gestorMestre ? lojaPedida || null : auth.empresa;

  let consulta = service
    .from("profiles")
    .select(
      "id, nome, cargo, empresa, ativo, created_at, gestor_mestre, gestor_aprovado, excluido_em, excluido_motivo",
    )
    .order("created_at", { ascending: false });

  if (loja) consulta = consulta.eq("empresa", loja);
  if (!incluirExcluidos) consulta = consulta.is("excluido_em", null);

  const { data: perfis, error } = await consulta;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // O cadastro de acesso é paginado; 1000 cobre com folga uma operação destas.
  const emails = new Map<string, string>();
  const contasSemPerfil: { id: string; email: string; created_at: string }[] = [];
  const idsComPerfil = new Set((perfis ?? []).map((p) => p.id as string));

  try {
    const { data: contas } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const conta of contas?.users ?? []) {
      if (conta.email) emails.set(conta.id, conta.email);
      if (!idsComPerfil.has(conta.id)) {
        contasSemPerfil.push({
          id: conta.id,
          email: conta.email ?? "(sem e-mail)",
          created_at: conta.created_at,
        });
      }
    }
  } catch (e) {
    console.error("[admin] não consegui ler os e-mails de acesso:", e);
  }

  const usuarios = (perfis ?? []).map((p) => ({
    ...p,
    email: emails.get(p.id as string) ?? null,
    semAcesso: !emails.has(p.id as string),
    excluido: Boolean(p.excluido_em),
  }));

  // Quem tem perfil em QUALQUER loja não é cadastro incompleto — só não está
  // nesta lista por causa do filtro de loja. Por isso a checagem é contra
  // todos os perfis, não contra os que a consulta devolveu.
  const { data: todosOsIds } = await service.from("profiles").select("id");
  const idsDeTodosOsPerfis = new Set((todosOsIds ?? []).map((p) => p.id as string));
  const incompletos = contasSemPerfil
    .filter((c) => !idsDeTodosOsPerfis.has(c.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({
    usuarios,
    incompletos,
    souMestre: auth.gestorMestre,
    minhaLoja: auth.empresa,
    lojaFiltrada: loja,
  });
}
