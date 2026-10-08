import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { gerarRelatorioSemanalDaLoja, VERSAO_RELATORIO } from "@/lib/relatorio-semanal/gerar";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O relatório semanal pronto, para a tela e para o PDF.
 *
 * ALCANCE, conferido aqui e não só na tela:
 *   vendedor            vê a própria fatia, e só ela
 *   gestor aprovado     vê a loja dele inteira, destrinchada por vendedor
 *   gestor mestre       atravessa as quatro lojas
 *
 * Um gestor não aprovado não passa: o cargo "Gestor" sozinho não é régua.
 */

/** Segunda-feira da semana de uma data qualquer, no fuso de Brasília. */
function segundaDaSemana(quando: Date): string {
  const dia = quando.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const dow = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  const base = new Date(`${dia}T00:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return base.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  const url = new URL(request.url);
  const gestor = mandaNaLoja(auth) || auth.cargo === "Diretor";
  const lojasQuePodeVer = auth.gestorMestre || auth.cargo === "Diretor" ? [...NOMES_EMPRESAS] : [auth.empresa];

  const lojaPedida = url.searchParams.get("loja");
  /**
   * Loja fora do alcance não vira "nenhum resultado": vira recusa. Devolver
   * vazio ensinaria que a loja não tem relatório, quando o que não há é
   * permissão — e esconde a tentativa.
   */
  if (lojaPedida && !lojasQuePodeVer.includes(lojaPedida)) {
    return NextResponse.json({ erro: "Esta loja não está no seu alcance." }, { status: 403 });
  }
  const loja = lojaPedida ?? (gestor ? lojasQuePodeVer[0] : auth.empresa);

  // Os períodos já gerados, para o seletor da tela.
  const consultaPeriodos = sb
    .from("relatorios_periodicos")
    .select("periodo_inicio, periodo_fim, created_at")
    .eq("tipo", gestor ? "semanal_gestor" : "semanal_vendedor")
    .eq("empresa", loja)
    .order("periodo_inicio", { ascending: false })
    .limit(26);

  const { data: periodos, error: erroPeriodos } = gestor
    ? await consultaPeriodos
    : await consultaPeriodos.eq("vendedor_id", auth.userId);

  if (erroPeriodos) {
    return NextResponse.json({ erro: `Não consegui listar os períodos: ${erroPeriodos.message}` }, { status: 500 });
  }

  const inicioPedido = url.searchParams.get("periodo") ?? periodos?.[0]?.periodo_inicio ?? null;

  if (!inicioPedido) {
    return NextResponse.json({
      relatorio: null,
      periodos: [],
      lojas: lojasQuePodeVer,
      loja,
      gestor,
      podeGerar: gestor,
    });
  }

  let consulta = sb
    .from("relatorios_periodicos")
    .select("dados_json, conteudo, periodo_inicio, periodo_fim, created_at")
    .eq("empresa", loja)
    .eq("periodo_inicio", inicioPedido)
    .eq("tipo", gestor ? "semanal_gestor" : "semanal_vendedor");

  // O vendedor só alcança a linha dele. A régua é o id da sessão, não a URL.
  if (!gestor) consulta = consulta.eq("vendedor_id", auth.userId);

  const { data, error } = await consulta.maybeSingle();
  if (error) {
    return NextResponse.json({ erro: `Não consegui ler o relatório: ${error.message}` }, { status: 500 });
  }

  const dados = data?.dados_json as Record<string, unknown> | null;
  /**
   * Relatório antigo não tem a marca de versão. Em vez de tentar desenhar um
   * formato que não existe, a tela recebe o texto e mostra o texto.
   */
  const formatoNovo = Number(dados?.versao ?? 0) >= VERSAO_RELATORIO;

  return NextResponse.json({
    relatorio: formatoNovo ? dados : null,
    textoAntigo: formatoNovo ? null : (data?.conteudo ?? null),
    periodos: periodos ?? [],
    lojas: lojasQuePodeVer,
    loja,
    gestor,
    podeGerar: gestor,
  });
}

/** Gera agora, sem esperar o sábado. Só gestor aprovado. */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mandaNaLoja(auth) && !auth.gestorMestre && auth.cargo !== "Diretor") {
    return NextResponse.json({ erro: "Só o gestor da loja gera o relatório." }, { status: 403 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  const corpo = (await request.json().catch(() => ({}))) as { loja?: string; periodo?: string };
  const lojasQuePodeVer = auth.gestorMestre || auth.cargo === "Diretor" ? [...NOMES_EMPRESAS] : [auth.empresa];
  const loja = corpo.loja ?? auth.empresa;
  if (!lojasQuePodeVer.includes(loja)) {
    return NextResponse.json({ erro: "Esta loja não está no seu alcance." }, { status: 403 });
  }

  const segunda = corpo.periodo ?? segundaDaSemana(new Date());
  const inicio = new Date(`${segunda}T00:00:00-03:00`);
  if (Number.isNaN(inicio.getTime())) {
    return NextResponse.json({ erro: "Período inválido." }, { status: 400 });
  }

  const domingo = new Date(inicio);
  domingo.setUTCDate(domingo.getUTCDate() + 7);
  // Igual ao cron: a janela não passa do fim de hoje, para não rotular com um
  // dia que ainda não aconteceu.
  const hoje = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T00:00:00-03:00`);
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const fim = amanha < domingo ? amanha : domingo;

  if (fim <= inicio) {
    return NextResponse.json({ erro: "Esse período ainda não começou." }, { status: 400 });
  }

  try {
    const { relatorio, avisos } = await gerarRelatorioSemanalDaLoja(sb, loja, inicio, fim);
    return NextResponse.json({ ok: true, relatorio, avisos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`Relatório semanal de ${loja} falhou:`, err);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
