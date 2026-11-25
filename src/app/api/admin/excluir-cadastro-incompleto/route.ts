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
  /**
   * CARTEIRA: o banco apaga EM CASCATA tudo que é "dono" da conta (vendas,
   * oportunidades, clientes, atividades, agenda, conversas analisadas do
   * WhatsApp). Conta sem cadastro também pode ter carteira — o caso real tinha
   * 1 oportunidade, 2 clientes, 2 atividades e 8 conversas, vindas do WhatsApp
   * conectado antes de terminar o cadastro (pente fino de 25/11/2026). Apagar
   * levaria tudo junto, sem volta.
   *
   * Então: com carteira, só apaga se vier `transferirPara` (uma pessoa ativa),
   * e a carteira passa para ela ANTES. Sem isso, devolve 409 com o que existe,
   * e a tela pede para escolher o destino.
   */
  const CARTEIRA: Array<[string, string, string]> = [
    ["vendas", "owner_id", "venda(s)"],
    ["oportunidades", "owner_id", "oportunidade(s)"],
    ["relacionamentos", "owner_id", "cliente(s)"],
    ["atividades", "owner_id", "atividade(s)"],
    ["compromissos", "owner_id", "compromisso(s) na agenda"],
    ["whatsapp_ia_leads", "owner_id", "conversa(s) do WhatsApp"],
    ["whatsapp_transcricoes", "owner_id", "transcrição(ões) de áudio"],
    ["leads_recebidos", "vendedor_id", "lead(s) recebido(s)"],
  ];
  const carteira: Array<{ rotulo: string; quantidade: number }> = [];
  for (const [tabela, coluna, rotulo] of CARTEIRA) {
    const { count, error: e } = await service.from(tabela).select("id", { count: "exact", head: true }).eq(coluna, id);
    if (e) return NextResponse.json({ erro: "Não consegui conferir a carteira dessa conta. Nada foi apagado." }, { status: 500 });
    if (count) carteira.push({ rotulo, quantidade: count });
  }

  const transferirPara = String(corpo.transferirPara ?? "").trim();
  let transferidos = 0;
  if (carteira.length > 0) {
    if (!transferirPara) {
      return NextResponse.json(
        {
          erro: `Essa conta tem carteira: ${carteira.map((c) => `${c.quantidade} ${c.rotulo}`).join(", ")}. Escolha para quem transferir antes de apagar.`,
          carteira,
        },
        { status: 409 },
      );
    }
    if (transferirPara === id) return NextResponse.json({ erro: "Escolha outra pessoa para receber a carteira." }, { status: 400 });
    const { data: destino, error: eDestino } = await service
      .from("profiles")
      .select("id, ativo, excluido_em")
      .eq("id", transferirPara)
      .maybeSingle();
    if (eDestino || !destino || destino.ativo === false || destino.excluido_em) {
      return NextResponse.json({ erro: "A pessoa escolhida não está ativa. Escolha outra." }, { status: 400 });
    }
    for (const [tabela, coluna] of CARTEIRA) {
      const { data, error: e } = await service
        .from(tabela)
        .update({ [coluna]: transferirPara })
        .eq(coluna, id)
        .select("id");
      if (e) {
        console.error(`[excluir-cadastro-incompleto] transferência em ${tabela}:`, e.message);
        return NextResponse.json(
          { erro: "Não consegui transferir toda a carteira. A conta NÃO foi apagada; tente de novo." },
          { status: 500 },
        );
      }
      transferidos += data?.length ?? 0;
    }
  }

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
  // O que era só da pessoa vai junto. Metas, compromissos mensais e
  // indicadores entram aqui porque a migração 107 troca a cascata desses por
  // bloqueio: sem esta limpeza, a exclusão voltaria a falhar.
  const PESSOAIS: Array<[string, string]> = [
    ["notificacoes", "vendedor_id"],
    ["tarefas", "vendedor_id"],
    ["metas", "owner_id"],
    ["compromissos_mensais", "vendedor_id"],
    ["indicadores_semanais", "vendedor_id"],
  ];
  for (const [tabela, coluna] of PESSOAIS) {
    const { error: e } = await service.from(tabela).delete().eq(coluna, id);
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
  return NextResponse.json({ ok: true, leadsDevolvidos, transferidos });
}
