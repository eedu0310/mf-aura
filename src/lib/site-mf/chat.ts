import { NextResponse } from "next/server";
import type { getSupabaseServiceClient } from "@/lib/supabase/service";
import { hashDoSegredo } from "./servidor";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

/** Contato fixo da MF que o widget mostra (conferido em 22/10/2026). */
export const CONTATO_MF = {
  telefone: "(51) 3536-1422",
  whatsapp: "555135361422",
  endereco: "ERS-122, Km 08, Conceição · São Sebastião do Caí/RS",
  site: "https://mfinternational.com.br",
};

/** Quanto tempo sem sinal ainda conta como "com a AURA aberta". */
export const PRESENCA_VALE_MS = 3 * 60 * 1000;

/**
 * O widget roda no site da MF (outro domínio) e chama estas rotas de lá.
 * Não há cookie nem login envolvido: liberar a origem não abre nada além
 * do que a própria rota já confere.
 */
export function cors<T extends Response>(res: T): T {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function respostaCors(corpo: unknown, status = 200) {
  return cors(NextResponse.json(corpo, { status }));
}

export function preflight() {
  return cors(new NextResponse(null, { status: 204 }));
}

export interface ConversaDoVisitante {
  id: string;
  empresa: string;
  status: string;
  nome: string | null;
  atendente_id: string | null;
  nao_lidas: number;
  visitante_visto_em: string | null;
  lead_id: string | null;
}

/** Confere conversa + segredo do visitante. Nulo se não bater. */
export async function conversaDoVisitante(sb: ClienteServico, id: unknown, segredo: unknown): Promise<ConversaDoVisitante | null> {
  const c = typeof id === "string" ? id : "";
  const t = typeof segredo === "string" ? segredo : "";
  if (!/^[0-9a-f-]{36}$/i.test(c) || t.length < 20 || t.length > 100) return null;
  const { data } = await sb
    .from("site_conversas")
    .select("id, empresa, status, nome, atendente_id, nao_lidas, visitante_visto_em, lead_id, token_hash")
    .eq("id", c)
    .maybeSingle();
  if (!data || data.token_hash !== hashDoSegredo(t)) return null;
  const { token_hash: _ignorar, ...conversa } = data;
  void _ignorar;
  return conversa as ConversaDoVisitante;
}

export interface Atendente {
  id: string | null;
  nome: string;
  online: boolean;
  /** Foto de perfil de quem atende, quando a pessoa colocou. */
  foto: string | null;
}

/**
 * Quem aparece no topo do widget.
 *  1. quem já está atendendo esta conversa;
 *  2. alguém da equipe com a AURA aberta e disponível;
 *  3. o atendente padrão da configuração (o Charles, na MF).
 * Para o cliente aparece sempre "online": a mensagem fica esperando e a
 * equipe é avisada.
 */
export async function atendenteDoWidget(sb: ClienteServico, empresa: string, preferido?: string | null): Promise<Atendente> {
  const desde = new Date(Date.now() - PRESENCA_VALE_MS).toISOString();
  const { data: presentes } = await sb
    .from("site_presenca")
    .select("profile_id, visto_em")
    .eq("empresa", empresa)
    .eq("disponivel", true)
    .gte("visto_em", desde)
    .order("visto_em", { ascending: false })
    .limit(10);
  const idsOnline = (presentes ?? []).map((p) => p.profile_id as string);

  const { data: config } = await sb.from("site_chat_config").select("atendente_padrao_id").eq("empresa", empresa).maybeSingle();
  const candidatos = [preferido, ...idsOnline, config?.atendente_padrao_id].filter(Boolean) as string[];
  if (!candidatos.length) return { id: null, nome: "Equipe MF", online: false, foto: null };

  const { data: perfis } = await sb.from("profiles").select("id, nome, ativo, foto_url").in("id", [...new Set(candidatos)]);
  const ativo = new Map((perfis ?? []).filter((p) => p.ativo !== false).map((p) => [p.id as string, p]));
  const escolhido = candidatos.find((id) => ativo.has(id));
  if (!escolhido) return { id: null, nome: "Equipe MF", online: idsOnline.length > 0, foto: null };
  const p = ativo.get(escolhido)!;
  return { id: escolhido, nome: limparNome(String(p.nome ?? "Equipe MF")), online: idsOnline.length > 0, foto: (p.foto_url as string | null) ?? null };
}

/** "Charles  Quevedo" → "Charles Quevedo"; tira " - Vendedor" e afins. */
export function limparNome(nome: string): string {
  return nome.split(" - ")[0].replace(/\s+/g, " ").trim() || "Equipe MF";
}

/** Avisa na AURA (sino) quem precisa saber de uma conversa nova. */
export async function avisarEquipe(sb: ClienteServico, empresa: string, ids: (string | null | undefined)[], titulo: string, mensagem: string) {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  if (!unicos.length) return;
  const { error } = await sb.from("notificacoes").insert(
    unicos.map((id) => ({ vendedor_id: id, titulo, mensagem: mensagem.slice(0, 300), tipo: "lead", acao_url: "/site-mf" })),
  );
  if (error) console.error(`[chat ${empresa}] avisar equipe:`, error.message);
}

/** Ícones que o widget sabe desenhar nos atalhos. */
export const ICONES_DE_ATALHO = [
  { id: "catalogo", nome: "Catálogo" },
  { id: "chama", nome: "Chama (tecnologia)" },
  { id: "celular", nome: "Celular (realidade aumentada)" },
  { id: "cubo", nome: "Cubo (bloco 3D)" },
  { id: "manual", nome: "Manual" },
  { id: "documento", nome: "Documento" },
] as const;

export interface Atalho {
  slug: string;
  titulo: string;
  subtitulo: string;
  icone: string;
}

/** Atalhos do widget: só formato válido, no máximo 8. */
export function limparAtalhos(bruto: unknown): Atalho[] {
  if (!Array.isArray(bruto)) return [];
  const icones = new Set<string>(ICONES_DE_ATALHO.map((i) => i.id));
  return bruto
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      slug: String(a.slug ?? "").trim(),
      titulo: String(a.titulo ?? "").trim().slice(0, 60),
      subtitulo: String(a.subtitulo ?? "").trim().slice(0, 90),
      icone: icones.has(String(a.icone)) ? String(a.icone) : "documento",
    }))
    .filter((a) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(a.slug) && a.titulo)
    .slice(0, 8);
}

