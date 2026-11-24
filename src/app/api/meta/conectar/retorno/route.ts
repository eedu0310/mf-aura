import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { contaDaLoja, ligarAvisos } from "@/lib/meta/cliente";
import { importarHistorico } from "@/lib/meta/importar";
import { SITE, contasLiberadas, credenciais, lerEstado, trocarCodigo } from "@/lib/meta/conectar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A volta da Meta depois que o gestor autorizou. Grava a conta da loja com o
 * token (de usuário do sistema, não vence), o id que chega nos webhooks e o
 * @, e liga os avisos de mensagem e comentário. O token não passa pelo
 * navegador.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const voltar = (ok: boolean, msg: string) =>
    NextResponse.redirect(`${SITE}/gestor?aba=instagram&ig=${ok ? "ok" : "erro"}&msg=${encodeURIComponent(msg)}`);

  if (sp.get("error")) {
    return voltar(false, sp.get("error_description") || "A autorização foi cancelada na Meta.");
  }

  const app = credenciais();
  if (!app) return voltar(false, "Falta configurar o app da Meta no servidor.");

  const estado = lerEstado(sp.get("state") ?? "", app.segredo);
  if (!estado) return voltar(false, "O pedido de conexão expirou ou não é válido. Clique em Conectar de novo.");

  const auth = await getEmpresaAutenticada();
  if (!auth || auth.userId !== estado.userId || !auth.gestorMestre) {
    return voltar(false, "Entre no AURA com a mesma conta de gestor mestre que clicou em Conectar.");
  }

  const code = sp.get("code");
  if (!code) return voltar(false, "A Meta não devolveu o código de autorização.");

  const sb = getSupabaseServiceClient();
  if (!sb) return voltar(false, "Serviço indisponível.");

  try {
    const { token, expiraEmSegundos } = await trocarCodigo(code, app);
    const contas = await contasLiberadas(token);
    if (!contas.length) {
      return voltar(false, "Nenhuma conta do Instagram foi liberada. Clique em Conectar de novo e marque a conta da loja.");
    }
    if (contas.length > 1) {
      const nomes = contas.map((c) => `@${c.usuario ?? c.igUserId}`).join(", ");
      return voltar(false, `Foram liberadas ${contas.length} contas (${nomes}). Conecte de novo marcando só a conta da ${estado.empresa}.`);
    }
    const { igUserId, usuario } = contas[0];

    // A mesma conta do Instagram não pode atender duas lojas: o aviso de
    // mensagem chega pelo id e iria para a loja errada.
    const { data: outra } = await sb
      .from("meta_contas")
      .select("empresa")
      .eq("ig_user_id", igUserId)
      .eq("ativo", true)
      .neq("empresa", estado.empresa)
      .maybeSingle();
    if (outra) {
      return voltar(false, `A conta @${usuario ?? igUserId} já está conectada na ${outra.empresa}. Entre com a conta da ${estado.empresa}.`);
    }

    const { error } = await sb.from("meta_contas").upsert(
      {
        empresa: estado.empresa,
        token,
        ig_user_id: igUserId,
        nome_usuario: usuario,
        // Token de usuário do sistema: normalmente não vence (null).
        token_expira_em: expiraEmSegundos ? new Date(Date.now() + expiraEmSegundos * 1000).toISOString() : null,
        conectado_em: new Date().toISOString(),
        conectado_por: auth.userId,
        ativo: true,
      },
      { onConflict: "empresa" },
    );
    if (error) throw new Error(error.message);

    let aviso = "";
    const conta = await contaDaLoja(estado.empresa);
    if (conta) {
      const r = await ligarAvisos(conta);
      if (!r.ok) {
        console.error("[instagram] conta conectada, mas os avisos não foram ligados:", r.erros);
        aviso = " Atenção: não consegui ligar os avisos de mensagem; use o Diagnóstico na aba Instagram.";
      }
      // O histórico recente vem junto; se falhar, a conexão vale igual.
      const imp = await importarHistorico(conta).catch(() => null);
      if (imp) aviso += ` Histórico: ${imp.conversas} conversas e ${imp.comentarios} comentários.`;
    }
    return voltar(true, `${estado.empresa} conectada como @${usuario ?? igUserId}.${aviso}`);
  } catch (e) {
    console.error("[instagram] falha ao conectar:", e);
    return voltar(false, `Não consegui conectar: ${(e as Error).message}`);
  }
}
