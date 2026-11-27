import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDizQueAvaliou, fimDoTelefone, linkDeAvaliacao } from "./rastreio";

/**
 * O lado do banco do rastreio de avaliação (as regras estão em ./rastreio).
 *
 * Só preenche o que está vazio: nunca troca a hora de um envio já registrado
 * nem desfaz o que o gestor marcou. Pode rodar de novo sobre a mesma mensagem
 * (a varredura relê a memória da conversa) sem contar duas vezes.
 */

/** Cliente diz "avaliei" até 45 dias depois do link. */
const JANELA_DA_RESPOSTA_MS = 45 * 24 * 3600 * 1000;

const CAMPOS = "id, empresa, vendedor_id, telefone, enviado_em, aberto_em, confirmado_em, confirmado_por, criado_em";
type Pedido = {
  id: string;
  empresa: string;
  vendedor_id: string | null;
  telefone: string | null;
  enviado_em: string | null;
  aberto_em: string | null;
  confirmado_em: string | null;
  /** Com confirmado_em vazio: o gestor DESFEZ a avaliação. O rastreio não refaz. */
  confirmado_por: string | null;
  criado_em: string;
};

let linksEmCache: { em: number; links: { empresa: string; link: string | null }[] } | null = null;
async function linksDasLojas(sb: SupabaseClient) {
  if (linksEmCache && Date.now() - linksEmCache.em < 10 * 60 * 1000) return linksEmCache.links;
  const { data } = await sb.from("config_avaliacao").select("empresa, link_google");
  const links = ((data ?? []) as { empresa: string; link_google: string | null }[]).map((c) => ({
    empresa: c.empresa,
    link: c.link_google,
  }));
  linksEmCache = { em: Date.now(), links };
  return links;
}

