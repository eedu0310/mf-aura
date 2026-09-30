import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O que esta pessoa pode, para o menu saber o que mostrar. */
export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ permissoes: {} }, { status: 401 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ permissoes: {} });

  const { data } = await sb
    .from("profiles")
    .select("permissoes, cargo, gestor_mestre")
    .eq("id", auth.userId)
    .maybeSingle();

  return NextResponse.json({
    permissoes: data?.permissoes ?? {},
    cargo: data?.cargo ?? auth.cargo,
    gestorMestre: Boolean(data?.gestor_mestre),
  });
}
