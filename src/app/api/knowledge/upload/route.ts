import { NextResponse } from "next/server";
import { getOpenAIClient, temOpenAIDeVerdade } from "@/lib/openai-client";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getOrCreateVectorStore } from "@/lib/knowledge-base";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!temOpenAIDeVerdade()) {
    return NextResponse.json(
      {
        erro:
          "Esta base antiga precisa de uma chave da OpenAI. Para a AURA estudar seus manuais, use a área \"Materiais que a AURA estuda\", na Visão do Gestor.",
      },
      { status: 503 },
    );
  }
  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json(
      { erro: "Configure OPENAI_API_KEY no .env.local para enviar documentos." },
      { status: 400 }
    );
  }

  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json(
      { erro: "É preciso estar logado com Supabase configurado para usar a base de conhecimento." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  const todasLojas = formData.get("todasLojas") === "1" && auth.cargo === "Gestor";

  if (!arquivo || !(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Nenhum arquivo recebido." }, { status: 400 });
  }

  try {
    const arquivoEnviado = await openai.files.create({
      file: arquivo,
      purpose: "assistants",
    });

    const empresas = todasLojas ? NOMES_EMPRESAS : [auth.empresa];
    for (const empresa of empresas) {
      const vectorStoreId = await getOrCreateVectorStore(auth.supabase, openai, empresa);
      await openai.vectorStores.files.create(vectorStoreId, { file_id: arquivoEnviado.id });
    }

    return NextResponse.json({
      ok: true,
      arquivoId: arquivoEnviado.id,
      nome: arquivo.name,
      lojas: empresas.length,
    });
  } catch (err) {
    console.error("Erro ao enviar documento para a base de conhecimento:", err);
    const detalhe = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ erro: `Não consegui processar esse arquivo. (${detalhe})` }, { status: 500 });
  }
}
