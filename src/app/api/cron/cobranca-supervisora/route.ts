import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { rodarCron } from "@/lib/cron/execucao";
import { CARGOS_QUE_VENDEM } from "@/lib/types";
import {
  ROTULO_COBRANCA,
  atividadeDoVendedor,
  contextoDaCobranca,
  itensDaCobranca,
  relacionamentoDoVendedor,
  type NumerosDoMes,
} from "@/lib/aura/cobranca";

export const runtime = "nodejs";
export const maxDuration = 120;

const TZ = "America/Sao_Paulo";
const TITULO_VENDEDOR = "A supervisora quer saber";
const TITULO_GESTOR = "Cobrança da supervisora";

/**
 * Cobrança diária da supervisora (pedido do Elton em 19/11/2026).
 *
 * Toda manhã, de segunda a sábado, quem vende e está zerado no mês em
 * oportunidade criada, fechamento, atividade ou relacionamento recebe uma
 * cobrança com a pergunta "por quê" de cada item. A resposta fica no Meu Dia
 * e o gestor da loja lê no painel. Uma cobrança por pessoa por dia: rodar de
 * novo não duplica nada.
 *
 * Erro de leitura NÃO vira cobrança: cobrar alguém por um zero que veio de
 * uma consulta que falhou é pior do que não cobrar.
 */
export async function GET(request: Request) {
  return rodarCron(request, "cobranca-supervisora", () => cobrar(request));
}

