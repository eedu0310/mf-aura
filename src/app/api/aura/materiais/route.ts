import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extrairTexto } from "@/lib/aura/extrair-texto";
import { limparCacheMateriais } from "@/lib/aura/materiais";
import { regravarTrechos } from "@/lib/aura/trechos";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { limparCache } from "@/lib/aura/ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O teto de 25 MB barrava o material principal da casa.
 *
 * O "Manual de Vendas LF/AEG 2026" tem 42,8 MB e era recusado na porta — foi
 * o "não deixa botar material". Medido com o arquivo de verdade: 42,8 MB são
 * lidos em 2 segundos e rendem 90 mil caracteres de texto limpo. O limite não
 * protegia de nada; só impedia o trabalho.
 */
const MAX_BYTES = 60 * 1024 * 1024;
const MAX_CARACTERES = 300_000;

async function sessao() {
  const sb = await getSupabaseServerClient();
  if (!sb) return { erro: "Supabase não configurado.", status: 500 as const };
  const { data } = await sb.auth.getUser();
  if (!data.user) return { erro: "Faça login novamente.", status: 401 as const };
  const { data: perfil } = await sb
    .from("profiles")
    .select("empresa, cargo, gestor_mestre")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!perfil) return { erro: "Perfil não encontrado.", status: 404 as const };
  return {
    sb,
    userId: data.user.id,
    empresa: perfil.empresa as string,
    cargo: perfil.cargo as string,
    gestorMestre: !!perfil.gestor_mestre,
  };
}

const podeEditar = (cargo: string) => ["Gestor"].includes(cargo);

/** GET — lista os materiais da loja (sem o texto inteiro). */
export async function GET(req: NextRequest) {
  const s = await sessao();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  const empresa = req.nextUrl.searchParams.get("loja") || s.empresa;
  const { data, error } = await s.sb
    .from("aura_materiais")
    .select("id, empresa, titulo, descricao, arquivo_nome, tipo, bytes, caracteres, ativo, criado_em")
    .eq("empresa", empresa)
    .order("criado_em", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ materiais: data ?? [], podeEditar: podeEditar(s.cargo), empresa });
}

/** POST — envia um arquivo (PDF, Word, txt, md) ou um texto colado. */
export async function POST(req: NextRequest) {
  const s = await sessao();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  if (!podeEditar(s.cargo)) return NextResponse.json({ error: "Somente o gestor pode ver isso." }, { status: 403 });

  try {
    let titulo = "";
    let descricao: string | null = null;
    let texto = "";
    let arquivoNome: string | null = null;
    let tipo: string | null = null;
    let bytes: number | null = null;
    let aviso: string | undefined;
    let empresa = s.empresa;

    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      titulo = String(form.get("titulo") ?? "").trim();
      descricao = (String(form.get("descricao") ?? "").trim() || null) as string | null;
      empresa = String(form.get("loja") ?? "").trim() || s.empresa;
      if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo muito grande (máx. 60 MB)." }, { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const extraido = await extrairTexto(file.name, file.type || "", buffer);
      texto = extraido.texto;
      aviso = extraido.aviso;
      arquivoNome = file.name;
      tipo = file.type || null;
      bytes = file.size;
      if (!titulo) titulo = file.name.replace(/\.[^.]+$/, "");
    } else {
      const body = await req.json().catch(() => ({}));
      titulo = String(body.titulo ?? "").trim();
      descricao = (String(body.descricao ?? "").trim() || null) as string | null;
      texto = String(body.texto ?? "").trim();
      empresa = String(body.loja ?? "").trim() || s.empresa;
      tipo = "text/plain";
      bytes = Buffer.byteLength(texto);
    }

    if (!titulo) return NextResponse.json({ error: "Dê um nome para o material." }, { status: 400 });
    if (texto.length < 40) {
      return NextResponse.json(
        { error: aviso ?? "Não consegui ler texto suficiente neste arquivo. Tente enviar em Word (.docx) ou texto." },
        { status: 400 },
      );
    }
    if (texto.length > MAX_CARACTERES) texto = texto.slice(0, MAX_CARACTERES);

    /**
     * "todas" manda o mesmo material para as quatro lojas, de uma vez.
     *
     * O material de treinamento da casa é do grupo, não de uma operação: sem
     * isto, cada documento precisa ser enviado quatro vezes, e quem esquece
     * uma loja deixa a equipe dela atendendo com manual a menos — e não há
     * tela que mostre essa falta. Só gestor mestre, que é quem responde pelas
     * quatro.
     */
    const lojas =
      empresa === "todas" && s.gestorMestre ? NOMES_EMPRESAS : [empresa === "todas" ? s.empresa : empresa];

    const criados: { empresa: string; id: string; trechos: number }[] = [];
    const avisos: string[] = [];

    for (const loja of lojas) {
      const { data, error } = await s.sb
        .from("aura_materiais")
        .insert({
          empresa: loja,
          titulo,
          descricao,
          arquivo_nome: arquivoNome,
          tipo,
          bytes,
          texto,
          criado_por: s.userId,
        })
        .select("id, titulo, caracteres")
        .single();
      if (error) {
        avisos.push(`${loja}: ${error.message}`);
        continue;
      }

      /**
       * Parte o material em trechos buscáveis agora, no envio.
       *
       * Sem este passo o material entra no banco e fica FORA da busca: a AURA
       * nunca acharia o que acabou de receber, e o gestor não teria como
       * saber — o envio diria "ok" do mesmo jeito.
       *
       * Falha ao partir não perde o material: ele já está salvo, e o aviso
       * sobe para a tela em vez de um sucesso que mente.
       */
      let trechos = 0;
      try {
        trechos = await regravarTrechos(s.sb, { id: data.id, empresa: loja, titulo, texto });
      } catch (e: any) {
        console.error("[aura/materiais] trechos:", e?.message ?? e);
        avisos.push(`${loja}: material salvo, mas a busca por trechos não foi montada. Reenvie.`);
      }
      criados.push({ empresa: loja, id: data.id, trechos });
      limparCacheMateriais(loja);
    }

    if (!criados.length) {
      return NextResponse.json(
        { error: avisos.join(" | ") || "Não consegui salvar o material." },
        { status: 500 },
      );
    }

    limparCache();
    return NextResponse.json({
      ok: true,
      material: criados[0],
      lojas: criados,
      trechos: criados.reduce((t, c) => t + c.trechos, 0),
      aviso: [aviso, ...avisos].filter(Boolean).join(" | ") || undefined,
    });
  } catch (e: any) {
    console.error("[aura/materiais]", e);
    return NextResponse.json({ error: e?.message ?? "Erro ao enviar material." }, { status: 500 });
  }
}

/** PATCH — liga/desliga um material. DELETE — remove. */
export async function PATCH(req: NextRequest) {
  const s = await sessao();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  if (!podeEditar(s.cargo)) return NextResponse.json({ error: "Somente o gestor pode ver isso." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Material não informado." }, { status: 400 });
  const { error } = await s.sb
    .from("aura_materiais")
    .update({ ativo: body.ativo !== false, atualizado_em: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  limparCacheMateriais();
  limparCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = await sessao();
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  if (!podeEditar(s.cargo)) return NextResponse.json({ error: "Somente o gestor pode ver isso." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Material não informado." }, { status: 400 });
  const { error } = await s.sb.from("aura_materiais").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  limparCacheMateriais();
  limparCache();
  return NextResponse.json({ ok: true });
}
