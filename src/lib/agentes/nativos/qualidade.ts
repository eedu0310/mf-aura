/**
 * AUDITOR DE CADASTRO — todo domingo às 10h, a faxina dos dados.
 *
 * Cadastro torto não dói no dia, dói no relatório: cliente sem cidade some
 * do mapa comercial, negócio sem valor zera a previsão, cliente duplicado
 * divide o histórico em dois e lead sem origem deixa o marketing sem saber
 * o que funciona. Quatro listas, uma por assunto, AGRUPADAS POR DONO: cada
 * vendedor recebe um card por assunto com os nomes dele, não um card por
 * cliente.
 *
 *   - cliente sem cidade;
 *   - negócio aberto sem valor a partir da Apresentação (Negociação e
 *     Fechamento ficam com o Analista de Pipeline, que cobra todo dia);
 *   - cliente duplicado na mesma loja (mesmo telefone ou mesmo e-mail);
 *   - cliente cadastrado nos últimos 90 dias sem origem.
 * Duplicado entre donos diferentes vai para o gestor da loja decidir quem fica.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, Prioridade, ResultadoAgente } from "../tipos";
import { acharEtapa, exigeValor } from "@/lib/funil";
import { anotar, chaveDe, funilDe, funisDasLojas, lerTudo, limitarPorPessoa, listaCurta, negocioEmAberto, num, plural, responsaveisDaLoja, resumosPorGestor, somarDias } from "./comum";

interface Rel {
  id: string;
  owner_id: string;
  empresa: string;
  nome: string;
  cidade: string | null;
  telefone_normalizado: string | null;
  email_normalizado: string | null;
  origem: string | null;
  origem_lead: string | null;
  created_at: string;
}

/** Grupos de clientes com o mesmo telefone ou e-mail na mesma loja. */
export function duplicados(rels: Array<Pick<Rel, "id" | "empresa" | "telefone_normalizado" | "email_normalizado">>): string[][] {
  const grupos = new Map<string, string[]>();
  for (const r of rels) {
    for (const [tipo, valor] of [["tel", r.telefone_normalizado], ["email", r.email_normalizado]] as const) {
      const v = (valor ?? "").trim().toLowerCase();
      if (!v || (tipo === "tel" && v.replace(/\D/g, "").length < 8)) continue;
      const k = `${r.empresa}|${tipo}|${v}`;
      grupos.set(k, [...(grupos.get(k) ?? []), r.id]);
    }
  }
  // O mesmo par pode repetir por telefone e por e-mail: une pelos ids.
  const vistos = new Set<string>();
  const saida: string[][] = [];
  for (const ids of grupos.values()) {
    if (ids.length < 2) continue;
    const k = [...ids].sort().join(",");
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(ids);
  }
  return saida;
}

