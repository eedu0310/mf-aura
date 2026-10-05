import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As permissões que um gestor mestre pode ligar e desligar por pessoa.
 *
 * Cada chave é um ajuste SOBRE o padrão do cargo. Ausente significa o
 * padrão — assim ninguém precisa configurar nada para o sistema funcionar.
 */
export const PERMISSOES = [
  { chave: "definir_propria_meta", rotulo: "Definir a própria meta", ajuda: "Desligado, só o gestor arbitra a meta desta pessoa.", padrao: true },
  { chave: "ver_ranking", rotulo: "Ver o ranking", ajuda: "Desligado, a pessoa não vê a disputa do grupo.", padrao: true },
  { chave: "exportar_relatorios", rotulo: "Exportar relatórios", ajuda: "Baixar relatório em arquivo.", padrao: true },
  { chave: "transferir_carteira", rotulo: "Transferir carteira", ajuda: "Mover clientes de um vendedor para outro. Normalmente só gestor.", padrao: false },
  { chave: "ver_custo_ia", rotulo: "Ver o custo da IA", ajuda: "Saldo e consumo da AURA. Normalmente só gestor.", padrao: false },
  { chave: "editar_avaliacoes", rotulo: "Configurar avaliações", ajuda: "Cadastrar os links do Google e das redes.", padrao: false },
  // Instagram nao vem ligado para ninguem: quem atende a rede e uma escolha
  // do gestor, e a caixa de entrada da loja e uma so para todo mundo que tiver.
  { chave: "usar_instagram", rotulo: "Atender pelo Instagram", ajuda: "Ver e responder as mensagens e os comentários da conta da loja.", padrao: false },
];

async function somenteMestre() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb
    .from("profiles")
    .select("gestor_mestre")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!eu?.gestor_mestre) {
    return {
      erro: NextResponse.json(
        { erro: "Só um gestor mestre altera permissões e aprova gestores." },
        { status: 403 },
      ),
    };
  }
  return { auth, sb };
}

export async function GET() {
  const { erro, sb } = await somenteMestre();
  if (erro) return erro;

  const { data: pessoas } = await sb!
    .from("profiles")
    .select("id, nome, cargo, empresa, ativo, gestor_mestre, gestor_aprovado, permissoes, aprovado_em")
    // Quem foi excluido sai daqui tambem: a linha dele sobrevive no banco por
    // causa do historico de vendas, mas ele nao e mais da equipe e nao ha
    // permissao para dar a quem nao entra mais no sistema.
    .is("excluido_em", null)
    .order("cargo")
    .order("nome");

  return NextResponse.json({
    pessoas: pessoas ?? [],
    permissoes: PERMISSOES,
    pendentes: (pessoas ?? []).filter(
      (p: { cargo: string; gestor_aprovado: boolean }) =>
        p.cargo === "Gestor" && !p.gestor_aprovado,
    ),
  });
}

/** Aprova ou revoga um gestor, muda permissões, promove a mestre. */
export async function PATCH(request: Request) {
  const { erro, auth, sb } = await somenteMestre();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const id = String(corpo.id ?? "");
  if (!id) return NextResponse.json({ erro: "Informe a pessoa." }, { status: 400 });

  // Um mestre não se rebaixa sozinho: se fosse o último, o sistema ficaria
  // sem ninguém capaz de aprovar gestores.
  if (id === auth!.userId && corpo.gestorMestre === false) {
    const { count } = await sb!
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("gestor_mestre", true)
      .neq("id", id);
    if (!count) {
      return NextResponse.json(
        { erro: "Você é o único gestor mestre. Promova outra pessoa antes de sair." },
        { status: 400 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (corpo.gestorAprovado !== undefined) {
    patch.gestor_aprovado = Boolean(corpo.gestorAprovado);
    patch.aprovado_por = auth!.userId;
    patch.aprovado_em = corpo.gestorAprovado ? new Date().toISOString() : null;
  }
  if (corpo.gestorMestre !== undefined) patch.gestor_mestre = Boolean(corpo.gestorMestre);
  if (corpo.ativo !== undefined) patch.ativo = Boolean(corpo.ativo);
  if (corpo.permissoes !== undefined && typeof corpo.permissoes === "object") {
    const limpo: Record<string, boolean> = {};
    for (const p of PERMISSOES) {
      if (corpo.permissoes[p.chave] !== undefined) {
        limpo[p.chave] = Boolean(corpo.permissoes[p.chave]);
      }
    }
    patch.permissoes = limpo;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });
  }

  const { error } = await sb!.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
