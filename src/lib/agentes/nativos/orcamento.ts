/**
 * GUARDIÃO DO ORÇAMENTO — de 6 em 6 horas olha quanto a IA está gastando.
 *
 *   - SALDO: o que sobra dos depósitos (saldoIA, src/lib/aura/custo-ia.ts)
 *     abaixo do alerta que o gestor configurou;
 *   - PICO: o gasto das últimas 24 horas passou do DOBRO da média diária dos
 *     7 dias anteriores (e de US$ 1, para não alarmar centavo);
 *   - AGENTES: cada agente tem teto mensal; quem passou de 80% aparece.
 *   - E a projeção do mês no ritmo atual, para o gestor não ser surpreendido.
 *
 * Os números saem do ia_uso, lido inteiro de mil em mil (todasAsLinhas): a
 * soma que parava nas mil primeiras linhas é exatamente o erro que deixou o
 * teto da IA sem efeito até 24/11/2026.
 *
 * Quem recebe: só os gestores mestres (o dinheiro é do grupo), um card por
 * assunto. No escritório sai um "alerta" quando há algo errado.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import { saldoIA } from "@/lib/aura/custo-ia";
import { inicioDoMesEmSaoPaulo } from "@/lib/fuso";
import { chaveDe, DIA_MS, diasNoMes, lerTudo, num, plural, responsaveisDaLoja } from "./comum";

export const MULTIPLO_DE_PICO = 2;
export const PICO_MINIMO_USD = 1;
export const ALERTA_AGENTE = 0.8;

/** O gasto das últimas 24h é um pico em relação à média diária anterior? */
export function detectarPico(ultimas24h: number, diasAnteriores: number[]): { media: number; pico: boolean } {
  const media = diasAnteriores.length ? diasAnteriores.reduce((s, v) => s + v, 0) / diasAnteriores.length : 0;
  const pico = ultimas24h >= PICO_MINIMO_USD && (media === 0 ? ultimas24h >= PICO_MINIMO_USD * 3 : ultimas24h > media * MULTIPLO_DE_PICO);
  return { media, pico };
}

