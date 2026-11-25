import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { montarEstadoEscritorio } from "@/lib/agentes/escritorio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O escritório virtual da equipe de agentes (EstadoEscritorio, ver
 * src/lib/agentes/tipos.ts).
 *
 * Só gestor aprovado. O gestor de uma loja vê as falas e as contagens de
 * achados da própria loja; o gestor mestre vê o grupo inteiro.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!administra(auth)) {
    return NextResponse.json({ erro: "Só o gestor aprovado vê o escritório dos agentes." }, { status: 403 });
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  try {
    const estado = await montarEstadoEscritorio(sb, { empresa: vejoTodasAsLojas(auth) ? null : auth.empresa });
    return NextResponse.json(estado);
  } catch (e) {
    console.error("[gestor/agentes]", e);
    return NextResponse.json({ erro: "Não consegui montar o escritório agora." }, { status: 500 });
  }
}
