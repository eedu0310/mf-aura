/**
 * REDATOR DO RESUMO — de segunda a sábado às 18h30, o fechamento do dia de
 * cada loja para o gestor dela, e um consolidado das quatro lojas para os
 * gestores mestres.
 *
 * Os NÚMEROS saem do banco, aqui, por regra: vendas do dia, leads que
 * chegaram e quantos foram respondidos, atividades registradas, negócios
 * novos e follow-ups vencidos na carteira. Junto vão os recados que os
 * outros agentes mandaram para este (caixa de entrada) sobre a loja.
 *
 * A IA (perfil "redacao") só ESCREVE o texto a partir desses números, com a
 * ordem de usar apenas eles. E o texto volta conferido: se aparecer um número
 * que não estava nos dados, o texto da IA é descartado e vale o resumo
 * montado à mão (regra 5 do contrato). Sem IA, sai o resumo à mão direto.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import { atividadeDoVendedor } from "@/lib/aura/cobranca";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { chaveDe, formatarMoeda, HORA_MS, lerTudo, num, plural, responsaveisDaLoja } from "./comum";

export interface NumerosDoDia {
  vendas: number;
  valorVendido: number;
  leadsRecebidos: number;
  leadsRespondidos: number;
  atividades: number;
  negociosNovos: number;
  followupsVencidos: number;
}

const VAZIO: NumerosDoDia = { vendas: 0, valorVendido: 0, leadsRecebidos: 0, leadsRespondidos: 0, atividades: 0, negociosNovos: 0, followupsVencidos: 0 };

/** Números (como valor) que aparecem num texto: "R$ 12.500" → 12500, "3,5" → 3.5. */
export function numerosDoTexto(texto: string): number[] {
  return (texto.match(/\d[\d.,]*/g) ?? [])
    .map((s) => s.replace(/[.,]$/, ""))
    .map((s) => (/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/[.,]/g, "")))
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** Todo número do texto da IA está nos dados? (data do dia vale também.) */
export function numerosConferem(texto: string, permitidos: number[]): boolean {
  const ok = new Set(permitidos.map((n) => Math.round(n * 100) / 100));
  return numerosDoTexto(texto).every((n) => ok.has(Math.round(n * 100) / 100));
}

export function resumoManual(titulo: string, n: NumerosDoDia): string {
  return [
    `${titulo}:`,
    `• ${plural(n.vendas, "venda")}${n.vendas ? ` (${formatarMoeda(n.valorVendido)})` : ""}`,
    `• ${plural(n.leadsRecebidos, "lead")} recebido${n.leadsRecebidos === 1 ? "" : "s"}, ${n.leadsRespondidos} respondido${n.leadsRespondidos === 1 ? "" : "s"}`,
    `• ${plural(n.atividades, "atividade")} registrada${n.atividades === 1 ? "" : "s"} e ${plural(n.negociosNovos, "negócio novo", "negócios novos")}`,
    `• ${plural(n.followupsVencidos, "follow-up vencido", "follow-ups vencidos")} na carteira`,
  ].join("\n");
}

function somar(a: NumerosDoDia, b: NumerosDoDia): NumerosDoDia {
  const s = { ...a };
  for (const k of Object.keys(s) as (keyof NumerosDoDia)[]) s[k] += b[k];
  return s;
}

