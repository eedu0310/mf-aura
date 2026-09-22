import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { executarTarefaAura, type AuraTaskInput } from "@/lib/aura-task-executor";

export const runtime = "nodejs";

const ACTIONS = new Set([
  "registrar_atividade",
  "criar_compromisso",
  "atualizar_proximo_contato",
  "atualizar_oportunidade",
  "concluir_compromisso",
]);

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) {
    return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });
  }

  let body: AuraTaskInput;
  try {
    body = (await request.json()) as AuraTaskInput;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  if (!body?.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ erro: "Ação de tarefa inválida." }, { status: 400 });
  }

  const resultado = await executarTarefaAura(body, {
    supabase: auth.supabase,
    empresa: auth.empresa,
    userId: auth.userId,
  });

  const httpStatus = resultado.status === "error" ? 500 : 200;
  return NextResponse.json(resultado, { status: httpStatus });
}
