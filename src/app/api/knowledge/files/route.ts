import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";

export const runtime = "nodejs";

export async function GET() {
  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({
      arquivos: [],
      motivo: "openai_nao_configurada",
      mensagem: "Configure OPENAI_API_KEY no .env.local para usar a base de conhecimento.",
    });
  }

  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({
      arquivos: [],
      motivo: "nao_autenticado",
      mensagem: "Sua sessão não foi reconhecida pelo servidor. Tente sair e entrar novamente.",
    });
  }

  const { data } = await auth.supabase
    .from("playbook")
    .select("vector_store_id")
    .eq("empresa", auth.empresa)
    .maybeSingle();

  const vectorStoreId = data?.vector_store_id as string | undefined;
  if (!vectorStoreId) {
    return NextResponse.json({
      arquivos: [],
      motivo: "nenhum_documento",
      mensagem: "Nenhum documento enviado ainda para esta loja.",
    });
  }

  try {
    const lista = await openai.vectorStores.files.list(vectorStoreId);

    const arquivos = await Promise.all(
      lista.data.map(async (item) => {
        try {
          const detalhes = await openai.files.retrieve(item.id);
          return { id: item.id, nome: detalhes.filename, status: item.status };
        } catch {
          return { id: item.id, nome: item.id, status: item.status };
        }
      })
    );

    return NextResponse.json({ arquivos });
  } catch (err) {
    console.error("Erro ao listar documentos:", err);
    return NextResponse.json({
      arquivos: [],
      motivo: "erro_openai",
      mensagem: err instanceof Error ? err.message : "Erro ao consultar a OpenAI.",
    });
  }
}

export async function DELETE(request: Request) {
  const openai = getOpenAIClient();
  const auth = await getEmpresaAutenticada();
  if (!openai || !auth) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { fileId } = await request.json();
  if (!fileId) return NextResponse.json({ erro: "fileId ausente." }, { status: 400 });

  const { data } = await auth.supabase
    .from("playbook")
    .select("vector_store_id")
    .eq("empresa", auth.empresa)
    .maybeSingle();

  const vectorStoreId = data?.vector_store_id as string | undefined;
  if (!vectorStoreId) return NextResponse.json({ erro: "Base de conhecimento vazia." }, { status: 400 });

  try {
    await openai.vectorStores.files.delete(fileId, { vector_store_id: vectorStoreId });
    await openai.files.delete(fileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao remover documento:", err);
    return NextResponse.json({ erro: "Não consegui remover esse arquivo." }, { status: 500 });
  }
}
