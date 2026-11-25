/**
 * GET /api/gestor/movimentacao?dia=YYYY-MM-DD&loja=...
 *
 * O que cada vendedor fez no dia.
 *
 * Isto não é o "Relatório do período", que fala de FECHAMENTOS — por que
 * ganhou, por que perdeu, onde errou. Aqui é o movimento: quem apareceu, quem
 * prospectou, quem mexeu no pipeline, quem não fez nada.
 *
 * DUAS DECISÕES QUE MUDAM O QUE VOCÊ LÊ AQUI:
 *
 * 1. Toda contagem vem acompanhada da MÉDIA dos últimos sete dias úteis da
 *    própria pessoa. Número solto não diz nada: 12 atividades é muito ou
 *    pouco? Depende de quanto essa pessoa costuma fazer. Sem a referência, o
 *    gestor compara vendedor com vendedor, que é injusto — carteiras e rotas
 *    são diferentes — ou compara com o que imagina, que é pior.
 *
 * 2. "Sem movimento" é dito com todas as letras, e separado de "dia fraco".
 *    Quem não registrou NADA não é quem fez pouco: ou a pessoa não trabalhou,
 *    ou trabalhou e não registrou. As duas coisas interessam ao gestor, e são
 *    conversas diferentes.
 */
import { NextRequest, NextResponse } from "next/server";
import { administra, getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { valorDoVendedor, donoDaVenda, parceiroDaVenda } from "@/lib/parceria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUSO = "America/Sao_Paulo";

/**
 * Começo e fim do dia de Brasília, em UTC — o banco guarda tudo em UTC.
 *
 * Usava setHours(), que é o relógio do SERVIDOR: numa VPS em UTC o "dia"
 * ia das 21h da véspera às 21h do dia, e o que o vendedor fez à noite caía
 * no dia seguinte. O Brasil não tem horário de verão desde 2019: -03:00 fixo
 * (a mesma conta de src/lib/fuso.ts).
 */
function janelaDoDia(dia: string): { de: string; ate: string } {
  return {
    de: new Date(`${dia}T00:00:00-03:00`).toISOString(),
    ate: new Date(`${dia}T23:59:59.999-03:00`).toISOString(),
  };
}

function horaLocal(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Contagem {
  atividades: number;
  contatosNovos: number;
  leadsRecebidos: number;
  leadsRespondidos: number;
  oportunidadesNovas: number;
  oportunidadesMovidas: number;
  conversas: number;
}

const zero = (): Contagem => ({
  atividades: 0,
  contatosNovos: 0,
  leadsRecebidos: 0,
  leadsRespondidos: 0,
  oportunidadesNovas: 0,
  oportunidadesMovidas: 0,
  conversas: 0,
});

export async function GET(req: NextRequest) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre, gestor_aprovado, ativo")
    .eq("id", auth.userId)
    .maybeSingle();

  // Mesma régua do banco: gestor só vale depois de aprovado — e o Diretor
  // também (antes "Diretor" cru passava sem aprovação nenhuma).
  const ehGestor =
    !!eu &&
    eu.ativo !== false &&
    administra({
      cargo: eu.cargo as string,
      gestorAprovado: eu.gestor_aprovado === true,
      gestorMestre: eu.gestor_mestre === true,
    });
  if (!ehGestor) {
    return NextResponse.json(
      { erro: "Só o gestor aprovado vê a movimentação da equipe." },
      { status: 403 },
    );
  }

  const hojeLocal = new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
  const dia = req.nextUrl.searchParams.get("dia") || hojeLocal;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
  }
  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = eu.gestor_mestre && pedida ? pedida : (eu.empresa as string);

  const { de, ate } = janelaDoDia(dia);
  // Sete dias para trás, para o número do dia ter com o que ser comparado.
  const inicioJanela = janelaDoDia(
    new Date(new Date(`${dia}T12:00:00-03:00`).getTime() - 7 * 86400000)
      .toLocaleDateString("en-CA", { timeZone: FUSO }),
  ).de;

  /*
   * De mil em mil até o fim (src/lib/supabase/todas-as-linhas.ts): oito dias
   * de uma loja cabem hoje em um pedido, mas uma importação de contatos ou um
   * mutirão de prospecção passa de mil, e o banco corta calado.
   */
  type Linha = Record<string, unknown>;
  const ler = async (
    tabela: string,
    colunas: string,
    coluna: string,
    desde: string,
  ): Promise<{ data: Linha[] }> => ({
    data: await todasAsLinhas<Linha>((a, b) =>
      sb
        .from(tabela)
        .select(colunas)
        .eq("empresa", loja)
        .gte(coluna, desde)
        .lte(coluna, ate)
        .order("id")
        .range(a, b) as unknown as PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>,
    ).catch((e) => {
      console.error(`[movimentacao] ${tabela}:`, e instanceof Error ? e.message : e);
      return [];
    }),
  });

  const [pessoas, atividades, contatos, leads, oportunidades, conversas, vendas] =
    await Promise.all([
      sb
        .from("profiles")
        .select("id, nome, cargo")
        .eq("empresa", loja)
        .neq("ativo", false),
      ler("atividades", "owner_id, tipo, created_at", "created_at", inicioJanela),
      ler("relacionamentos", "owner_id, created_at", "created_at", inicioJanela),
      ler(
        "leads_recebidos",
        "vendedor_id, sdr_id, created_at, respondido_em, respondido_por, prazo_resposta, status, natureza",
        "created_at",
        inicioJanela,
      ),
      ler("oportunidades", "owner_id, etapa, valor, created_at, updated_at", "updated_at", inicioJanela),
      ler("whatsapp_ia_leads", "owner_id, updated_at", "updated_at", inicioJanela),
      ler(
        "vendas",
        "owner_id, parceiro_id, percentual_parceiro, valor, valor_fechado, created_at",
        "created_at",
        de,
      ),
    ]);

  const noDia = (iso: string | null | undefined) => !!iso && iso >= de && iso <= ate;

  const doDia = new Map<string, Contagem>();
  const naJanela = new Map<string, Contagem>();
  /** Em quantos dos 7 dias a pessoa registrou alguma coisa — a média é sobre eles. */
  const diasComRegistro = new Map<string, Set<string>>();
  const porTipo = new Map<string, Map<string, number>>();
  const primeira = new Map<string, string>();
  const ultima = new Map<string, string>();

  const pegar = (m: Map<string, Contagem>, id: string) => {
    if (!m.has(id)) m.set(id, zero());
    return m.get(id)!;
  };
  const marcarDia = (id: string, iso: string) => {
    const d = new Date(iso).toLocaleDateString("en-CA", { timeZone: FUSO });
    if (!diasComRegistro.has(id)) diasComRegistro.set(id, new Set());
    diasComRegistro.get(id)!.add(d);
  };

  for (const a of atividades.data ?? []) {
    const id = a.owner_id as string;
    if (!id) continue;
    pegar(naJanela, id).atividades++;
    marcarDia(id, a.created_at as string);
    if (!noDia(a.created_at as string)) continue;
    pegar(doDia, id).atividades++;
    if (!porTipo.has(id)) porTipo.set(id, new Map());
    const t = porTipo.get(id)!;
    const tipo = (a.tipo as string) || "Outro";
    t.set(tipo, (t.get(tipo) ?? 0) + 1);
    const q = a.created_at as string;
    if (!primeira.has(id) || q < primeira.get(id)!) primeira.set(id, q);
    if (!ultima.has(id) || q > ultima.get(id)!) ultima.set(id, q);
  }

  for (const c of contatos.data ?? []) {
    const id = c.owner_id as string;
    if (!id) continue;
    pegar(naJanela, id).contatosNovos++;
    marcarDia(id, c.created_at as string);
    if (noDia(c.created_at as string)) pegar(doDia, id).contatosNovos++;
  }

  for (const l of leads.data ?? []) {
    // Lead descartado como não-lead, ou que era cliente antigo, não entra na
    // conta de ninguém.
    if (l.natureza === "nao_lead" || l.natureza === "cliente") continue;
    const id = (l.vendedor_id ?? l.sdr_id) as string | null;
    if (!id) continue;
    pegar(naJanela, id).leadsRecebidos++;
    marcarDia(id, l.created_at as string);
    if (noDia(l.created_at as string)) pegar(doDia, id).leadsRecebidos++;

    const quemRespondeu = (l.respondido_por ?? id) as string;
    if (noDia(l.respondido_em as string | null)) {
      pegar(doDia, quemRespondeu).leadsRespondidos++;
    }
    if (l.respondido_em) pegar(naJanela, quemRespondeu).leadsRespondidos++;
  }

  for (const o of oportunidades.data ?? []) {
    const id = o.owner_id as string;
    if (!id) continue;
    const nova = noDia(o.created_at as string);
    if (nova) pegar(doDia, id).oportunidadesNovas++;
    if (noDia(o.updated_at as string) && !nova) pegar(doDia, id).oportunidadesMovidas++;
    pegar(naJanela, id).oportunidadesNovas++;
    marcarDia(id, o.updated_at as string);
  }

  for (const c of conversas.data ?? []) {
    const id = c.owner_id as string;
    if (!id) continue;
    pegar(naJanela, id).conversas++;
    marcarDia(id, c.updated_at as string);
    if (noDia(c.updated_at as string)) pegar(doDia, id).conversas++;
  }

  const vendasPorDono = new Map<string, { qtd: number; valor: number }>();
  // Venda em dupla: conta para o dono e para o parceiro, cada um com a sua
  // fatia (src/lib/parceria.ts) — a soma da equipe continua sendo o que a
  // loja vendeu.
  for (const v of vendas.data ?? []) {
    for (const id of [donoDaVenda(v), parceiroDaVenda(v)]) {
      if (!id) continue;
      const atual = vendasPorDono.get(id) ?? { qtd: 0, valor: 0 };
      atual.qtd++;
      atual.valor += valorDoVendedor(v, id);
      vendasPorDono.set(id, atual);
    }
  }

  const equipe = (pessoas.data ?? []).filter((p) =>
    /vendedor|representante|sdr|pós-venda|pos-venda/i.test((p.cargo as string) ?? ""),
  );

  const linhas = equipe.map((p) => {
    const id = p.id as string;
    const d = doDia.get(id) ?? zero();
    const j = naJanela.get(id) ?? zero();
    const dias = Math.max(1, diasComRegistro.get(id)?.size ?? 1);
    const venda = vendasPorDono.get(id) ?? { qtd: 0, valor: 0 };

    const total =
      d.atividades + d.contatosNovos + d.leadsRecebidos + d.leadsRespondidos +
      d.oportunidadesNovas + d.oportunidadesMovidas + d.conversas;

    return {
      id,
      nome: p.nome as string,
      cargo: p.cargo as string,
      ...d,
      vendas: venda.qtd,
      faturamento: venda.valor,
      porTipo: Object.fromEntries(porTipo.get(id) ?? []),
      primeiraEm: horaLocal(primeira.get(id) ?? null),
      ultimaEm: horaLocal(ultima.get(id) ?? null),
      /**
       * Média dos dias em que a pessoa registrou algo, não dos 7 corridos:
       * dividir por 7 puniria quem tirou folga e achataria todo mundo.
       */
      media: {
        atividades: Math.round((j.atividades / dias) * 10) / 10,
        leadsRecebidos: Math.round((j.leadsRecebidos / dias) * 10) / 10,
        conversas: Math.round((j.conversas / dias) * 10) / 10,
      },
      diasAtivosNaSemana: diasComRegistro.get(id)?.size ?? 0,
      semMovimento: total === 0,
      total,
    };
  });

  linhas.sort((a, b) => b.total - a.total);

  const soma = (f: (l: (typeof linhas)[number]) => number) =>
    linhas.reduce((s, l) => s + f(l), 0);

  return NextResponse.json({
    dia,
    loja,
    ehHoje: dia === hojeLocal,
    vendedores: linhas,
    totais: {
      pessoas: linhas.length,
      semMovimento: linhas.filter((l) => l.semMovimento).length,
      atividades: soma((l) => l.atividades),
      contatosNovos: soma((l) => l.contatosNovos),
      leadsRecebidos: soma((l) => l.leadsRecebidos),
      leadsRespondidos: soma((l) => l.leadsRespondidos),
      oportunidadesNovas: soma((l) => l.oportunidadesNovas),
      oportunidadesMovidas: soma((l) => l.oportunidadesMovidas),
      conversas: soma((l) => l.conversas),
      // Contadas uma vez cada: somar as linhas contaria duas vezes a venda em
      // dupla (ela aparece para o dono e para o parceiro).
      vendas: (vendas.data ?? []).filter((v) =>
        linhas.some((l) => l.id === donoDaVenda(v) || l.id === parceiroDaVenda(v)),
      ).length,
      faturamento: soma((l) => l.faturamento),
    },
  });
}