/** Os pedidos de avaliação deste cliente, do mais novo para o mais antigo. */
async function pedidosDoCliente(
  sb: SupabaseClient,
  telefone: string | null,
  relacionamentos: string[],
): Promise<Pedido[]> {
  const achados = new Map<string, Pedido>();
  const fim = fimDoTelefone(telefone);

  // A ficha do cliente: pela conversa e pelo telefone. O pedido nasce com a
  // venda e quase sempre sem telefone, então o caminho é ficha → vendas.
  const fichas = new Set(relacionamentos.filter(Boolean));
  if (fim) {
    const { data } = await sb.from("relacionamentos").select("id").like("telefone_normalizado", `%${fim}`).limit(10);
    for (const r of data ?? []) fichas.add(r.id as string);
  }
  if (fichas.size) {
    const { data: vendas } = await sb.from("vendas").select("id").in("relacionamento_id", [...fichas]).limit(100);
    const ids = (vendas ?? []).map((v) => v.id as string);
    if (ids.length) {
      const { data } = await sb.from("pedidos_avaliacao").select(CAMPOS).in("venda_id", ids).limit(50);
      for (const p of (data ?? []) as Pedido[]) achados.set(p.id, p);
    }
  }
  if (fim) {
    const { data } = await sb
      .from("pedidos_avaliacao")
      .select(CAMPOS)
      .ilike("telefone", `%${fim.slice(0, 4)}%${fim.slice(4)}%`)
      .limit(20);
    for (const p of (data ?? []) as Pedido[]) {
      if (String(p.telefone ?? "").replace(/\D/g, "").endsWith(fim)) achados.set(p.id, p);
    }
  }
  return [...achados.values()].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

export interface MensagemParaRastrear {
  userId: string;
  chatJid: string;
  /** Telefone do contato (da conversa). */
  telefone: string | null;
  nome: string | null;
  /** Loja do vendedor dono da conversa. */
  empresa: string | null;
  /** Fichas do cliente já ligadas à conversa (whatsapp_ia_leads). */
  relacionamentos?: string[];
  fromMe: boolean;
  texto: string;
  /** Hora da mensagem, em milissegundos. */
  quando: number;
  /** Números dos WhatsApps da equipe: link para si mesmo ou para colega não conta. */
  numerosDaEquipe?: string[];
}

export type Rastreado = "enviado" | "novo_pedido" | "avaliou" | null;

export async function rastrearAvaliacao(sb: SupabaseClient, m: MensagemParaRastrear): Promise<Rastreado> {
  // Grupo não é cliente; mensagem vazia não tem o que ler.
  if (!m.texto?.trim() || m.chatJid.endsWith("@g.us") || m.chatJid.includes("broadcast")) return null;
  const quando = new Date(Number.isFinite(m.quando) && m.quando > 0 ? m.quando : Date.now()).toISOString();
  // Revisão de 27/11/2026: 7 dos 22 primeiros pedidos sem venda eram o
  // vendedor mandando o link para o próprio número ou para um colega.
  const fim = fimDoTelefone(m.telefone);
  if (fim && (m.numerosDaEquipe ?? []).some((n) => fimDoTelefone(n) === fim)) return null;

  if (m.fromMe) {
    const link = linkDeAvaliacao(m.texto, await linksDasLojas(sb));
    if (!link) return null;

    // O link curto da AURA já diz qual é o pedido.
    if (link.token) {
      const { data } = await sb.from("pedidos_avaliacao").select(CAMPOS).eq("token", link.token).maybeSingle();
      const p = data as Pedido | null;
      if (!p || p.enviado_em) return null;
      await sb.from("pedidos_avaliacao").update({ enviado_em: quando }).eq("id", p.id).is("enviado_em", null);
      return "enviado";
    }

    const pedidos = await pedidosDoCliente(sb, m.telefone, m.relacionamentos ?? []);
    const empresa = link.empresa ?? m.empresa;
    const daLoja = pedidos.filter((p) => !empresa || p.empresa === empresa);
    // O pedido ainda não enviado (a venda mais nova). Não havendo, e já
    // existindo pedido para o cliente, é reenvio: não conta de novo.
    const pendente = daLoja.find((p) => !p.enviado_em && !p.confirmado_em);
    if (pendente) {
      await sb
        .from("pedidos_avaliacao")
        .update({ enviado_em: quando, ...(pendente.telefone ? {} : { telefone: m.telefone }) })
        .eq("id", pendente.id)
        .is("enviado_em", null);
      return "enviado";
    }
    // Sem telefone o pedido não seria achado de novo (e cada releitura
    // criaria outro): não cria.
    if (daLoja.length || !empresa || !fim) return null;

    // Cliente sem venda lançada (ou lançada sem telefone e sem ficha): o
    // envio existiu e conta para o vendedor. Nasce o pedido, sem venda.
    const { error } = await sb.from("pedidos_avaliacao").insert({
      empresa,
      vendedor_id: m.userId,
      cliente: m.nome?.trim() || null,
      telefone: m.telefone,
      enviado_em: quando,
    });
    return error ? null : "novo_pedido";
  }

  if (!clienteDizQueAvaliou(m.texto)) return null;
  const pedidos = await pedidosDoCliente(sb, m.telefone, m.relacionamentos ?? []);
  const t = Date.parse(quando);
  // Só vale depois de o link ter ido: "avaliei" sem pedido é outra conversa.
  const alvo = pedidos.find((p) => {
    if (!p.enviado_em || p.confirmado_em) return false;
    if (p.confirmado_por) return false; // o gestor desfez: não refaz sozinho
    if (m.empresa && p.empresa !== m.empresa) return false;
    const enviado = Date.parse(p.enviado_em);
    return t >= enviado - 60_000 && t - enviado <= JANELA_DA_RESPOSTA_MS;
  });
  if (!alvo) return null;
  await sb
    .from("pedidos_avaliacao")
    // Só a avaliação: "abriu o link" é o /av/ que marca, não o "avaliei".
    .update({ confirmado_em: quando })
    .eq("id", alvo.id)
    .is("confirmado_em", null);
  return "avaliou";
}
