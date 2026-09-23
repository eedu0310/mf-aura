/**
 * Carrega os dados do CRM para a AURA usando o cliente Supabase DO USUÁRIO
 * (com as regras de loja do banco): vendedor enxerga só a própria loja,
 * o gestor enxerga todas. Nunca usa a chave de serviço aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Perfil {
  id: string;
  nome: string;
  empresa: string;
  cargo: string;
  ativo: boolean;
}

export interface Rel {
  id: string;
  owner_id: string;
  empresa: string;
  nome: string;
  temperatura: string | null;
  ultimo_contato_em: string | null;
  proximo_contato_em: string | null;
  created_at: string;
}

export interface Op {
  id: string;
  owner_id: string;
  empresa: string;
  cliente: string;
  valor: number;
  etapa: string;
  created_at: string;
  updated_at: string | null;
  relacionamento_id: string | null;
}

export interface Ativ {
  id: string;
  owner_id: string;
  empresa: string;
  tipo: string;
  titulo: string;
  ocorrida_em: string | null;
  created_at: string;
  origem: string | null;
}

export interface Venda {
  id: string;
  owner_id: string;
  empresa: string;
  cliente: string;
  valor: number;
  valor_fechado: number | null;
  data: string;
  status: string | null;
}

export interface Comp {
  id: string;
  owner_id: string;
  titulo: string;
  tipo: string | null;
  relacionamento_nome: string | null;
  data: string;
  hora: string | null;
  concluido: boolean;
}

export interface Meta {
  owner_id: string;
  mes: string | null;
  valor_meta: number;
  empresa: string | null;
}

export interface MetaAtiv {
  vendedor_id: string;
  categoria: string | null;
  periodo: string | null;
  quantidade: number;
}

export interface LeadWa {
  owner_id: string;
  nome: string | null;
  etapa: string | null;
  alertas: string[];
  proxima_acao: string | null;
  ignorado: boolean;
  updated_at: string;
}

export interface DadosCrm {
  perfil: Perfil;
  perfis: Perfil[];
  relacionamentos: Rel[];
  oportunidades: Op[];
  atividades: Ativ[];
  vendas: Venda[];
  compromissos: Comp[];
  metas: Meta[];
  metasAtividade: MetaAtiv[];
  leadsWhats: LeadWa[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

export function podeVerTudo(cargo: string | null | undefined) {
  return cargo === "Gestor";
}

export async function carregarDados(
  sb: SupabaseClient,
  userId: string,
  opts: { diasAtividades?: number; diasVendas?: number } = {},
): Promise<DadosCrm | null> {
  const { data: perfilRow } = await sb.from("profiles").select("id, nome, empresa, cargo, ativo").eq("id", userId).maybeSingle();
  if (!perfilRow) return null;
  const perfil = perfilRow as Perfil;

  const desdeAtiv = new Date(Date.now() - (opts.diasAtividades ?? 90) * 86400e3).toISOString();
  const desdeVenda = new Date(Date.now() - (opts.diasVendas ?? 400) * 86400e3).toISOString().slice(0, 10);
  const desdeComp = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);

  const [perfis, rels, ops, ativs, vendas, comps, metas, metasAtiv, leads] = await Promise.all([
    sb.from("profiles").select("id, nome, empresa, cargo, ativo"),
    sb
      .from("relacionamentos")
      .select("id, owner_id, empresa, nome, temperatura, ultimo_contato_em, proximo_contato_em, created_at")
      .limit(5000),
    sb
      .from("oportunidades")
      .select("id, owner_id, empresa, cliente, valor, etapa, created_at, updated_at, relacionamento_id")
      .limit(5000),
    sb
      .from("atividades")
      .select("id, owner_id, empresa, tipo, titulo, ocorrida_em, created_at, origem")
      .gte("created_at", desdeAtiv)
      .limit(10000),
    sb
      .from("vendas")
      .select("id, owner_id, empresa, cliente, valor, valor_fechado, data, status")
      .gte("data", desdeVenda)
      .limit(5000),
    sb
      .from("compromissos")
      .select("id, owner_id, titulo, tipo, relacionamento_nome, data, hora, concluido")
      .gte("data", desdeComp)
      .limit(3000),
    sb.from("metas").select("owner_id, mes, valor_meta, empresa").limit(3000),
    sb.from("metas_atividade").select("vendedor_id, categoria, periodo, quantidade").limit(3000),
    sb
      .from("whatsapp_ia_leads")
      .select("owner_id, nome, etapa, alertas, proxima_acao, ignorado, updated_at")
      .eq("ignorado", false)
      .limit(3000),
  ]);

  return {
    perfil,
    perfis: (perfis.data ?? []) as Perfil[],
    relacionamentos: (rels.data ?? []) as Rel[],
    oportunidades: ((ops.data ?? []) as Op[]).map((o) => ({ ...o, valor: num(o.valor) })),
    atividades: (ativs.data ?? []) as Ativ[],
    vendas: ((vendas.data ?? []) as Venda[]).map((v) => ({
      ...v,
      valor: num(v.valor),
      valor_fechado: v.valor_fechado == null ? null : num(v.valor_fechado),
    })),
    compromissos: (comps.data ?? []) as Comp[],
    metas: ((metas.data ?? []) as Meta[]).map((m) => ({ ...m, valor_meta: num(m.valor_meta) })),
    metasAtividade: ((metasAtiv.data ?? []) as MetaAtiv[]).map((m) => ({ ...m, quantidade: num(m.quantidade) })),
    leadsWhats: ((leads.data ?? []) as LeadWa[]).map((l) => ({ ...l, alertas: Array.isArray(l.alertas) ? l.alertas : [] })),
  };
}
