/**
 * O que a AURA aprendeu nas conversas, para o gestor aprovar ou recusar.
 *
 * Nada do que a IA extrai entra em uso sozinho. O que ela tira de uma conversa
 * nasce como "sugerido" e só passa a ser injetado nos prompts depois que uma
 * pessoa confirma. Sem esse portão a AURA reforçaria os próprios erros: um
 * preço errado que apareceu numa conversa viraria o preço que ela repete para
 * todos os clientes.
 *
 * Um item recusado não volta. O processo de fechamento, se vir o mesmo padrão
 * outra vez, não reabre o que o gestor já decidiu que não serve.
 */
import { NextRequest, NextResponse } from "next/server";
import { administra, getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { limparCacheAprendizado } from "@/lib/aura/aprendizado";
import { resumoDasSugestoes } from "@/lib/aura/resultado-sugestoes";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { faltaNoBanco } from "@/lib/agentes/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre, gestor_aprovado")
    .eq("id", auth.userId)
    .maybeSingle();

  /**
   * Gestor aprovado, não só quem escolheu o cargo "Gestor" na tela de cadastro.
   *
   * A conta nasce com o cargo e espera aprovação de um gestor mestre; conferir
   * só o cargo deixava quem acabou de se cadastrar entrar aqui antes de alguém
   * aprovar. O mestre passa por cima, como em todo lugar — mas o mestre
   * também precisa ser Gestor aprovado: a flag gestor_mestre sozinha passava
   * aqui sem cargo nem aprovação (régua única em auth-empresa).
   */
  if (
    !eu ||
    !administra({
      cargo: eu.cargo as string,
      gestorAprovado: eu.gestor_aprovado === true,
      gestorMestre: eu.gestor_mestre === true,
    })
  ) {
    return {
      erro: NextResponse.json(
        { erro: "Só o gestor revisa o aprendizado da AURA." },
        { status: 403 },
      ),
    };
  }
  return { auth, sb, eu };
}

/** GET — o que está esperando revisão e o que já vale, da loja do gestor. */
export async function GET(req: NextRequest) {
  const { erro, sb, eu } = await somenteGestor();
  if (erro) return erro;

  // Todo gestor enxerga o aprendizado de todas as lojas (pedido do Elton,
  // 27/10): o que funciona numa loja ensina as outras. Aprovar e recusar
  // continua sendo do gestor da própria loja (e do mestre), no POST.
  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = pedida && NOMES_EMPRESAS.includes(pedida) ? pedida : eu!.empresa;

  const BASICO = "id, canal, tipo, gatilho, resposta, vezes_visto, vezes_fechou, vezes_perdeu, aprovado_auto, status, criado_em";
  /*
   * Quem revisou (o agente revisor-aprendizado), por quê e com que confiança.
   * As colunas chegam com a migração 108; sem ela a lista sai como antes.
   */
  const REVISAO = "revisado_por_agente, revisao_motivo, revisao_confianca";
  const consultar = (colunas: string) =>
    sb!
      .from("aura_aprendizado")
      .select(colunas)
      .eq("empresa", loja)
      .in("status", ["sugerido", "aprovado"])
      // Sugeridos primeiro: é o que exige ação. Dentro de cada grupo, o que mais
      // fechou venda aparece antes, porque é o mais provável de merecer aprovação.
      .order("status", { ascending: true })
      .order("vezes_fechou", { ascending: false })
      .order("vezes_visto", { ascending: false })
      .limit(200);

  let temRevisao = true;
  let resposta = await consultar(`${BASICO}, ${REVISAO}`);
  if (resposta.error && faltaNoBanco(resposta.error)) {
    temRevisao = false;
    resposta = await consultar(BASICO);
  }
  const { data, error } = resposta;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const itens = (data ?? []) as unknown as Array<Record<string, unknown> & { status: string }>;

  // O que o agente recusou, para o gestor poder desfazer (só com a 108).
  let recusadosPeloAgente: unknown[] = [];
  if (temRevisao) {
    const { data: recusados } = await sb!
      .from("aura_aprendizado")
      .select(`${BASICO}, ${REVISAO}`)
      .eq("empresa", loja)
      .eq("status", "recusado")
      .not("revisado_por_agente", "is", null)
      .order("revisado_em", { ascending: false })
      .limit(100);
    recusadosPeloAgente = recusados ?? [];
  }
  // Como a equipe usa as sugestões da AURA e se o cliente responde. Falhar
  // aqui não pode esconder a lista de aprendizado.
  const sugestoes = await resumoDasSugestoes(sb!, loja).catch(() => null);

  // A lista das lojas com quantos itens cada uma tem esperando, para o gestor
  // saber onde clicar. Sem isto o card só mostrava a loja do login e o
  // aprendizado das outras ficava invisível.
  const { data: pend } = await sb!
    .from("aura_aprendizado")
    .select("empresa")
    .eq("status", "sugerido")
    .limit(5000);
  const lojas = NOMES_EMPRESAS.map((nome) => ({
    nome,
    esperando: (pend ?? []).filter((p: { empresa: string }) => p.empresa === nome).length,
  }));

  return NextResponse.json({
    loja,
    lojas,
    podeDecidir: !!eu!.gestor_mestre || loja === eu!.empresa,
    sugeridos: itens.filter((i) => i.status === "sugerido"),
    aprovados: itens.filter((i) => i.status === "aprovado"),
    recusadosPeloAgente,
    sugestoes,
  });
}

