import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Devolve o endereço secreto do calendário de quem está logado. */
export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ erro: "Indisponível." }, { status: 500 });

  let { data: perfil } = await service
    .from("profiles")
    .select("agenda_token")
    .eq("id", auth.userId)
    .maybeSingle();

  // Perfil antigo que ainda não tem token ganha um agora.
  if (!perfil?.agenda_token) {
    const { data: atualizado } = await service
      .from("profiles")
      .update({ agenda_token: crypto.randomUUID() })
      .eq("id", auth.userId)
      .select("agenda_token")
      .maybeSingle();
    perfil = atualizado ?? perfil;
  }

  if (!perfil?.agenda_token) {
    return NextResponse.json({ erro: "Não consegui gerar o endereço." }, { status: 500 });
  }

  return NextResponse.json({ caminho: `/api/agenda/${perfil.agenda_token}` });
}

/** Gera um endereço novo e derruba o antigo (se a pessoa achar que vazou). */
export async function POST() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ erro: "Indisponível." }, { status: 500 });

  const novo = crypto.randomUUID();
  const { error } = await service.from("profiles").update({ agenda_token: novo }).eq("id", auth.userId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ caminho: `/api/agenda/${novo}` });
}
