/**
 * CURADOR DO CONHECIMENTO — toda noite às 22h arruma o que a AURA aprendeu.
 *
 * As sugestões chegam de três lugares (laudo de fechamento, rodada noturna
 * das conversas e o Ouvinte das Conversas) e se acumulam: hoje são centenas
 * esperando o gestor.
 *
 * QUEM APROVA OU RECUSA é o Revisor do Aprendizado (revisor-aprendizado.ts),
 * por decisão do dono em 25/11/2026. O curador não aprova nada nem propõe
 * aprovação; ele cuida da ORGANIZAÇÃO:
 *
 *   1. ACHA REPETIDOS: a chave única do banco já impede o idêntico, mas
 *      "lareira esquenta a casa toda" e "a lareira aquece a casa inteira"
 *      entram separadas. Não há caminho aprovado para juntar dois registros,
 *      então o curador APONTA os grupos para o gestor e não mexe em nada
 *      (o revisor, por sua vez, recusa o que repete um item já aprovado);
 *   2. CONTA AS VELHAS: sugestão com mais de 90 dias, vista uma vez só e sem
 *      negócio fechado. A tabela não tem status de "arquivado" (só sugerido,
 *      aprovado e recusado). Fica no relatório.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import { anotar, lerTudo, plural, responsaveisDaLoja, resumosPorGestor, somarDias } from "./comum";

export interface AprendizadoLinha {
  id: string;
  empresa: string;
  canal: string;
  tipo: string;
  gatilho: string;
  resposta: string;
  chave: string;
  vezes_visto: number;
  vezes_fechou: number;
  vezes_perdeu: number | null;
  status: string;
  criado_em: string;
}

const PALAVRAS_VAZIAS = new Set([
  "que", "com", "para", "por", "uma", "um", "dos", "das", "nos", "nas", "the", "mais", "muito", "esta", "este", "isso",
  "cliente", "sobre", "como", "qual", "quais", "ele", "ela", "tem", "ter", "sao", "nao", "sim", "seu", "sua",
]);

function palavras(chave: string): Set<string> {
  return new Set(chave.split(" ").filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p)));
}

/** Semelhança de Jaccard entre dois conjuntos de palavras. */
export function semelhanca(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let comum = 0;
  for (const p of a) if (b.has(p)) comum++;
  return comum / (a.size + b.size - comum);
}

/**
 * Grupos de aprendizados parecidos (mesma loja, canal e tipo). Só entra
 * grupo que tem ao menos uma sugestão pendente — dois aprovados parecidos
 * já foram decisão do gestor.
 */
export function gruposParecidos(lista: AprendizadoLinha[], limite = 0.7): AprendizadoLinha[][] {
  const blocos = new Map<string, AprendizadoLinha[]>();
  for (const a of lista) {
    if (a.status === "recusado") continue;
    const k = `${a.empresa}|${a.canal}|${a.tipo}`;
    blocos.set(k, [...(blocos.get(k) ?? []), a]);
  }
  const grupos: AprendizadoLinha[][] = [];
  for (const bloco of blocos.values()) {
    const itens = bloco.slice(0, 600).map((a) => ({ a, p: palavras(a.chave) }));
    const pai = itens.map((_, i) => i);
    const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
    for (let i = 0; i < itens.length; i++) {
      for (let j = i + 1; j < itens.length; j++) {
        if (semelhanca(itens[i].p, itens[j].p) >= limite) pai[raiz(i)] = raiz(j);
      }
    }
    const porRaiz = new Map<number, AprendizadoLinha[]>();
    itens.forEach((x, i) => porRaiz.set(raiz(i), [...(porRaiz.get(raiz(i)) ?? []), x.a]));
    for (const g of porRaiz.values()) if (g.length > 1 && g.some((a) => a.status === "sugerido")) grupos.push(g);
  }
  return grupos;
}


async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const [lista, caixa] = await Promise.all([
    lerTudo<AprendizadoLinha>((de, ate) =>
      sb
        .from("aura_aprendizado")
        .select("id, empresa, canal, tipo, gatilho, resposta, chave, vezes_visto, vezes_fechou, vezes_perdeu, status, criado_em")
        .order("id")
        .range(de, ate),
    ),
    ctx.caixaDeEntrada().catch(() => []),
  ]);

  const pendentes = lista.filter((a) => a.status === "sugerido");

  // 1. Repetidos (só apontar: não há caminho aprovado para juntar registros).
  const grupos = gruposParecidos(lista);

  // 2. Velhos sem evidência (só contar: não existe status de "arquivado").
  const corte = somarDias(hoje, -90);
  const velhos = pendentes.filter((a) => a.criado_em.slice(0, 10) < corte && a.vezes_visto <= 1 && a.vezes_fechou === 0).length;

  // Um card por gestor com os grupos repetidos (mestre: todas as lojas).
  const linhasGestor = new Map<string, string[]>();
  const grupoPorEmpresa = new Map<string, number>();
  for (const g of [...grupos].sort((a, b) => b.length - a.length)) {
    const empresa = g[0].empresa;
    grupoPorEmpresa.set(empresa, (grupoPorEmpresa.get(empresa) ?? 0) + 1);
    const destino = equipe.gestoresPara(empresa);
    const texto = g.slice(0, 3).map((a) => `"${a.gatilho.slice(0, 50)}"`).join(" = ") + (g.length > 3 ? ` (+${g.length - 3})` : "");
    for (const id of destino.ids) anotar(linhasGestor, id, `${destino.mestres ? `${empresa}: ` : ""}${texto}`);
  }
  const achados: Achado[] = resumosPorGestor({
    agente: "curador",
    tipo: "repetidos",
    linhas: linhasGestor,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: (n) => `${plural(n, "grupo", "grupos")} de aprendizados repetidos`,
    abertura: "Dizem a mesma coisa com outras palavras. Fique com o melhor de cada grupo e recuse os outros:",
    prioridade: "baixa",
    acaoUrl: "/gestor?aba=aprendizado",
    expiraEmDias: 1,
  });

  const daCaixa = caixa.filter((c) => c.tipo === "aprendizado").length;
  const mensagens: MensagemEscritorio[] = [
    {
      de: "curador",
      para: "todos",
      tipo: "relato",
      texto:
        `Curadoria da noite: ${plural(pendentes.length, "sugestão", "sugestões")} na fila, ` +
        `${plural(grupos.length, "grupo")} de repetidos para o gestor juntar, ${velhos} sugestões velhas sem evidência` +
        (daCaixa ? `; ${plural(daCaixa, "aviso")} de aprendizado recebido${daCaixa === 1 ? "" : "s"} dos colegas.` : "."),
      dados: { gruposPorLoja: Object.fromEntries(grupoPorEmpresa) },
    },
  ];

  return {
    resumo: `${pendentes.length} sugestões na fila, ${plural(grupos.length, "grupo repetido", "grupos repetidos")}, ${velhos} sem evidência há 90+ dias.`,
    achados,
    mensagens,
    metricas: {
      total: lista.length,
      pendentes: pendentes.length,
      gruposRepetidos: grupos.length,
      velhosSemEvidencia: velhos,
    },
  };
}


export const agenteCurador: DefinicaoAgente = {
  id: "curador",
  nome: "Curador do Conhecimento",
  cargo: "Curador da base de conhecimento",
  setor: "conhecimento",
  icone: "Library",
  missao: "Toda noite organiza o que a AURA aprendeu: aponta sugestões repetidas e conta as velhas sem evidência. Quem aprova é o Revisor.",
  agenda: { tipo: "diario", horas: [22], minuto: 0 },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
