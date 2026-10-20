import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravarExigindoLinha } from "@/lib/supabase/gravar";

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  categoria: string | null;
  /** Frase pronta para o WhatsApp. Vazio = o link não aparece no botão de links da conversa. */
  mensagemWhatsapp: string | null;
  ordem: number;
}

export const CATEGORIAS_DE_LINK = ["Catálogo", "Planilha", "Vendas", "Marketing", "Outro"] as const;

function daLinha(l: Record<string, unknown>): LinkUtil {
  return {
    id: String(l.id),
    titulo: String(l.titulo ?? ""),
    url: String(l.url ?? ""),
    categoria: (l.categoria as string | null) ?? null,
    mensagemWhatsapp: (l.mensagem_whatsapp as string | null) ?? null,
    ordem: Number(l.ordem ?? 0),
  };
}

export async function listarLinks(): Promise<LinkUtil[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("links_uteis")
    .select("id, titulo, url, categoria, mensagem_whatsapp, ordem")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar links:", error);
    return [];
  }
  return (data ?? []).map(daLinha);
}

/** Só os links que têm frase para o WhatsApp, na ordem do gestor. */
export async function listarLinksParaWhatsapp(): Promise<LinkUtil[]> {
  const todos = await listarLinks();
  return (todos ?? []).filter((l) => (l.mensagemWhatsapp ?? "").trim() !== "");
}

/** O texto que cai no campo da conversa: a frase, e o link na linha de baixo. */
export function textoParaWhatsapp(link: LinkUtil): string {
  const frase = (link.mensagemWhatsapp ?? "").trim();
  return frase ? `${frase}\n${link.url}` : link.url;
}

export interface DadosDoLink {
  titulo: string;
  url: string;
  categoria?: string | null;
  mensagemWhatsapp?: string | null;
  ordem?: number;
}

function paraLinha(dados: Partial<DadosDoLink>) {
  const linha: Record<string, unknown> = {};
  if (dados.titulo !== undefined) linha.titulo = dados.titulo.trim();
  if (dados.url !== undefined) linha.url = dados.url.trim();
  if (dados.categoria !== undefined) linha.categoria = dados.categoria || null;
  if (dados.mensagemWhatsapp !== undefined) linha.mensagem_whatsapp = dados.mensagemWhatsapp?.trim() || null;
  if (dados.ordem !== undefined) linha.ordem = dados.ordem;
  return linha;
}

export async function criarLink(empresa: string, dados: DadosDoLink): Promise<LinkUtil> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Banco não configurado.");
  if (!dados.titulo.trim() || !dados.url.trim()) throw new Error("Título e endereço são obrigatórios.");

  const { data, error } = await supabase
    .from("links_uteis")
    .insert({ empresa, ...paraLinha(dados) })
    .select("id, titulo, url, categoria, mensagem_whatsapp, ordem")
    .single();

  if (error || !data) {
    throw new Error(
      error?.code === "42501"
        ? "Só o gestor aprovado da loja cadastra links."
        : `Não consegui salvar o link: ${error?.message ?? "sem resposta"}`,
    );
  }
  return daLinha(data);
}

export async function atualizarLink(id: string, dados: Partial<DadosDoLink>): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Banco não configurado.");
  const linha = paraLinha(dados);
  if (Object.keys(linha).length === 0) return;
  await gravarExigindoLinha(
    supabase.from("links_uteis").update(linha, { count: "exact" }).eq("id", id),
    "o link",
  );
}

export async function apagarLink(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Banco não configurado.");
  await gravarExigindoLinha(
    supabase.from("links_uteis").delete({ count: "exact" }).eq("id", id),
    "o link",
  );
}
