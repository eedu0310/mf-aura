import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Notificações push: o aviso do sino tocando no celular.
 *
 * Toda notificação do AURA já é gravada na tabela notificacoes, por dezenas de
 * caminhos diferentes (rotas, crons, gatilhos do banco). Em vez de mexer em
 * cada um, o servidor olha a tabela de poucos em poucos segundos e entrega o
 * que ainda não foi entregue (migração 117).
 */

/** Aviso mais velho que isto não vai mais para o celular: já perdeu a hora. */
const JANELA_MS = 10 * 60_000;
const INTERVALO_MS = 15_000;
// Contato que o serviço de push do navegador usa se precisar falar com o dono.
const CONTATO = "mailto:atendimento@lflareiras.com.br";

type Chaves = { publica: string; privada: string };
let chavesEmCache: Chaves | null = null;

/**
 * As chaves VAPID. Ordem: .env.local da VPS; senão a tabela aura_push_chaves;
 * senão gera um par agora e guarda na tabela (uma vez só, para sempre — trocar
 * as chaves desliga todos os aparelhos inscritos).
 */
export async function chavesVapid(sb: SupabaseClient): Promise<Chaves | null> {
  if (chavesEmCache) return chavesEmCache;
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) return (chavesEmCache = { publica: envPub, privada: envPriv });

  const ler = async () => {
    const { data, error } = await sb.from("aura_push_chaves").select("publica, privada").eq("id", 1).maybeSingle();
    if (error) throw new Error(`chaves de push: ${error.message}`);
    return data as Chaves | null;
  };
  let chaves = await ler();
  if (!chaves) {
    const novas = webpush.generateVAPIDKeys();
    // Se dois processos gerarem ao mesmo tempo, vale o primeiro que gravou.
    await sb.from("aura_push_chaves").upsert({ id: 1, publica: novas.publicKey, privada: novas.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    chaves = await ler();
  }
  if (!chaves) return null;
  return (chavesEmCache = chaves);
}

export type AvisoPush = {
  id: string;
  vendedor_id: string | null;
  titulo: string | null;
  mensagem: string | null;
  acao_url: string | null;
  tipo: string | null;
};

type Inscricao = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; falhas: number };

/** Tipos que pedem ação rápida (cliente esperando): o celular entrega na hora, mesmo em economia de bateria. */
const URGENTES = new Set(["ia", "lead", "alerta", "equipe"]);

function corta(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/** Só caminho interno do AURA; qualquer outra coisa abre o Meu Dia. */
function caminhoSeguro(url: string | null): string {
  const u = (url ?? "").trim();
  return u.startsWith("/") && !u.startsWith("//") ? u : "/meu-dia";
}

/**
 * Manda os avisos para todos os aparelhos dos donos. Inscrição que o navegador
 * diz que não existe mais (404/410) é apagada; outras falhas só contam, e
 * depois de 10 seguidas a inscrição sai.
 */
export async function entregarAvisos(sb: SupabaseClient, avisos: AvisoPush[]): Promise<{ enviados: number; falhas: number }> {
  const comDono = avisos.filter((a) => a.vendedor_id);
  if (!comDono.length) return { enviados: 0, falhas: 0 };
  const chaves = await chavesVapid(sb);
  if (!chaves) return { enviados: 0, falhas: 0 };

  const donos = [...new Set(comDono.map((a) => a.vendedor_id as string))];
  const { data: inscricoes, error } = await sb
    .from("push_inscricoes")
    .select("id, user_id, endpoint, p256dh, auth, falhas")
    .in("user_id", donos);
  if (error) throw new Error(`inscrições de push: ${error.message}`);
  if (!inscricoes?.length) return { enviados: 0, falhas: 0 };

  const porDono = new Map<string, Inscricao[]>();
  for (const i of inscricoes as Inscricao[]) porDono.set(i.user_id, [...(porDono.get(i.user_id) ?? []), i]);

  let enviados = 0;
  let falhas = 0;
  const mortas = new Set<string>();
  const deuCerto = new Set<string>();
  const falhou = new Map<string, number>();

  for (const aviso of comDono) {
    const payload = JSON.stringify({
      titulo: corta(aviso.titulo?.trim() || "AURA", 120),
      mensagem: corta(aviso.mensagem?.trim() ?? "", 300),
      url: caminhoSeguro(aviso.acao_url),
      tag: aviso.id,
    });
    for (const i of porDono.get(aviso.vendedor_id as string) ?? []) {
      if (mortas.has(i.id)) continue;
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, {
          vapidDetails: { subject: CONTATO, publicKey: chaves.publica, privateKey: chaves.privada },
          TTL: 6 * 3600,
          urgency: URGENTES.has(aviso.tipo ?? "") ? "high" : "normal",
          timeout: 10_000,
        });
        enviados++;
        deuCerto.add(i.id);
      } catch (e) {
        falhas++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) mortas.add(i.id);
        else falhou.set(i.id, (falhou.get(i.id) ?? i.falhas) + 1);
      }
    }
  }

  if (mortas.size) await sb.from("push_inscricoes").delete().in("id", [...mortas]);
  if (deuCerto.size) {
    await sb
      .from("push_inscricoes")
      .update({ ultimo_envio_em: new Date().toISOString(), falhas: 0 })
      .in("id", [...deuCerto].filter((id) => !mortas.has(id)));
  }
  for (const [id, n] of falhou) {
    if (mortas.has(id) || deuCerto.has(id)) continue;
    if (n >= 10) await sb.from("push_inscricoes").delete().eq("id", id);
    else await sb.from("push_inscricoes").update({ falhas: n }).eq("id", id);
  }
  return { enviados, falhas };
}

