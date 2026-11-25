import { createHash, randomBytes } from "crypto";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { EMPRESA_DO_SITE } from "./tipos";
import { juntarHistorico, separarHistorico } from "@/lib/leads/historico-ia";

/**
 * Quem pode usar a área do Site: quem é da MF International e o gestor
 * mestre (que atravessa as lojas). O banco confere a mesma regra
 * (equipe_do_site); esta é a porta das rotas que usam a chave de serviço.
 */
export async function equipeDoSite(request?: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return null;
  if (auth.empresa !== EMPRESA_DO_SITE && !auth.gestorMestre) return null;
  return auth;
}

/** Não guardamos o IP de quem preenche: só uma impressão dele, para frear robô. */
export function impressaoDoIp(request: Request): string | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  if (!ip) return null;
  return createHash("sha256").update(`aura-site:${ip}`).digest("hex").slice(0, 32);
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

type ClienteServico = NonNullable<ReturnType<typeof import("@/lib/supabase/service").getSupabaseServiceClient>>;

/** "51 99999-1234" → "5551999991234". Vazio quando não há número. */
export function telefoneDoSite(v: string | null | undefined): string | null {
  const d = soDigitos(v);
  if (!d) return null;
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/**
 * Lead da loja para quem chegou pelo site (formulário ou chat).
 *
 * Mesmo número ou e-mail com lead ainda aberto na loja: devolve esse, não
 * abre outro. Duas LPs preenchidas pela mesma pessoa no mesmo dia viravam
 * dois leads e dois vendedores ligando para ela.
 */
export async function abrirLeadDoSite(
  sb: ClienteServico,
  dados: { empresa: string; nome: string | null; telefone: string | null; email: string | null; mensagem: string; origem: string },
): Promise<{ id: string | null; novo: boolean; erro?: string }> {
  if (dados.telefone || dados.email) {
    let q = sb
      .from("leads_recebidos")
      .select("id")
      .eq("empresa", dados.empresa)
      .not("status", "in", "(respondido,perdido)")
      .order("created_at", { ascending: false })
      .limit(1);
    q = dados.telefone ? q.eq("telefone", dados.telefone) : q.eq("email_normalizado", dados.email as string);
    const { data: aberto } = await q.maybeSingle();
    if (aberto?.id) return { id: aberto.id, novo: false };
  }

  const { data: lead, error } = await sb
    .from("leads_recebidos")
    .insert({
      empresa: dados.empresa,
      nome: dados.nome,
      telefone: dados.telefone,
      email: dados.email,
      email_normalizado: dados.email,
      mensagem_inicial: dados.mensagem.slice(0, 1500),
      origem: dados.origem,
      relacionamento_id: null,
      qualificacao_concluida: true,
    })
    .select("id")
    .single();
  if (error || !lead) return { id: null, novo: false, erro: error?.message ?? "sem retorno" };
  return { id: lead.id, novo: true };
}

/**
 * Grava no lead a conversa que a IA teve com o cliente (e o resumo, se
 * houver), para o vendedor que assumir saber o que já foi falado. O
 * cabeçalho do recado (nome, cidade, mensagem do formulário) fica; a
 * conversa antiga é trocada pela atual.
 */
export async function gravarHistoricoNoLead(
  sb: ClienteServico,
  leadId: string,
  conversa: string,
  resumo?: string | null,
  cabecalhoNovo?: string,
) {
  const { data: lead } = await sb.from("leads_recebidos").select("mensagem_inicial").eq("id", leadId).maybeSingle();
  if (!lead) return;
  const atual = separarHistorico(lead.mensagem_inicial as string | null);
  // Lead que já existia (veio antes por outro canal): mantém o recado dele e
  // acrescenta o cabeçalho novo embaixo.
  const novo = cabecalhoNovo?.trim() ?? "";
  const cabecalho =
    novo && atual.cabecalho && !atual.cabecalho.includes(novo.split("\n")[0])
      ? `${atual.cabecalho}\n\n${novo}`
      : novo || atual.cabecalho || "Atendido pelo assistente de IA";
  const patch: Record<string, unknown> = { mensagem_inicial: juntarHistorico(cabecalho, conversa) };
  if (resumo?.trim()) patch.resumo_ia = resumo.trim().slice(0, 500);
  const { error } = await sb.from("leads_recebidos").update(patch).eq("id", leadId);
  if (error) console.error("[lead] gravar histórico da IA:", error.message);
}

/** Segredo da conversa do visitante: ele guarda o valor, o banco guarda o hash. */
export function novoSegredo(): string {
  return randomBytes(24).toString("hex");
}

export function hashDoSegredo(segredo: string): string {
  return createHash("sha256").update(`aura-chat:${segredo}`).digest("hex");
}

/** "Charles Quevedo" → "Charles". Para assinar a resposta no chat. */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "Equipe MF";
}
