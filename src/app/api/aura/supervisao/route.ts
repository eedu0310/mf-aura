import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { nomesDosAgentes } from "@/lib/agentes/motor";
import { faltaNoBanco } from "@/lib/agentes/util";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  /*
   * Com a migração 108 a recomendação também pode vir de um AGENTE: traz
   * quem mandou (agente, agente_nome), para onde o botão leva (acao_url), se
   * mostra "Gerar mensagem" (pode_gerar_mensagem) e a mensagem já gerada.
   * Sem a 108 essas colunas não existem e a lista sai como antes.
   */
  const BASICO = "id,titulo,descricao,prioridade,status,entidade_tipo,entidade_id,prazo,criado_em";
  const DOS_AGENTES = "agente,acao_url,pode_gerar_mensagem,mensagem_sugerida,expira_em";
  const consultar = (colunas: string) =>
    auth.supabase
      .from("aura_recomendacoes")
      .select(colunas)
      .eq("vendedor_id", auth.userId)
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
      // Mais que as 20 de antes: os agentes somam itens aos da supervisão.
      .limit(60);

  let resposta = await consultar(`${BASICO},${DOS_AGENTES}`);
  if (resposta.error && faltaNoBanco(resposta.error)) resposta = await consultar(BASICO);
  const { data, error } = resposta;
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as recomendações." }, { status: 500 });

  const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>;
  let nomes = new Map<string, string>();
  if (linhas.some((l) => l.agente)) {
    const sb = getSupabaseServiceClient();
    if (sb) nomes = await nomesDosAgentes(sb).catch(() => new Map<string, string>());
  }
  const recomendacoes = linhas.map((l) => ({
    ...l,
    agente: (l.agente as string | null | undefined) ?? null,
    agente_nome: l.agente ? (nomes.get(l.agente as string) ?? (l.agente as string)) : null,
    acao_url: (l.acao_url as string | null | undefined) ?? null,
    pode_gerar_mensagem: l.pode_gerar_mensagem === true,
  }));
  return NextResponse.json({ recomendacoes });
}

export async function PATCH(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  let body: { id?: string; status?: "concluida" | "dispensada" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!body.id || !body.status) return NextResponse.json({ erro: "Informe id e status." }, { status: 400 });
  // O tipo acima é só promessa: sem esta checagem qualquer texto virava status.
  if (body.status !== "concluida" && body.status !== "dispensada") {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("aura_recomendacoes")
    .update({ status: body.status, concluida_em: body.status === "concluida" ? new Date().toISOString() : null })
    .eq("id", body.id)
    .eq("vendedor_id", auth.userId);
  if (error) return NextResponse.json({ erro: "Não foi possível atualizar a recomendação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