const ASSUNTOS = {
  "sem-cidade": {
    titulo: "sem cidade",
    card: (n: number) => `${plural(n, "cliente")} sem cidade`,
    acao: "Preencha a cidade: sem ela o cliente não aparece no mapa comercial.",
    url: "/relacionamentos",
    prioridade: "baixa",
  },
  "sem-valor": {
    titulo: "negócios sem valor",
    card: (n: number) => `${plural(n, "negócio")} sem valor`,
    acao: "Lance o valor estimado: sem ele a previsão do mês fica vazia.",
    url: "/pipeline",
    prioridade: "media",
  },
  duplicados: {
    titulo: "clientes duplicados",
    card: (n: number) => plural(n, "cliente duplicado", "clientes duplicados"),
    acao: "Junte os cadastros repetidos para não dividir o histórico.",
    url: "/relacionamentos",
    prioridade: "media",
  },
  "sem-origem": {
    titulo: "clientes sem origem",
    card: (n: number) => `${plural(n, "cliente")} sem origem`,
    acao: "Diga de onde veio cada um: é o que mostra ao marketing o que funciona.",
    url: "/relacionamentos",
    prioridade: "baixa",
  },
} satisfies Record<string, { titulo: string; card: (n: number) => string; acao: string; url: string; prioridade: Prioridade }>;
type Assunto = keyof typeof ASSUNTOS;

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const [rels, ops, funis] = await Promise.all([
    lerTudo<Rel>((de, ate) =>
      sb
        .from("relacionamentos")
        .select("id, owner_id, empresa, nome, cidade, telefone_normalizado, email_normalizado, origem, origem_lead, created_at")
        .order("id")
        .range(de, ate),
    ),
    lerTudo<{ id: string; owner_id: string; empresa: string; cliente: string; valor: number; etapa: string }>((de, ate) =>
      sb.from("oportunidades").select("id, owner_id, empresa, cliente, valor, etapa").order("id").range(de, ate),
    ),
    funisDasLojas(sb, equipe.lojas()),
  ]);
  const relPorId = new Map(rels.map((r) => [r.id, r]));

  // dono → assunto → nomes
  const listas = new Map<string, Map<Assunto, string[]>>();
  const empresaDoDono = new Map<string, string>();
  const paraMestres = new Map<string, string[]>();
  const totais: Record<Assunto, number> = { "sem-cidade": 0, "sem-valor": 0, duplicados: 0, "sem-origem": 0 };
  const lancar = (ownerId: string, empresa: string, assunto: Assunto, item: string) => {
    totais[assunto]++;
    const destino = equipe.destinoDoItem(ownerId, empresa);
    if (!destino) {
      // Sem dono ativo nem gestor da loja: conta no resumo dos mestres.
      for (const m of equipe.mestres()) anotar(paraMestres, `${m.id}|${empresa}|${assunto}`, item);
      return;
    }
    empresaDoDono.set(destino, empresa);
    const porAssunto = listas.get(destino) ?? new Map<Assunto, string[]>();
    porAssunto.set(assunto, [...(porAssunto.get(assunto) ?? []), item]);
    listas.set(destino, porAssunto);
  };

  const corteOrigem = somarDias(hoje, -90);
  for (const r of rels) {
    if (!r.cidade?.trim()) lancar(r.owner_id, r.empresa, "sem-cidade", r.nome);
    if (!r.origem?.trim() && !r.origem_lead && r.created_at.slice(0, 10) >= corteOrigem) lancar(r.owner_id, r.empresa, "sem-origem", r.nome);
  }
  for (const o of ops) {
    const funil = funilDe(funis, o.empresa);
    if (!negocioEmAberto(o.etapa, funil) || num(o.valor) > 0 || exigeValor(o.etapa, funil)) continue;
    const chave = acharEtapa(o.etapa, funil)?.chave;
    if (chave !== "apresentacao" && chave !== "followup") continue;
    lancar(o.owner_id, o.empresa, "sem-valor", `${o.cliente} (${o.etapa})`);
  }
  for (const grupo of duplicados(rels)) {
    const membros = grupo.map((id) => relPorId.get(id)).filter((r): r is Rel => !!r);
    if (membros.length < 2) continue;
    const donos = new Set(membros.map((m) => m.owner_id));
    const texto = membros.map((m) => m.nome).join(" = ");
    if (donos.size === 1) lancar(membros[0].owner_id, membros[0].empresa, "duplicados", texto);
    else {
      totais.duplicados++;
      const destino = equipe.gestoresPara(membros[0].empresa);
      for (const id of destino.ids) anotar(paraMestres, `${id}|${membros[0].empresa}|duplicados`, `${texto} (donos diferentes)`);
    }
  }

  const achados: Achado[] = [];
  for (const [destino, porAssunto] of listas) {
    for (const [assunto, itens] of porAssunto) {
      const a = ASSUNTOS[assunto];
      achados.push({
        chave: chaveDe("qualidade", assunto, destino),
        empresa: empresaDoDono.get(destino) ?? "",
        destinatarioId: destino,
        titulo: `Cadastro: ${a.card(itens.length)}`,
        descricao: `${a.acao}\n${listaCurta(itens)}`,
        prioridade: a.prioridade,
        entidadeTipo: "perfil",
        entidadeId: destino,
        acaoUrl: a.url,
        expiraEmDias: 7,
      });
    }
  }
  // Gestores (da loja ou mestres): uma linha por loja e assunto.
  const linhasGestor = new Map<string, string[]>();
  for (const [k, itens] of paraMestres) {
    const [id, empresa, assunto] = k.split("|");
    anotar(linhasGestor, id, `${empresa}: ${plural(itens.length, "caso")} de ${ASSUNTOS[assunto as Assunto].titulo}`);
  }
  const resumos = resumosPorGestor({
    agente: "qualidade",
    tipo: "resumo",
    linhas: linhasGestor,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: () => "Cadastro para arrumar sem dono na loja",
    abertura: "Itens de quem saiu da empresa ou de donos diferentes:",
    prioridade: "baixa",
    acaoUrl: "/relacionamentos",
    expiraEmDias: 7,
  });

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo: `Cadastro: ${totais["sem-cidade"]} sem cidade, ${totais["sem-valor"]} negócios sem valor, ${plural(totais.duplicados, "duplicado")}, ${totais["sem-origem"]} sem origem.`,
    achados: [...final, ...resumos],
    metricas: {
      semCidade: totais["sem-cidade"],
      negociosSemValor: totais["sem-valor"],
      duplicados: totais.duplicados,
      semOrigem90d: totais["sem-origem"],
      cortadosPeloTeto: cortados,
    },
  };
}

export const agenteQualidade: DefinicaoAgente = {
  id: "qualidade",
  nome: "Auditor de Cadastro",
  cargo: "Auditor de cadastro",
  setor: "dados",
  icone: "ClipboardCheck",
  missao: "Todo domingo, manda a cada um a lista do que falta no cadastro: cidade, valor, origem e clientes repetidos.",
  agenda: { tipo: "diario", horas: [10], minuto: 0, diasSemana: [0] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
