import { NextResponse } from "next/server";
import { getOpenAIClient, temOpenAIDeVerdade } from "@/lib/openai-client";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getOrCreateVectorStore } from "@/lib/knowledge-base";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

function extensaoPorTipo(contentType: string) {
  if (contentType.includes("pdf")) return ".pdf";
  if (contentType.includes("csv")) return ".csv";
  if (contentType.includes("json")) return ".json";
  if (contentType.includes("html")) return ".html";
  if (contentType.includes("plain")) return ".txt";
  return ".txt";
}

/**
 * Links do Google Drive no formato "de visualização" (.../file/d/ID/view)
 * não entregam o arquivo bruto — entregam uma página HTML de preview.
 * Convertemos automaticamente para o formato de download direto.
 */
function normalizarLinkGoogleDrive(url: string): string {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${m[1]}`;
  }
  return url;
}

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
      { erro: "Configure OPENAI_API_KEY no .env.local para adicionar links à base de conhecimento." },
      { status: 400 }
    );
  }

  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { url: urlOriginal, nome, todasLojas: todasLojasBody } = await request.json();
  if (!urlOriginal || typeof urlOriginal !== "string") {
    return NextResponse.json({ erro: "Link ausente." }, { status: 400 });
  }
  const todasLojas = Boolean(todasLojasBody) && auth.cargo === "Diretor";

  const url = normalizarLinkGoogleDrive(urlOriginal);
  const ehDrive = url !== urlOriginal;

  try {
    const resposta = await fetch(url, { redirect: "follow" });
    if (!resposta.ok) {
      return NextResponse.json(
        { erro: `Não consegui acessar esse link (o site respondeu com erro ${resposta.status}). Verifique se ele é público (qualquer pessoa com o link).` },
        { status: 400 }
      );
    }

    const contentType = resposta.headers.get("content-type") ?? "text/plain";
    const buffer = Buffer.from(await resposta.arrayBuffer());

    if (ehDrive && contentType.includes("html") && buffer.length < 500_000) {
      return NextResponse.json(
        {
          erro:
            "Esse arquivo do Google Drive não é público, ou o Drive bloqueou o download automático (comum em arquivos grandes). Abra o link, clique em Compartilhar > Qualquer pessoa com o link, e tente de novo. Se persistir, baixe o PDF no computador e envie pelo botão 'Arquivo'.",
        },
        { status: 400 }
      );
    }

    if (buffer.length > 20 * 1024 * 1024) {
      return NextResponse.json({ erro: "Esse link aponta para um arquivo grande demais (acima de 20MB)." }, { status: 400 });
    }

    let nomeHost = "material";
    try {
      nomeHost = new URL(urlOriginal).hostname.replace(/^www\./, "");
    } catch {
      // mantém o padrão
    }
    const nomeArquivo = `${(nome?.trim() || nomeHost).replace(/[^\w.\-]+/g, "_")}${extensaoPorTipo(contentType)}`;

    const arquivo = new File([buffer], nomeArquivo, { type: contentType });
    const arquivoEnviado = await openai.files.create({ file: arquivo, purpose: "assistants" });

    const empresas = todasLojas ? NOMES_EMPRESAS : [auth.empresa];
    for (const empresa of empresas) {
      const vectorStoreId = await getOrCreateVectorStore(auth.supabase, openai, empresa);
      await openai.vectorStores.files.create(vectorStoreId, { file_id: arquivoEnviado.id });
    }

    return NextResponse.json({ ok: true, nome: nomeArquivo, lojas: empresas.length });
  } catch (err) {
    console.error("Erro ao ingerir link na base de conhecimento:", err);
    return NextResponse.json(
      { erro: "Não consegui processar esse link. Se for uma planilha do Google, tente publicá-la na web primeiro (Arquivo > Compartilhar > Publicar na web)." },
      { status: 500 }
    );
  }
}