async function escrever(ctx: ContextoAgente, titulo: string, numeros: NumerosDoDia | Record<string, NumerosDoDia>, recados: string[]): Promise<string | null> {
  const r = await ctx.ia({
    perfil: "redacao",
    maxTokens: 450,
    sistema:
      "Você escreve o resumo de fim de dia para o gestor de lojas de lareiras e aquecimento no Sul do Brasil. " +
      "Português do Brasil, tom direto, no máximo 6 frases curtas. Use SOMENTE os números dos dados, exatamente como estão; " +
      "não calcule porcentagens, não arredonde, não invente nenhum número, nome ou fato. Se um número for zero, diga sem drama. " +
      "Termine com UMA prioridade para amanhã, escrita sem números.",
    usuario: `${titulo}\nDados do dia (JSON): ${JSON.stringify(numeros)}${recados.length ? `\nRecados dos agentes:\n- ${recados.join("\n- ")}` : ""}`,
  });
  return typeof r === "string" && r.trim() ? r.trim().slice(0, 1500) : null;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const inicio = inicioDoDiaEmSaoPaulo(agora);
  const lojas = equipe.lojas();

  const [vendas, leads, atividades, ops, caixa] = await Promise.all([
    lerTudo<{ empresa: string; valor: number; valor_fechado: number | null }>((de, ate) =>
      sb.from("vendas").select("empresa, valor, valor_fechado").eq("data", hoje).order("id").range(de, ate),
    ),
    lerTudo<{ empresa: string; respondido_em: string | null; status: string }>((de, ate) =>
      sb.from("leads_recebidos").select("empresa, respondido_em, status").gte("created_at", inicio).or("natureza.is.null,natureza.eq.lead").order("id").range(de, ate),
    ),
    lerTudo<{ empresa: string; origem: string | null; tipo: string; titulo: string | null }>((de, ate) =>
      sb.from("atividades").select("empresa, origem, tipo, titulo").gte("ocorrida_em", inicio).order("id").range(de, ate),
    ),
    lerTudo<{ empresa: string }>((de, ate) => sb.from("oportunidades").select("empresa").gte("created_at", inicio).order("id").range(de, ate)),
    ctx.caixaDeEntrada().catch(() => []),
  ]);
  const vencidosPorLoja = new Map<string, number>();
  const limite = new Date(agora.getTime() - 12 * HORA_MS).toISOString();
  await Promise.all(
    lojas.map(async (l) => {
      const { count } = await sb
        .from("relacionamentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa", l)
        .lt("proximo_contato_em", limite);
      vencidosPorLoja.set(l, count ?? 0);
    }),
  );

  const porLoja: Record<string, NumerosDoDia> = {};
  for (const l of lojas) porLoja[l] = { ...VAZIO, followupsVencidos: vencidosPorLoja.get(l) ?? 0 };
  const da = (e: string) => (porLoja[e] ??= { ...VAZIO });
  for (const v of vendas) {
    da(v.empresa).vendas++;
    da(v.empresa).valorVendido += num(v.valor_fechado ?? v.valor);
  }
  for (const l of leads) {
    da(l.empresa).leadsRecebidos++;
    if (l.respondido_em || l.status === "respondido") da(l.empresa).leadsRespondidos++;
  }
  for (const a of atividades) {
    if (!atividadeDoVendedor(a.origem) || (a.tipo === "Outro" && /^(Oportunidade |IA moveu|Etapa alterada)/.test(a.titulo ?? ""))) continue;
    da(a.empresa).atividades++;
  }
  for (const o of ops) da(o.empresa).negociosNovos++;

  const deHoje = caixa.filter((c) => Date.parse(c.criadoEm) >= Date.parse(inicio));
  const recadosDe = (empresa?: string) =>
    deHoje.filter((c) => !empresa || !c.empresa || c.empresa === empresa).slice(0, 5).map((c) => c.texto.slice(0, 200));

  const dataBR = `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`;
  const permitidosDe = (n: NumerosDoDia | Record<string, NumerosDoDia>) => {
    const lista = (Object.values(n) as Array<number | NumerosDoDia>).flatMap((v): number[] =>
      typeof v === "number" ? [v] : Object.values(v),
    );
    return [...lista, lojas.length, Number(hoje.slice(8, 10)), Number(hoje.slice(5, 7)), Number(hoje.slice(0, 4))];
  };
  const textoFinal = async (titulo: string, dados: NumerosDoDia | Record<string, NumerosDoDia>, manual: string, recados: string[]) => {
    const ia = await escrever(ctx, titulo, dados, recados);
    return ia && numerosConferem(ia, permitidosDe(dados)) ? { texto: ia, comIA: true } : { texto: manual, comIA: false };
  };

  const achados: Achado[] = [];
  let textosComIA = 0;
  for (const loja of lojas) {
    const gestores = equipe.gestoresDaLoja(loja);
    if (!gestores.length) continue;
    const n = porLoja[loja];
    const { texto, comIA } = await textoFinal(`Resumo do dia ${dataBR} — ${loja}`, n, resumoManual(`${loja}, ${dataBR}`, n), recadosDe(loja));
    if (comIA) textosComIA++;
    for (const g of gestores) {
      achados.push({
        chave: chaveDe("resumo-gestor", g.id),
        empresa: loja,
        destinatarioId: g.id,
        titulo: `Resumo do dia ${dataBR}: ${loja}`,
        descricao: texto,
        prioridade: "baixa",
        entidadeTipo: "perfil",
        entidadeId: g.id,
        acaoUrl: "/gestor",
        expiraEmDias: 1,
      });
    }
  }

  const total = Object.values(porLoja).reduce(somar, { ...VAZIO });
  const manualGrupo = [
    resumoManual(`Grupo, ${dataBR}`, total),
    ...Object.entries(porLoja).map(([l, n]) => `${l}: ${plural(n.vendas, "venda")}, ${plural(n.leadsRecebidos, "lead")}, ${plural(n.atividades, "atividade")}`),
  ].join("\n");
  const consolidado = await textoFinal(`Resumo do dia ${dataBR} — as quatro lojas`, { ...porLoja, Total: total }, manualGrupo, recadosDe());
  if (consolidado.comIA) textosComIA++;
  for (const m of equipe.mestres()) {
    achados.push({
      chave: chaveDe("resumo-gestor", m.id),
      empresa: m.empresa,
      destinatarioId: m.id,
      titulo: `Resumo do dia ${dataBR}: as quatro lojas`,
      descricao: consolidado.texto,
      prioridade: "baixa",
      entidadeTipo: "perfil",
      entidadeId: m.id,
      acaoUrl: "/gestor",
      expiraEmDias: 1,
    });
  }

  const mensagens: MensagemEscritorio[] = [
    { de: "resumo-gestor", para: "todos", tipo: "relato", texto: consolidado.texto.slice(0, 800), dados: { ...total } },
  ];
  return {
    resumo: `Dia ${dataBR}: ${plural(total.vendas, "venda")} (${formatarMoeda(total.valorVendido)}), ${plural(total.leadsRecebidos, "lead")}, ${plural(total.atividades, "atividade")}; ${plural(achados.length, "resumo")} entregue${achados.length === 1 ? "" : "s"}.`,
    achados,
    mensagens,
    metricas: { ...total, resumosEntregues: achados.length, textosComIA },
  };
}

export const agenteResumoGestor: DefinicaoAgente = {
  id: "resumo-gestor",
  nome: "Redator do Resumo",
  cargo: "Redator do resumo do dia",
  setor: "gestao",
  icone: "FileText",
  missao: "No fim do dia, escreve para cada gestor o resumo da loja dele com os números reais e o que os agentes viram.",
  agenda: { tipo: "diario", horas: [18], minuto: 30, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: true,
  orcamentoMensalUsd: 3,
  tipo: "nativo",
  executar,
};
