/**
 * GET /api/gestor/relatorio-semanal[?dias=7][&loja=...]
 *
 * O retrato da semana por loja e por vendedor: o que fechou, o que perdeu, onde
 * a pessoa erra sempre e se ela está seguindo o funil.
 *
 * Tudo somado dos registros, sem chamar IA. A IA já foi usada uma vez, no
 * fechamento de cada negócio, e o laudo dela ficou guardado em
 * aura_feedback_fechamento. Reler o que já está escrito é de graça e dá o mesmo
 * número toda vez que o gestor abrir — um resumo gerado na hora mudaria de
 * palavra a cada abertura e ninguém saberia se o quadro piorou ou se foi só a
 * IA escrevendo diferente.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Laudo {
  vendedor_id: string;
  cliente: string | null;
  resultado: "fechado" | "perdido";
  valor: number | null;
  origem_lead: string | null;
  resumo: string;
  acertos: string[];
  erros: string[];
  etapas_puladas: string[];
  ponto_fraco: string | null;
  criado_em: string;
}

/** O que mais apareceu, em ordem. Usado para "onde esta pessoa erra sempre". */
function maisComuns(valores: (string | null)[], limite = 3) {
  const conta = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    conta.set(v, (conta.get(v) ?? 0) + 1);
  }
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([item, vezes]) => ({ item, vezes }));
}

export async function GET(req: NextRequest) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!eu || !(/gestor/i.test(eu.cargo ?? "") || eu.gestor_mestre)) {
    return NextResponse.json(
      { erro: "Só o gestor vê o relatório da equipe." },
      { status: 403 },
    );
  }

  const dias = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("dias")) || 7));
  const desde = new Date(Date.now() - dias * 86400e3).toISOString();

  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = eu.gestor_mestre && pedida ? pedida : eu.empresa;

  const [{ data: laudos }, { data: pessoas }] = await Promise.all([
    sb
      .from("aura_feedback_fechamento")
      .select(
        "vendedor_id, cliente, resultado, valor, origem_lead, resumo, acertos, erros, etapas_puladas, ponto_fraco, criado_em",
      )
      .eq("empresa", loja)
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false }),
    sb.from("profiles").select("id, nome, cargo").eq("empresa", loja),
  ]);

  const lista = (laudos ?? []) as Laudo[];
  const nome = new Map((pessoas ?? []).map((p) => [p.id as string, p.nome as string]));

  // Por vendedor
  const ids = [...new Set(lista.map((l) => l.vendedor_id))];
  const porVendedor = ids
    .map((id) => {
      const meus = lista.filter((l) => l.vendedor_id === id);
      const fechou = meus.filter((l) => l.resultado === "fechado");
      const perdeu = meus.filter((l) => l.resultado === "perdido");
      const faturou = fechou.reduce((s, l) => s + Number(l.valor ?? 0), 0);

      return {
        id,
        nome: nome.get(id) ?? "Sem nome",
        decididos: meus.length,
        fechou: fechou.length,
        perdeu: perdeu.length,
        faturamento: faturou,
        conversao: meus.length ? Math.round((fechou.length / meus.length) * 100) : null,
        // A falha que repete — é isto que o gestor leva para a conversa de
        // feedback, em vez de comentar caso a caso.
        pontosFracos: maisComuns(meus.map((l) => l.ponto_fraco)),
        errosRecorrentes: maisComuns(meus.flatMap((l) => l.erros ?? [])),
        acertosRecorrentes: maisComuns(meus.flatMap((l) => l.acertos ?? [])),
        // Aderência ao funil: quantos negócios pularam etapa. Pular etapa é
        // falha de processo mesmo quando o negócio fecha — quem vai direto ao
        // preço sem apresentar ganha menos margem.
        pularamEtapa: meus.filter((l) => (l.etapas_puladas ?? []).length > 0).length,
        etapasMaisPuladas: maisComuns(meus.flatMap((l) => l.etapas_puladas ?? [])),
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento || b.fechou - a.fechou);

  const fechados = lista.filter((l) => l.resultado === "fechado");

  return NextResponse.json({
    loja,
    dias,
    desde,
    totais: {
      decididos: lista.length,
      fechou: fechados.length,
      perdeu: lista.length - fechados.length,
      faturamento: fechados.reduce((s, l) => s + Number(l.valor ?? 0), 0),
      conversao: lista.length
        ? Math.round((fechados.length / lista.length) * 100)
        : null,
    },
    // O padrão da loja inteira: onde a equipe erra, não só a pessoa.
    lojaPontosFracos: maisComuns(lista.map((l) => l.ponto_fraco), 5),
    lojaErros: maisComuns(lista.flatMap((l) => l.erros ?? []), 5),
    porVendedor,
    // Os laudos em si, para o gestor abrir caso a caso quando quiser.
    fechamentos: lista.slice(0, 50).map((l) => ({
      vendedor: nome.get(l.vendedor_id) ?? "Sem nome",
      cliente: l.cliente,
      resultado: l.resultado,
      valor: l.valor,
      origem: l.origem_lead,
      pontoFraco: l.ponto_fraco,
      resumo: l.resumo,
      quando: l.criado_em,
    })),
  });
}
