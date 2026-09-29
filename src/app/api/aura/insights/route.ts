import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { insightsRegras, kpisDaPagina, painelGestor, resumoVendedor, moeda, type Pagina, type Insight } from "@/lib/aura/metricas";
import { gerarRecados, iaDisponivel } from "@/lib/aura/ia";
import { textoDosMateriais } from "@/lib/aura/materiais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGINAS: Pagina[] = ["meu-dia", "agenda", "relacionamentos", "pipeline", "vendas", "atividades", "relatorio", "ranking", "whatsapp", "gestor"];

/** GET /api/aura/insights?pagina=pipeline[&refresh=1][&vendedor=<id> para gestor] */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pagina = (sp.get("pagina") ?? "meu-dia") as Pagina;
  if (!PAGINAS.includes(pagina)) return NextResponse.json({ error: "Página inválida." }, { status: 400 });

  const s = await sessaoAura();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  const { dados, userId, gestor } = s;
  const materiais = await textoDosMateriais(s.sb, dados.perfil.empresa);
  const pessoa = { nome: dados.perfil.nome, cargo: dados.perfil.cargo, loja: dados.perfil.empresa };

  if (pagina === "gestor") {
    if (!gestor) return NextResponse.json({ error: "Somente o gestor pode ver isso." }, { status: 403 });
    const loja = sp.get("loja") || undefined;
    const painel = painelGestor(dados, loja);
    const criticos = painel.vendedores.filter((v) => v.status === "critico");
    const base: Insight[] = [
      ...criticos.slice(0, 2).map((v) => ({
        tipo: "alerta" as const,
        titulo: `${v.nome} precisa de atenção`,
        detalhe: [
          v.whatsEsperando ? `${v.whatsEsperando} cliente(s) esperando no WhatsApp` : "",
          v.followupsVencidos ? `${v.followupsVencidos} follow-ups atrasados` : "",
          v.diasSemAtividade == null ? "sem atividades registradas" : v.diasSemAtividade >= 3 ? `${v.diasSemAtividade} dias sem atividade` : "",
        ].filter(Boolean).join(" · "),
      })),
      ...(painel.leadsEmRisco[0]
        ? [{ tipo: "oportunidade" as const, titulo: `${painel.leadsEmRisco.length} lead(s) em risco na equipe`, detalhe: `${painel.leadsEmRisco[0].cliente} (${painel.leadsEmRisco[0].vendedor}): ${painel.leadsEmRisco[0].motivo}` }]
        : []),
    ];
    if (!base.length) base.push({ tipo: "conquista", titulo: "Equipe em dia", detalhe: "Nenhum vendedor em situação crítica agora." });
    const metricas = {
      loja: loja ?? "todas",
      vendedores: painel.vendedores.map((v) => ({ ...v, vendidoMes: moeda(v.vendidoMes) })),
      leadsEmRisco: painel.leadsEmRisco,
    };
    const aura = await gerarRecados({ cacheKey: `${userId}|gestor|${loja ?? "*"}`, pagina, pessoa, metricas, recadosBase: base, materiais, forcar: sp.has("refresh") });
    const total = painel.vendedores.reduce((acc, v) => acc + v.vendidoMes, 0);
    return NextResponse.json({
      ...aura,
      iaDisponivel: iaDisponivel(),
      kpis: [
        { label: "Vendido no mês (equipe)", valor: moeda(total), tom: "neutro" },
        { label: "Vendedores críticos", valor: String(criticos.length), tom: criticos.length ? "ruim" : "bom" },
        { label: "Leads em risco", valor: String(painel.leadsEmRisco.length), tom: painel.leadsEmRisco.length ? "atencao" : "bom" },
        { label: "Vendedores", valor: String(painel.vendedores.length), tom: "neutro" },
      ],
    });
  }

  // Vendedor vê a si mesmo. Gestor vê a equipe — o mesmo recorte do quadro na
  // tela — a menos que abra a visão de um vendedor específico. Antes ele via a
  // propria carteira, que e vazia, e a tela jurava que nao havia nada.
  const alvo = sp.get("vendedor") && gestor ? String(sp.get("vendedor")) : gestor ? null : userId;
  const r = resumoVendedor(dados, alvo);
  const base = insightsRegras(pagina, r);
  const aura = await gerarRecados({
    cacheKey: `${userId}|${pagina}|${alvo ?? "equipe"}`,
    pagina,
    pessoa,
    metricas: r,
    recadosBase: base,
    materiais,
    forcar: sp.has("refresh"),
  });
  return NextResponse.json({ ...aura, kpis: kpisDaPagina(pagina, r), iaDisponivel: iaDisponivel() });
}
