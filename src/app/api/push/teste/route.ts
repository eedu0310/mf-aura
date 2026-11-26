import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { entregarAvisos } from "@/lib/push/servidor";

export const runtime = "nodejs";

/**
 * Aviso de teste, na hora, para os aparelhos de quem está logado. Não entra
 * no sino: é só para a pessoa ver que o celular está recebendo.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  try {
    const r = await entregarAvisos(sb, [
      {
        id: `teste-${Date.now()}`,
        vendedor_id: auth.userId,
        titulo: "Avisos ligados ✅",
        mensagem: "É assim que o AURA vai te chamar quando chegar lead, cliente esperando ou recado da equipe.",
        acao_url: "/meu-dia",
        tipo: "teste",
      },
    ]);
    if (!r.enviados) return NextResponse.json({ erro: "Nenhum aparelho recebeu. Desligue e ligue os avisos de novo." }, { status: 409 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[push] teste:", e);
    return NextResponse.json({ erro: "Não deu para mandar o teste agora." }, { status: 500 });
  }
}
