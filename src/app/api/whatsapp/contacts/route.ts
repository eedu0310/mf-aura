import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server não configurado.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const db = admin();
    const { data: status, error: statusError } = await db
      .from("whatsapp_status")
      .select("conectado, numero")
      .eq("id", 1)
      .maybeSingle();
    if (statusError) throw statusError;
    const line = status?.conectado ? status.numero : null;
    if (!line) return NextResponse.json({ contactos: [], conectado: false });
    const { data, error } = await db
      .from("whatsapp_contactos")
      .select("id, telefone, nome, avatar_url, tipo, actualizado_em")
      .eq("phone_number_id", line)
      .order("nome", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) throw error;
    return NextResponse.json({
      contactos: data || [],
      conectado: true,
      numero: line,
    });
  } catch (error) {
    return NextResponse.json(
      {
        contactos: [],
        erro:
          error instanceof Error
            ? error.message
            : "Erro ao carregar contactos.",
      },
      { status: 500 },
    );
  }
}