/** POST — aprova, recusa ou corrige um item. */
export async function POST(req: NextRequest) {
  const { erro, sb, auth, eu } = await somenteGestor();
  if (erro) return erro;

  let corpo: {
    id?: string;
    acao?: "aprovar" | "recusar" | "desfazer";
    gatilho?: string;
    resposta?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo.id || (corpo.acao !== "aprovar" && corpo.acao !== "recusar" && corpo.acao !== "desfazer")) {
    return NextResponse.json(
      { erro: "Informe id e acao ('aprovar', 'recusar' ou 'desfazer')." },
      { status: 400 },
    );
  }

  // Confere a loja do item antes de mexer: um gestor não revisa o aprendizado
  // de outra loja, mesmo mandando o id na mão.
  const { data: item } = await sb!
    .from("aura_aprendizado")
    .select("id, empresa")
    .eq("id", corpo.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
  if (!eu!.gestor_mestre && item.empresa !== eu!.empresa) {
    return NextResponse.json({ erro: "Esse item é de outra loja." }, { status: 403 });
  }

  /*
   * DESFAZER: a decisão (do agente revisor, da aprovação automática ou de
   * outro gestor) volta atrás e o item espera revisão de novo, como
   * "sugerido". A versão anterior continua no histórico do conhecimento.
   * Vale também para um "recusado": aqui quem desfaz é uma pessoa.
   */
  if (corpo.acao === "desfazer") {
    const volta: Record<string, unknown> = {
      status: "sugerido",
      aprovado_auto: false,
      revisado_por: null,
      revisado_em: null,
    };
    let { error: erroVolta } = await sb!
      .from("aura_aprendizado")
      .update({ ...volta, revisado_por_agente: null, revisao_motivo: null, revisao_confianca: null })
      .eq("id", corpo.id);
    // Sem a migração 108 as colunas da revisão não existem: desfaz o resto.
    if (erroVolta && faltaNoBanco(erroVolta)) {
      ({ error: erroVolta } = await sb!.from("aura_aprendizado").update(volta).eq("id", corpo.id));
    }
    if (erroVolta) return NextResponse.json({ erro: erroVolta.message }, { status: 500 });
    limparCacheAprendizado(item.empresa);
    return NextResponse.json({ ok: true, status: "sugerido" });
  }

  const patch: Record<string, unknown> = {
    status: corpo.acao === "aprovar" ? "aprovado" : "recusado",
    revisado_por: auth!.userId,
    revisado_em: new Date().toISOString(),
  };
  // O gestor pode ajustar o texto antes de aprovar — a IA escreve um rascunho,
  // a palavra final da casa é dele.
  if (typeof corpo.gatilho === "string" && corpo.gatilho.trim()) {
    patch.gatilho = corpo.gatilho.trim().slice(0, 500);
  }
  if (typeof corpo.resposta === "string" && corpo.resposta.trim()) {
    patch.resposta = corpo.resposta.trim().slice(0, 2000);
  }

  const { error } = await sb!.from("aura_aprendizado").update(patch).eq("id", corpo.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // O texto do prompt fica 5 min em cache; sem limpar, a aprovação só valeria
  // na próxima janela e pareceria que o botão não fez nada.
  limparCacheAprendizado(item.empresa);

  return NextResponse.json({ ok: true });
}