async function cobrar(request: Request): Promise<Record<string, unknown>> {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("Supabase não configurado.");

  const agora = new Date();
  const dia = agora.toLocaleDateString("en-CA", { timeZone: TZ });
  const mes = dia.slice(0, 7);
  const diaDoMes = Number(dia.slice(8, 10));
  const diaDaSemana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  const forcar = new URL(request.url).searchParams.get("forcar") === "1";
  if (!forcar && diaDaSemana === 0) return { pulado: "domingo" };

  const inicioMes = `${mes}-01T00:00:00-03:00`;

  /**
   * Lê todas as linhas, de mil em mil (o limite de cada consulta). Ordena por
   * id: sem ordem estável as páginas podem repetir ou pular linhas.
   */
  async function todas(tabela: string, colunas: string, filtro: (q: any) => any) {
    const linhas: Record<string, unknown>[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await filtro(sb!.from(tabela).select(colunas)).order("id").range(de, de + 999);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      linhas.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < 1000) return linhas;
    }
  }

  let pessoas: Record<string, unknown>[];
  let ops: Record<string, unknown>[];
  let vendas: Record<string, unknown>[];
  let ativs: Record<string, unknown>[];
  let rels: Record<string, unknown>[];
  let jaHoje: Record<string, unknown>[];
  try {
    [pessoas, ops, vendas, ativs, rels, jaHoje] = await Promise.all([
      todas("profiles", "id, nome, cargo, empresa, ativo, gestor_mestre, gestor_aprovado", (q) => q.eq("ativo", true)),
      todas("oportunidades", "owner_id", (q) => q.gte("created_at", inicioMes)),
      todas("vendas", "owner_id, parceiro_id", (q) => q.gte("data", `${mes}-01`)),
      todas("atividades", "owner_id, origem, relacionamento_id", (q) => q.gte("created_at", inicioMes)),
      todas("relacionamentos", "owner_id, origem", (q) => q.gte("created_at", inicioMes)),
      todas("aura_cobrancas", "vendedor_id", (q) => q.eq("dia", dia)),
    ]);
  } catch (e) {
    throw new Error(`Falha ao ler o mês: ${(e as Error).message}`);
  }

  const conta = (linhas: Record<string, unknown>[], id: string, passa: (l: Record<string, unknown>) => boolean = () => true) =>
    linhas.filter((l) => String(l.owner_id) === id && passa(l)).length;
  const jaCobrado = new Set(jaHoje.map((c) => String(c.vendedor_id)));

  const vendedores = pessoas.filter((p) => (CARGOS_QUE_VENDEM as readonly string[]).includes(String(p.cargo)));
  const novas: { vendedor_id: string; empresa: string | null; dia: string; itens: unknown; contexto: string | null }[] = [];
  const resumo: { nome: string; empresa: string; itens: string[] }[] = [];

  for (const p of vendedores) {
    const id = String(p.id);
    const conversas = new Set(
      ativs
        .filter((a) => String(a.owner_id) === id && a.origem === "whatsapp_auto" && a.relacionamento_id)
        .map((a) => String(a.relacionamento_id)),
    ).size;
    const numeros: NumerosDoMes = {
      oportunidadesCriadas: conta(ops, id),
      // Venda em dupla conta para os dois: o parceiro também fechou.
      fechamentos: vendas.filter((v) => String(v.owner_id) === id || String(v.parceiro_id) === id).length,
      atividades: conta(ativs, id, (a) => atividadeDoVendedor(a.origem as string | null)),
      relacionamentos: conta(rels, id, (r) => relacionamentoDoVendedor(r.origem as string | null)),
      conversasWhatsapp: conversas,
    };
    const itens = itensDaCobranca(numeros, diaDoMes);
    if (!itens.length) continue;
    resumo.push({ nome: String(p.nome ?? "sem nome"), empresa: String(p.empresa ?? ""), itens: itens.map((i) => ROTULO_COBRANCA[i.chave]) });
    if (jaCobrado.has(id)) continue;
    novas.push({ vendedor_id: id, empresa: (p.empresa as string) ?? null, dia, itens, contexto: contextoDaCobranca(numeros) });
  }

  if (!novas.length) {
    return { dia, zerados: resumo.length, enviadas: 0 };
  }

  const { data: gravadas, error: erroGravar } = await sb
    .from("aura_cobrancas")
    .upsert(novas, { onConflict: "vendedor_id,dia", ignoreDuplicates: true })
    .select("vendedor_id");
  if (erroGravar) {
    throw new Error(`Falha ao gravar as cobranças: ${erroGravar.message}`);
  }
  const gravouPara = new Set((gravadas ?? []).map((g) => String(g.vendedor_id)));

  const avisos: Record<string, unknown>[] = novas
    .filter((n) => gravouPara.has(n.vendedor_id))
    .map((n) => {
      const itens = n.itens as { texto: string }[];
      return {
        vendedor_id: n.vendedor_id,
        titulo: TITULO_VENDEDOR,
        mensagem: `${itens.map((i) => i.texto).join(" ")} Abra o Meu Dia e responda o porquê.`,
        tipo: "alerta",
        acao_url: "/meu-dia",
      };
    });

  // Gestor: um resumo da loja (o mestre vê as quatro). Gestor não aprovado
  // não recebe, porque a RLS não deixa ele abrir as respostas.
  const vêTudo = (g: Record<string, unknown>) => g.gestor_mestre === true;
  const gestores = pessoas.filter((g) => String(g.cargo) === "Gestor" && g.gestor_aprovado === true);
  for (const g of gestores) {
    const daLoja = vêTudo(g) ? resumo : resumo.filter((r) => r.empresa === String(g.empresa));
    if (!daLoja.length) continue;
    avisos.push({
      vendedor_id: String(g.id),
      titulo: TITULO_GESTOR,
      mensagem:
        `${daLoja.length} ${daLoja.length === 1 ? "vendedor zerado" : "vendedores zerados"} no mês: ` +
        daLoja
          .map((r) => `${r.nome}${vêTudo(g) ? ` (${r.empresa})` : ""}: ${r.itens.join(", ").toLowerCase()}`)
          .join("; ") +
        ". As respostas aparecem no painel do gestor.",
      tipo: "alerta",
      acao_url: "/gestor",
    });
  }

  if (avisos.length) {
    const { error } = await sb.from("notificacoes").insert(avisos);
    if (error) {
      throw new Error(`Cobranças gravadas (${gravouPara.size}), mas os avisos falharam: ${error.message}`);
    }
  }

  return { dia, zerados: resumo.length, enviadas: gravouPara.size, avisos: avisos.length, quem: resumo };
}