const usd = (v: number) => `US$ ${v.toFixed(2).replace(".", ",")}`;

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora, hoje } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const mestres = equipe.mestres();
  const inicioMes = inicioDoMesEmSaoPaulo(agora);
  const oitoDias = new Date(agora.getTime() - 8 * DIA_MS).toISOString();
  const desde = inicioMes < oitoDias ? inicioMes : oitoDias;

  const [saldo, usos, { carregarRegistro }] = await Promise.all([
    saldoIA(true),
    lerTudo<{ funcao: string; custo_usd: number; criado_em: string }>((de, ate) =>
      sb.from("ia_uso").select("funcao, custo_usd, criado_em").gte("criado_em", desde).order("id").range(de, ate),
    ),
    // Import tardio: o motor importa o índice, que importa este arquivo.
    import("../motor"),
  ]);

  const t = agora.getTime();
  let ultimas24h = 0;
  const diarios = new Array<number>(7).fill(0);
  let gastoMes = 0;
  const porFuncao = new Map<string, number>();
  for (const u of usos) {
    const custo = num(u.custo_usd);
    const quando = Date.parse(u.criado_em);
    const idade = t - quando;
    if (idade <= DIA_MS) ultimas24h += custo;
    else if (idade <= 8 * DIA_MS) diarios[Math.min(6, Math.floor(idade / DIA_MS) - 1)] += custo;
    if (u.criado_em >= inicioMes) {
      gastoMes += custo;
      porFuncao.set(u.funcao, (porFuncao.get(u.funcao) ?? 0) + custo);
    }
  }
  const { media, pico } = detectarPico(ultimas24h, diarios);
  const dia = Number(hoje.slice(8, 10));
  const projecao = dia > 0 ? (gastoMes / dia) * diasNoMes(hoje) : gastoMes;
  const maiores = [...porFuncao].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // O registro inteiro (com o teto que o mestre mudou na tela, a Diretora e os
  // configuráveis): antes só os nativos com o teto do código entravam na conta.
  const registro = await carregarRegistro(sb, true);
  const agentesNoLimite = registro
    .filter((a) => a.tipo !== "sistema" && a.orcamentoMensalUsd > 0)
    .map((a) => ({ a, gasto: porFuncao.get(`agente/${a.id}`) ?? 0 }))
    .filter((x) => x.gasto >= x.a.orcamentoMensalUsd * ALERTA_AGENTE);

  const saldoBaixo = saldo.depositado > 0 && saldo.saldo <= saldo.alerta;

  const achados: Achado[] = [];
  const mensagens: MensagemEscritorio[] = [];
  const para = (tipo: string, base: Omit<Achado, "chave" | "destinatarioId" | "empresa">) => {
    for (const m of mestres) achados.push({ ...base, chave: chaveDe("orcamento", tipo, m.id), destinatarioId: m.id, empresa: m.empresa });
  };
  const linhaMaiores = maiores.map(([f, v]) => `${f}: ${usd(v)}`).join("; ");

  if (saldoBaixo) {
    para("saldo", {
      titulo: saldo.saldo <= 0 ? "A IA está sem saldo" : `Saldo da IA baixo: ${usd(saldo.saldo)}`,
      descricao:
        `Restam ${usd(saldo.saldo)} dos ${usd(saldo.depositado)} depositados (alerta em ${usd(saldo.alerta)}). ` +
        `No ritmo atual o mês fecha em ${usd(projecao)}. Faça um depósito ou reduza o uso.`,
      prioridade: saldo.saldo <= 0 ? "urgente" : "alta",
      acaoUrl: "/gestor?aba=custo-ia",
      expiraEmDias: 1,
    });
  }
  if (pico) {
    para("pico", {
      titulo: `Gasto da IA disparou: ${usd(ultimas24h)} em 24h`,
      descricao: `A média dos 7 dias anteriores era ${usd(media)} por dia. Quem mais gastou no mês: ${linhaMaiores || "—"}.`,
      prioridade: "alta",
      acaoUrl: "/gestor?aba=custo-ia",
      expiraEmDias: 1,
    });
  }
  if (agentesNoLimite.length) {
    para("agentes", {
      titulo: `${plural(agentesNoLimite.length, "agente")} perto do teto de IA`,
      descricao: agentesNoLimite
        .map((x) => `${x.a.nome}: ${usd(x.gasto)} de ${usd(x.a.orcamentoMensalUsd)}${x.gasto >= x.a.orcamentoMensalUsd ? " (teto atingido)" : ""}`)
        .join("\n"),
      prioridade: agentesNoLimite.some((x) => x.gasto >= x.a.orcamentoMensalUsd) ? "alta" : "media",
      acaoUrl: "/gestor?aba=agentes-equipe",
      expiraEmDias: 1,
    });
  }
  if (saldoBaixo || pico || agentesNoLimite.length) {
    mensagens.push({
      de: "orcamento",
      tipo: "alerta",
      texto:
        [
          saldoBaixo ? `saldo da IA em ${usd(saldo.saldo)}` : "",
          pico ? `gasto de ${usd(ultimas24h)} nas últimas 24h (média ${usd(media)}/dia)` : "",
          agentesNoLimite.length ? `${plural(agentesNoLimite.length, "agente")} acima de 80% do teto` : "",
        ]
          .filter(Boolean)
          .join("; ")
          .replace(/^./, (c) => c.toUpperCase()) + ".",
      dados: { gastoMes, projecao, ultimas24h, mediaDiaria: media },
    });
  }

  return {
    resumo: `IA no mês: ${usd(gastoMes)} (projeção ${usd(projecao)}); últimas 24h ${usd(ultimas24h)}${pico ? " — pico!" : ""}; saldo ${usd(saldo.saldo)}.`,
    achados,
    mensagens,
    metricas: {
      gastoMesUsd: Math.round(gastoMes * 100) / 100,
      projecaoMesUsd: Math.round(projecao * 100) / 100,
      ultimas24hUsd: Math.round(ultimas24h * 100) / 100,
      mediaDiariaUsd: Math.round(media * 100) / 100,
      saldoUsd: Math.round(saldo.saldo * 100) / 100,
      agentesNoLimite: agentesNoLimite.length,
    },
  };
}

export const agenteOrcamento: DefinicaoAgente = {
  id: "orcamento",
  nome: "Guardião do Orçamento",
  cargo: "Guardião do orçamento de IA",
  setor: "gestao",
  icone: "Wallet",
  missao: "Vigia o gasto da IA: saldo baixo, picos fora do normal e agentes perto do teto, com aviso aos gestores mestres.",
  agenda: { tipo: "intervalo", minutos: 360 },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
