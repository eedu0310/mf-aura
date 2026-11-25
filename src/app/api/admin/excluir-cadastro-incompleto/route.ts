import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apaga uma conta de acesso que nunca terminou o cadastro (sem linha em
 * profiles): testes, cadastros por engano. Como a conta não tem perfil, não
 * tem venda, cliente nem histórico — apagar não leva nada junto.
 *
 * Conta COM perfil não passa por aqui: essa sai pela exclusão normal, que
 * guarda o histórico e passa a carteira adiante.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  // Mestre de verdade: cargo Gestor, aprovado e mestre (a flag sozinha não basta).
  if (!vejoTodasAsLojas(auth)) {
    return NextResponse.json({ erro: "Só um gestor mestre apaga contas de acesso." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const id = String(corpo.id ?? "").trim();
  if (!id) return NextResponse.json({ erro: "Informe a conta." }, { status: 400 });
  if (id === auth.userId) return NextResponse.json({ erro: "Você não pode apagar a própria conta." }, { status: 400 });

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  // Se a leitura falhar, "sem perfil" não está provado: apagar a conta de uma
  // pessoa com cadastro levaria em cascata as vendas dela.
  const { data: perfil, error: erroPerfil } = await service.from("profiles").select("id").eq("id", id).maybeSingle();
  if (erroPerfil) {
    return NextResponse.json({ erro: "Não consegui conferir o cadastro desta conta. Tente de novo." }, { status: 500 });
  }
  if (perfil) {
    return NextResponse.json(
      { erro: "Essa conta tem cadastro completo. Use o botão de excluir da lista da equipe." },
      { status: 400 },
    );
  }

  /**
   * "Sem perfil, sem nada ligado" NÃO é verdade. O roteamento de leads chega a
   * entregar lead para a conta antes de a pessoa terminar o cadastro, e o sino
   * gera notificação para ela. Essas tabelas apontam para auth.users sem
   * cascata, e o Supabase recusava a exclusão com um seco "Database error
   * deleting user" (caso real: 2 leads e 3 notificações, 25/11/2026).
   *
   * Antes de apagar: os leads voltam para a fila (sem vendedor), as aprovações
   * perdem o nome de quem aprovou, e o que era só da pessoa (notificações,
   * tarefas) vai junto. Conteúdo que ela criou no marketing não pode ficar sem
   * autor (a coluna é obrigatória): aí a exclusão para e explica.
   */
  for (const tabela of ["campanhas_marketing", "postagens_marketing"] as const) {
    const { count, error: e } = await service
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("criado_por", id);
    if (e) return NextResponse.json({ erro: "Não consegui conferir o que essa conta criou. Tente de novo." }, { status: 500 });
    if (count) {
      return NextResponse.json(
        { erro: "Essa conta criou campanhas ou postagens de marketing. Passe esse conteúdo para outra pessoa antes de apagar." },
        { status: 409 },
      );
    }
  }

  const soltar: Array<[string, string]> = [
    ["leads_recebidos", "vendedor_id"],
    ["leads_recebidos", "sdr_id"],
    ["leads_recebidos", "respondido_por"],
    ["compromissos_mensais", "aprovado_por"],
    ["acoes_pendentes_aprovacao", "aprovado_por"],
  ];
  let leadsDevolvidos = 0;
  for (const [tabela, coluna] of soltar) {
    const { data, error: e } = await service
      .from(tabela)
      .update({ [coluna]: null })
      .eq(coluna, id)
      .select("id");
    if (e) return NextResponse.json({ erro: "Não consegui liberar os registros dessa conta. Nada foi apagado." }, { status: 500 });
    if (tabela === "leads_recebidos" && coluna === "vendedor_id") leadsDevolvidos = data?.length ?? 0;
  }
  for (const tabela of ["notificacoes", "tarefas"] as const) {
    const { error: e } = await service.from(tabela).delete().eq("vendedor_id", id);
    if (e) return NextResponse.json({ erro: "Não consegui limpar os avisos dessa conta. A conta não foi apagada." }, { status: 500 });
  }

  const { error } = await service.auth.admin.deleteUser(id);
  if (error) {
    console.error("[excluir-cadastro-incompleto] Supabase recusou:", error.message);
    return NextResponse.json(
      { erro: "O banco ainda recusou apagar essa conta: há outro registro ligado a ela." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, leadsDevolvidos });
}
