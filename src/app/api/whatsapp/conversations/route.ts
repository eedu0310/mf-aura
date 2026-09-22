import { NextRequest, NextResponse } from "next/server";
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

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const telefone = digits(
      typeof body?.numero === "string" ? body.numero : "",
    );
    if (!/^\d{10,15}$/.test(telefone))
      return NextResponse.json({ erro: "Número inválido." }, { status: 400 });

    const db = admin();
    const { data: status, error: statusError } = await db
      .from("whatsapp_status")
      .select("conectado, numero")
      .eq("id", 1)
      .maybeSingle();
    if (statusError) throw statusError;
    const line = status?.conectado ? status.numero : null;
    if (!line)
      return NextResponse.json(
        { erro: "WhatsApp não está conectado." },
        { status: 503 },
      );

    const { data: existing, error: findError } = await db
      .from("whatsapp_conversas")
      .select(
        "id, telefone, nome_cliente, phone_number_id, status, ultima_mensagem_preview, ultima_mensagem_em",
      )
      .eq("phone_number_id", line)
      .eq("telefone", telefone)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return NextResponse.json({ conversa: existing });

    const { data, error } = await db
      .from("whatsapp_conversas")
      .insert({
        empresa: process.env.WHATSAPP_EMPRESA?.trim() || "aura-sales-os",
        phone_number_id: line,
        telefone,
        status: "aguardando_aceite",
        ia_ativa: false,
      })
      .select(
        "id, telefone, nome_cliente, phone_number_id, status, ultima_mensagem_preview, ultima_mensagem_em",
      )
      .single();
    if (error) throw error;
    return NextResponse.json({ conversa: data });
  } catch (error) {
    return NextResponse.json(
      {
        erro:
          error instanceof Error ? error.message : "Erro ao criar conversa.",
      },
      { status: 500 },
    );
  }
}
