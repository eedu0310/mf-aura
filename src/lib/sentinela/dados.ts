import type { SupabaseClient } from "@supabase/supabase-js";
import { acharEtapa, daLinha, ehFechada, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import type { CategoriaRelacionamento } from "@/lib/types";
import { type Achado, type ResultadoSentinela, horasAtras, nivelGeral } from "./tipos";

/**
 * Sentinela de Dados: o que está gravado, mas que a tela não mostra direito.
 *
 * São os defeitos que não dão erro: o negócio numa etapa que saiu do funil e
 * por isso não aparece em coluna nenhuma do pipeline, o contato com uma
 * categoria que nenhum filtro conhece, o lead que chegou e ninguém pegou, a
 * pessoa com cadastro pela metade.
 */
const CATEGORIAS_DO_APP: CategoriaRelacionamento[] = [
  "Cliente Final", "Arquiteto", "Construtora", "Revendedor", "Engenheiro",
  "Designer de Interiores", "Consultor", "Obra", "Distribuidor", "Outro",
];

export async function sentinelaDeDados(sb: SupabaseClient, agora = new Date()): Promise<ResultadoSentinela> {
  const achados: Achado[] = [];

  // ---------- 1. Lead esperando dono há mais de 24 h ----------
  const { data: parados } = await sb
    .from("leads_recebidos")
    .select("empresa")
    .in("status", ["aguardando_sdr", "atribuido_sdr"])
    .lt("created_at", horasAtras(24, agora))
    .or("natureza.is.null,natureza.eq.lead")
    .limit(1000);
  if (parados?.length) {
    const porLoja = contarPor(parados, (l) => l.empresa ?? "sem loja");
    achados.push({
      nivel: parados.length >= 10 ? "critico" : "atencao",
      titulo: "Leads sem atendimento há mais de 24 h",
      detalhe: `${parados.length} lead(s) ainda aguardando: ${formatarContagem(porLoja)}.`,
      acao: "Abrir Leads e distribuir; conferir se o cron de repasse está rodando.",
    });
  }

  // ---------- 2. Negócio aberto que não aparece no pipeline ----------
  const { data: linhasFunil } = await sb
    .from("etapas_funil")
    .select("empresa, nome, ordem, tipo, conta_no_pipeline, probabilidade, cor, ativa, chave");
  const funilDaLoja = new Map<string, EtapaFunil[]>();
  for (const l of linhasFunil ?? []) {
    const lista = funilDaLoja.get(l.empresa) ?? [];
    lista.push(daLinha(l));
    funilDaLoja.set(l.empresa, lista);
  }
  try {
    const ops = await todasAsLinhas<{ empresa: string | null; etapa: string | null }>((de, ate) =>
      sb.from("oportunidades").select("empresa, etapa").order("id").range(de, ate),
    );
    const orfas = new Map<string, number>();
    for (const o of ops) {
      const funil = funilDaLoja.get(o.empresa ?? "") ?? FUNIL_PADRAO;
      if (ehFechada(o.etapa, funil)) continue;
      const etapa = acharEtapa(o.etapa, funil);
      if (!etapa || !etapa.ativa) {
        const chave = `${o.empresa ?? "sem loja"} › "${o.etapa ?? "sem etapa"}"`;
        orfas.set(chave, (orfas.get(chave) ?? 0) + 1);
      }
    }
    const total = [...orfas.values()].reduce((s, n) => s + n, 0);
    if (total) {
      achados.push({
        nivel: "atencao",
        titulo: "Negócios fora do pipeline",
        detalhe: `${total} negócio(s) em aberto estão numa etapa que não existe (ou foi desligada) no funil da loja, e não aparecem em nenhuma coluna: ${formatarContagem(orfas, 5)}.`,
        acao: "Gestor › Funil: reativar a etapa ou mover esses negócios.",
      });
    }
  } catch (e) {
    console.error("[sentinela/dados] oportunidades:", e);
  }

  // ---------- 3. Contato com categoria que o app não conhece ----------
  const { data: categorias } = await sb
    .from("relacionamentos")
    .select("categoria")
    .not("categoria", "in", `(${CATEGORIAS_DO_APP.map((c) => `"${c}"`).join(",")})`)
    .not("categoria", "is", null)
    .limit(1000);
  if (categorias?.length) {
    const porCategoria = contarPor(categorias, (c) => String(c.categoria));
    achados.push({
      nivel: "atencao",
      titulo: "Contatos com categoria desconhecida",
      detalhe: `${categorias.length} contato(s) com categoria que nenhum filtro da tela conhece: ${formatarContagem(porCategoria)}.`,
      acao: "Corrigir a categoria (o gatilho de lead foi corrigido na migração 105).",
    });
  }

  // ---------- 4. Cadastro pela metade ----------
  const { data: perfis } = await sb
    .from("profiles")
    .select("nome, empresa, ativo, excluido_em")
    .eq("ativo", true)
    .is("excluido_em", null);
  const incompletos = (perfis ?? []).filter(
    (p) => !String(p.nome ?? "").trim() || !NOMES_EMPRESAS.includes(String(p.empresa ?? "")),
  );
  if (incompletos.length) {
    achados.push({
      nivel: "atencao",
      titulo: "Usuários ativos com cadastro incompleto",
      detalhe: `${incompletos.length} pessoa(s) ativa(s) sem nome ou sem uma das quatro lojas válidas.`,
      acao: "Gestor › Usuários: completar ou desativar.",
    });
  }

  const nivel = nivelGeral(achados);
  return {
    sentinela: "dados",
    nivel,
    achados,
    resumo: nivel === "ok" ? "Leads atendidos, pipeline íntegro e cadastros completos." : `${achados.length} ponto(s) nos dados pedindo atenção.`,
    memoria: { leadsParados: parados?.length ?? 0 },
  };
}

function contarPor<T>(lista: T[], chave: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return m;
}

function formatarContagem(m: Map<string, number>, maximo = 8): string {
  const itens = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const visiveis = itens.slice(0, maximo).map(([k, n]) => `${k} (${n})`);
  if (itens.length > maximo) visiveis.push(`e mais ${itens.length - maximo}`);
  return visiveis.join(", ");
}
