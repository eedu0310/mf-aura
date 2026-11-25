import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { conversarComDiretora, EquipeSemTabelas, lerConversaComDiretora } from "@/lib/agentes/conversa-diretora";
import { textoDoGestor } from "@/lib/agentes/conversa-diretora-regras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Monta o retrato da equipe e espera a IA (60 s de prazo, até 2 novas tentativas).
export const maxDuration = 120;

/**
 * "Conversar com a Diretora" (src/lib/agentes/conversa-diretora.ts).
 *
 *   GET  → ConversaDiretora: as últimas 50 mensagens entre o gestor logado
 *          e a Diretora (tipos.ts);
 *   POST { texto } (até 2000 caracteres) → { pergunta, resposta }: a ideia
 *          dele e a resposta dela, já gravadas. Ela pode encaminhar pedidos
 *          a agentes e propor um agente novo (que espera o gestor mestre).
 *
 * Só gestor aprovado (da loja ou mestre). Sem as tabelas da equipe
 * (migração 110), 409 com a explicação.
 */
async function quemPede(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return { erro: NextResponse.json({ erro: "Faça login novamente." }, { status: 401 }) };
  if (!administra(auth)) {
    return { erro: NextResponse.json({ erro: "Só o gestor aprovado conversa com a Diretora." }, { status: 403 }) };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };
  return { auth, sb };
}

export async function GET(request: Request) {
  const r = await quemPede(request);
  if ("erro" in r) return r.erro;
  try {
    return NextResponse.json(await lerConversaComDiretora(r.sb, r.auth.userId));
  } catch (e) {
    if (e instanceof EquipeSemTabelas) return NextResponse.json({ erro: e.message }, { status: 409 });
    console.error("[gestor/agentes/diretora] GET", e);
    return NextResponse.json({ erro: "Não consegui abrir a conversa com a Diretora agora." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const r = await quemPede(request);
  if ("erro" in r) return r.erro;

  let corpo: { texto?: unknown };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const t = textoDoGestor(corpo?.texto);
  if ("erro" in t) return NextResponse.json({ erro: t.erro }, { status: 400 });

  try {
    const troca = await conversarComDiretora(
      r.sb,
      { userId: r.auth.userId, empresa: r.auth.empresa, vejoTodas: vejoTodasAsLojas(r.auth) },
      t.texto,
    );
    return NextResponse.json(troca);
  } catch (e) {
    if (e instanceof EquipeSemTabelas) return NextResponse.json({ erro: e.message }, { status: 409 });
    console.error("[gestor/agentes/diretora] POST", e);
    return NextResponse.json({ erro: "A Diretora não conseguiu responder agora. Tente de novo em instantes." }, { status: 500 });
  }
}
