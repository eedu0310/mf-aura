import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { chavesVapid } from "@/lib/push/servidor";

export const runtime = "nodejs";

/**
 * Aparelhos que recebem os avisos do sino no celular/computador.
 *
 * GET:    a chave pública do AURA (o navegador precisa dela para se inscrever).
 * POST:   grava a inscrição deste aparelho para quem está logado. Se o
 *         aparelho era de outra pessoa (celular da loja, troca de login), passa
 *         a ser de quem entrou agora.
 * DELETE: tira este aparelho (desligar, ou sair da conta).
 */

function sistemaIndisponivel() {
  return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });
}

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return sistemaIndisponivel();
  try {
    const chaves = await chavesVapid(sb);
    if (!chaves) return sistemaIndisponivel();
    return NextResponse.json({ chave: chaves.publica });
  } catch (e) {
    console.error("[push] chave:", e);
    return NextResponse.json({ erro: "As notificações ainda não estão liberadas no servidor." }, { status: 503 });
  }
}

type CorpoInscricao = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

function endpointValido(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 2000) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return sistemaIndisponivel();

  const corpo = (await request.json().catch(() => null)) as CorpoInscricao | null;
  const p256dh = corpo?.keys?.p256dh;
  const chaveAuth = corpo?.keys?.auth;
  if (!endpointValido(corpo?.endpoint) || typeof p256dh !== "string" || typeof chaveAuth !== "string" || p256dh.length > 200 || chaveAuth.length > 100) {
    return NextResponse.json({ erro: "Inscrição inválida." }, { status: 400 });
  }

  const aparelho = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const { error } = await sb.from("push_inscricoes").upsert(
    {
      user_id: auth.userId,
      endpoint: corpo!.endpoint,
      p256dh,
      auth: chaveAuth,
      aparelho,
      atualizada_em: new Date().toISOString(),
      falhas: 0,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[push] gravar inscrição:", error.message);
    return NextResponse.json({ erro: "Não deu para ligar os avisos agora." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return sistemaIndisponivel();

  const corpo = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!endpointValido(corpo?.endpoint)) return NextResponse.json({ erro: "Aparelho inválido." }, { status: 400 });

  await sb.from("push_inscricoes").delete().eq("endpoint", corpo!.endpoint).eq("user_id", auth.userId);
  return NextResponse.json({ ok: true });
}
