import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Orçamentos anexados a um negócio — vários por negócio.
 *
 * Havia uma coluna só (orcamento_path) e o upload usava upsert: o segundo
 * orçamento sobrescrevia o primeiro. A casa faz três, cinco, dez orçamentos
 * até fechar, e só o último sobrevivia. Agora cada um é uma linha, numerada
 * na ordem em que entrou.
 *
 * Erro de leitura ESTOURA em vez de virar lista vazia: lista vazia silenciosa
 * já fez vendedor achar que o orçamento tinha sumido e anexar de novo.
 */
export interface OrcamentoAnexo {
  id: string;
  nome: string;
  path: string;
  versao: number;
  bytes: number | null;
  observacao: string | null;
  criadoEm: string;
}

const TAMANHO_MAXIMO_MB = 10;

export async function listarOrcamentos(oportunidadeId: string): Promise<OrcamentoAnexo[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb
    .from("orcamentos_anexos")
    .select("id, nome, path, versao, bytes, observacao, created_at")
    .eq("oportunidade_id", oportunidadeId)
    .order("versao", { ascending: false });
  if (error) throw new Error(`Não consegui listar os orçamentos: ${error.message}`);
  return (data ?? []).map((l) => ({
    id: String(l.id),
    nome: String(l.nome),
    path: String(l.path),
    versao: Number(l.versao),
    bytes: l.bytes === null ? null : Number(l.bytes),
    observacao: (l.observacao as string | null) ?? null,
    criadoEm: String(l.created_at),
  }));
}

export async function anexarOrcamento(args: {
  oportunidadeId: string;
  relacionamentoId: string | null;
  empresa: string;
  arquivo: File;
}): Promise<OrcamentoAnexo> {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("Sem conexão com o banco.");
  if (args.arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`O arquivo passa de ${TAMANHO_MAXIMO_MB} MB.`);
  }
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id) throw new Error("Sessão expirada. Entre de novo.");

  /*
   * O caminho leva um carimbo de tempo. Sem ele, dois orçamentos com o mesmo
   * nome de arquivo (muito comum: "orcamento.pdf") cairiam no mesmo caminho
   * e o segundo sobrescreveria o primeiro no storage — que é exatamente o
   * bug que esta tabela existe para acabar.
   */
  const nomeSeguro = args.arquivo.name.replace(/[^\w.\-]+/g, "_");
  const carimbo = Date.now().toString(36);
  const path = `${args.empresa}/oportunidades/${args.oportunidadeId}/${carimbo}-${nomeSeguro}`;

  const { error: erroUpload } = await sb.storage.from("orcamentos").upload(path, args.arquivo, { upsert: false });
  if (erroUpload) throw new Error(`Não consegui enviar o arquivo: ${erroUpload.message}`);

  const { data, error } = await sb
    .from("orcamentos_anexos")
    .insert({
      oportunidade_id: args.oportunidadeId,
      relacionamento_id: args.relacionamentoId,
      empresa: args.empresa,
      owner_id: user.id,
      nome: args.arquivo.name,
      path,
      bytes: args.arquivo.size,
    })
    .select("id, nome, path, versao, bytes, observacao, created_at")
    .single();
  if (error || !data) {
    // O arquivo subiu mas a linha não gravou: tira o arquivo, para não ficar
    // órfão no storage ocupando espaço sem ninguém conseguir achá-lo.
    await sb.storage.from("orcamentos").remove([path]).catch(() => {});
    throw new Error(`O arquivo subiu mas não foi registrado: ${error?.message ?? "erro desconhecido"}`);
  }
  return {
    id: String(data.id),
    nome: String(data.nome),
    path: String(data.path),
    versao: Number(data.versao),
    bytes: data.bytes === null ? null : Number(data.bytes),
    observacao: (data.observacao as string | null) ?? null,
    criadoEm: String(data.created_at),
  };
}

export async function linkDoOrcamento(path: string): Promise<string> {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb.storage.from("orcamentos").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error(`Não consegui abrir o arquivo: ${error?.message ?? ""}`);
  return data.signedUrl;
}

export async function removerOrcamento(anexo: OrcamentoAnexo): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb.from("orcamentos_anexos").delete().eq("id", anexo.id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Nada foi removido: sem permissão ou já não existia.");
  await sb.storage.from("orcamentos").remove([anexo.path]).catch(() => {});
}
