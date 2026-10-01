/**
 * O que a AURA aprendeu nas conversas, para o gestor aprovar ou recusar.
 *
 * Nada do que a IA extrai entra em uso sozinho. O que ela tira de uma conversa
 * nasce como "sugerido" e só passa a ser injetado nos prompts depois que uma
 * pessoa confirma. Sem esse portão a AURA reforçaria os próprios erros: um
 * preço errado que apareceu numa conversa viraria o preço que ela repete para
 * todos os clientes.
 *
 * Um item recusado não volta. O processo de fechamento, se vir o mesmo padrão
 * outra vez, não reabre o que o gestor já decidiu que não serve.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { limparCacheAprendizado } from "@/lib/aura/aprendizado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!eu || !(/gestor/i.test(eu.cargo ?? "") || eu.gestor_mestre)) {
    return {
      erro: NextResponse.json(
        { erro: "Só o gestor revisa o aprendizado da AURA." },
        { status: 403 },
      ),
    };
  }
  return { auth, sb, eu };
}

/** GET — o que está esperando revisão e o que já vale, da loja do gestor. */
export async function GET(req: NextRequest) {
  const { erro, sb, eu } = await somenteGestor();
  if (erro) return erro;

  // Gestor mestre pode olhar outra loja; os demais só a própria.
  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = eu!.gestor_mestre && pedida ? pedida : eu!.empresa;

  const { data, error } = await sb!
    .from("aura_aprendizado")
    .select("id, canal, tipo, gatilho, resposta, vezes_visto, vezes_fechou, status, criado_em")
    .eq("empresa", loja)
    .in("status", ["sugerido", "aprovado"])
    // Sugeridos primeiro: é o que exige ação. Dentro de cada grupo, o que mais
    // fechou venda aparece antes, porque é o mais provável de merecer aprovação.
    .order("status", { ascending: true })
    .order("vezes_fechou", { ascending: false })
    .order("vezes_visto", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const itens = data ?? [];
  return NextResponse.json({
    loja,
    sugeridos: itens.filter((i) => i.status === "sugerido"),
    aprovados: itens.filter((i) => i.status === "aprovado"),
  });
}

/** POST — aprova, recusa ou corrige um item. */
export async function POST(req: NextRequest) {
  const { erro, sb, auth, eu } = await somenteGestor();
  if (erro) return erro;

  let corpo: {
    id?: string;
    acao?: "aprovar" | "recusar";
    gatilho?: string;
    resposta?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo.id || (corpo.acao !== "aprovar" && corpo.acao !== "recusar")) {
    return NextResponse.json(
      { erro: "Informe id e acao ('aprovar' ou 'recusar')." },
      { status: 400 },
    );
  }

  // Confere a loja do item antes de mexer: um gestor não revisa o aprendizado
  // de outra loja, mesmo mandando o id na mão.
  const { data: item } = await sb!
    .from("aura_aprendizado")
    .select("id, empresa")
    .eq("id", corpo.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
  if (!eu!.gestor_mestre && item.empresa !== eu!.empresa) {
    return NextResponse.json({ erro: "Esse item é de outra loja." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {
    status: corpo.acao === "aprovar" ? "aprovado" : "recusado",
    revisado_por: auth!.userId,
    revisado_em: new Date().toISOString(),
  };
  // O gestor pode ajustar o texto antes de aprovar — a IA escreve um rascunho,
  // a palavra final da casa é dele.
  if (typeof corpo.gatilho === "string" && corpo.gatilho.trim()) {
    patch.gatilho = corpo.gatilho.trim().slice(0, 500);
  }
  if (typeof corpo.resposta === "string" && corpo.resposta.trim()) {
    patch.resposta = corpo.resposta.trim().slice(0, 2000);
  }

  const { error } = await sb!.from("aura_aprendizado").update(patch).eq("id", corpo.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // O texto do prompt fica 5 min em cache; sem limpar, a aprovação só valeria
  // na próxima janela e pareceria que o botão não fez nada.
  limparCacheAprendizado(item.empresa);

  return NextResponse.json({ ok: true });
}