/** Quem avisar de um contato do site sem dono: quem está online e o atendente padrão. */
export async function quemAvisar(sb: ClienteServico, empresa: string): Promise<string[]> {
  const desde = new Date(Date.now() - PRESENCA_VALE_MS).toISOString();
  const [{ data: online }, { data: config }] = await Promise.all([
    sb.from("site_presenca").select("profile_id").eq("empresa", empresa).eq("disponivel", true).gte("visto_em", desde),
    sb.from("site_chat_config").select("atendente_padrao_id").eq("empresa", empresa).maybeSingle(),
  ]);
  return [...new Set([...(online ?? []).map((o) => o.profile_id as string), config?.atendente_padrao_id].filter(Boolean) as string[])];
}

/** Fotos de perfil de quem respondeu, para o widget mostrar ao lado da mensagem. */
export async function fotosDosAutores(sb: ClienteServico, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  if (!unicos.length) return new Map();
  const { data } = await sb.from("profiles").select("id, foto_url").in("id", unicos);
  return new Map((data ?? []).filter((p) => p.foto_url).map((p) => [p.id as string, p.foto_url as string]));
}

// ---------------------------------------------------------------- anexos

/** O que o chat aceita como arquivo, e com que extensão guarda. */
const TIPOS_DE_ANEXO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/zip": "zip",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
export const ANEXO_MAXIMO = 15 * 1024 * 1024;

export interface Anexo {
  anexo_url: string;
  anexo_tipo: string;
  anexo_nome: string;
  anexo_tamanho: number;
}

/** Tipo sem parâmetros: "audio/webm;codecs=opus" → "audio/webm". */
function tipoBase(tipo: string) {
  return (tipo || "").split(";")[0].trim().toLowerCase();
}

/**
 * Guarda o arquivo de uma conversa na pasta "site-chat". O caminho leva um
 * código aleatório: a pasta é pública (o cliente precisa abrir o que a
 * equipe manda), mas ninguém adivinha o endereço.
 */
export async function salvarAnexo(sb: ClienteServico, conversaId: string, arquivo: File): Promise<Anexo | { erro: string }> {
  const tipo = tipoBase(arquivo.type);
  const ext = TIPOS_DE_ANEXO[tipo];
  if (!ext) return { erro: "Esse tipo de arquivo não é aceito. Envie foto, PDF, documento, planilha, áudio ou vídeo." };
  if (arquivo.size > ANEXO_MAXIMO) return { erro: "Arquivo grande demais (máximo 15 MB)." };
  const base =
    (arquivo.name || "arquivo")
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "arquivo";
  const caminho = `${conversaId}/${crypto.randomUUID()}-${base}.${ext}`;
  const { error } = await sb.storage
    .from("site-chat")
    .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), { contentType: tipo, upsert: false });
  if (error) return { erro: error.message };
  return {
    anexo_url: sb.storage.from("site-chat").getPublicUrl(caminho).data.publicUrl,
    anexo_tipo: tipo,
    anexo_nome: (arquivo.name || `${base}.${ext}`).slice(0, 120),
    anexo_tamanho: arquivo.size,
  };
}

/** Texto curto para a lista de conversas: "📷 Foto", "🎤 Áudio", "📎 orcamento.pdf". */
export function resumoDoAnexo(a: Pick<Anexo, "anexo_tipo" | "anexo_nome">): string {
  if (a.anexo_tipo.startsWith("image/")) return "📷 Foto";
  if (a.anexo_tipo.startsWith("audio/")) return "🎤 Áudio";
  if (a.anexo_tipo.startsWith("video/")) return "🎬 Vídeo";
  return `📎 ${a.anexo_nome}`;
}