/**
 * Uma rodada: separa (e marca) os avisos ainda não entregues dos últimos 10
 * minutos e manda. A marcação é feita antes de mandar, num update só — dois
 * processos rodando ao mesmo tempo nunca entregam o mesmo aviso duas vezes.
 */
export async function rodadaDePush(sb: SupabaseClient) {
  const agora = new Date();
  // criada_em é "timestamp sem fuso", gravado em UTC.
  const limite = new Date(agora.getTime() - JANELA_MS).toISOString().replace("Z", "");

  // O que passou da hora sem ser entregue (servidor fora do ar, por exemplo)
  // só é marcado, para não chegar atrasado.
  await sb.from("notificacoes").update({ push_enviado_em: agora.toISOString() }).is("push_enviado_em", null).lt("criada_em", limite);

  const { data, error } = await sb
    .from("notificacoes")
    .update({ push_enviado_em: agora.toISOString() })
    .is("push_enviado_em", null)
    .gte("criada_em", limite)
    .select("id, vendedor_id, titulo, mensagem, acao_url, tipo");
  if (error) throw new Error(error.message);
  if (!data?.length) return { avisos: 0, enviados: 0, falhas: 0 };
  const r = await entregarAvisos(sb, data as AvisoPush[]);
  return { avisos: data.length, ...r };
}

type Global = typeof globalThis & { __auraPushLigado?: boolean };

/**
 * Liga o entregador (chamado uma vez quando o servidor sobe). Só na VPS em
 * produção: na prévia local (next dev) ou na Vercel não roda.
 */
export function ligarEntregaDePush() {
  const g = globalThis as Global;
  if (g.__auraPushLigado) return;
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  g.__auraPushLigado = true;

  let rodando = false;
  let avisouColunaFaltando = false;
  const timer = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodadaDePush(sb);
      if (r.avisos) console.log(`[push] ${r.avisos} aviso(s), ${r.enviados} entregue(s), ${r.falhas} falha(s)`);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      // Sem a migração 117 a coluna não existe: avisa uma vez e segue tentando
      // em silêncio (passa a funcionar sozinho quando a migração entrar).
      if (/push_enviado_em|push_inscricoes|aura_push_chaves/.test(msg)) {
        if (!avisouColunaFaltando) console.warn("[push] aguardando a migração 117:", msg);
        avisouColunaFaltando = true;
      } else {
        console.error("[push] rodada falhou:", msg);
      }
    } finally {
      rodando = false;
    }
  }, INTERVALO_MS);
  timer.unref?.();
}
