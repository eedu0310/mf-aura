/**
 * CAÇADOR DE BRECHAS — Equipe Vermelha. Todo dia às 6h tenta achar por onde
 * alguém de fora (ou de outra loja) entraria no CRM, e diz como fechar.
 *
 * SÓ LÊ E SONDA. Nada aqui grava dado, muda permissão ou mexe em código:
 *   1. RLS: tabela sem proteção de linha (aura_tabelas_sem_rls(), migração 105);
 *   2. POLÍTICAS: lidas do esquema (aura_esquema_ddl(), a mesma função do
 *      backup) — regra "using (true)" para o papel anon/public é a tabela
 *      inteira aberta para quem nem fez login; para "authenticated" é
 *      qualquer pessoa logada, de qualquer loja (aura_politicas_abertas());
 *   3. FUNÇÕES que rodam como dono (SECURITY DEFINER): sem search_path fixo
 *      (dá para sequestrar com um objeto de mesmo nome) ou executáveis por
 *      quem não fez login (fora as duas da avaliação pública, de propósito).
 *      Gravação do anon: com RLS ligada, ela só passa por política aberta ou
 *      por função DEFINER — os dois casos acima. Por isso não precisa
 *      "testar gravando" (e nunca testa);
 *   4. PODER: perfil com gestor_mestre ligado sem ser Gestor aprovado; e
 *      gestor mestre a mais do que havia nos últimos 7 dias;
 *   5. ROTAS: GET SEM login numa lista fixa de rotas protegidas
 *      (ROTAS_PROTEGIDAS), 5 s cada, no próprio servidor. Qualquer 200 é
 *      urgente. Só GET de leitura; a do cron vai com ?simular=1.
 *
 * Achado alto/urgente vira card para os gestores mestres; tudo vai num alerta
 * para a Diretora (equipe-vermelha.ts). O texto "como arrumar" é por regra;
 * a IA rápida só o reescreve mais claro.
 */
import type { ContextoAgente, DefinicaoAgente, ResultadoAgente } from "../tipos";
import {
  classificarSondagem,
  FUNCOES_PUBLICAS_DE_PROPOSITO,
  funcoesDoEsquema,
  politicaAbertaAoPublico,
  politicasDoEsquema,
  ROTAS_PROTEGIDAS,
  type ResultadoSondagem,
  type Risco,
} from "./equipe-vermelha-regras";
import { entregarRiscos } from "./equipe-vermelha";

export const ID_CACADOR_BRECHAS = "cacador-brechas";

const TEMPO_SONDAGEM_MS = 5_000;
/** Tabela com dado de cliente: aberta a qualquer logado é mais grave que tabela de configuração. */
const DADO_DE_CLIENTE = /whatsapp|relacionament|lead|cliente|venda|oportunidade|atividade|contato|profiles|notifica|conversa/i;

function baseDoServidor(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

/** GET sem credencial nenhuma, sem seguir redirecionamento, com prazo. */
async function sondar(base: string, rota: string): Promise<{ status: number; local: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TEMPO_SONDAGEM_MS);
  try {
    const r = await fetch(`${base}${rota}`, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "user-agent": "AURA-equipe-vermelha/1 (sondagem sem login)" },
    });
    // Não lê o corpo: basta o status (e não guarda nada do que veio).
    void r.body?.cancel().catch(() => {});
    return { status: r.status, local: r.headers.get("location") };
  } catch {
    return { status: 0, local: null };
  } finally {
    clearTimeout(timer);
  }
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora } = ctx;
  const riscos: Risco[] = [];

  // ---------- 1. tabela sem RLS ----------
  const { data: semRls, error: erroRls } = await sb.rpc("aura_tabelas_sem_rls");
  if (erroRls) {
    riscos.push({
      chave: "checagem-rls-indisponivel",
      severidade: "media",
      titulo: "Não consegui conferir as tabelas sem RLS",
      detalhe: `A função aura_tabelas_sem_rls() respondeu erro: ${erroRls.message.slice(0, 160)}.`,
      comoArrumar: "Conferir se a migração 105 está aplicada no Supabase.",
    });
  }
  for (const t of (Array.isArray(semRls) ? semRls : []) as Array<{ tabela: string }>) {
    riscos.push({
      chave: `sem-rls:${t.tabela}`,
      severidade: "urgente",
      titulo: `Tabela ${t.tabela} sem RLS`,
      detalhe: `Sem proteção de linha, quem tem a chave pública (está no navegador de todo mundo) lê e grava a tabela ${t.tabela} inteira.`,
      comoArrumar: `Numa migração: alter table public.${t.tabela} enable row level security; e criar as políticas por loja/dono, como nas outras tabelas.`,
    });
  }

  // ---------- 2 e 3. políticas e funções (texto do esquema) ----------
  let politicas = 0;
  let funcoes = 0;
  const { data: ddl, error: erroDdl } = await sb.rpc("aura_esquema_ddl");
  if (erroDdl || typeof ddl !== "string") {
    riscos.push({
      chave: "esquema-indisponivel",
      severidade: "media",
      titulo: "Não consegui ler o esquema do banco",
      detalhe: `A função aura_esquema_ddl() não respondeu${erroDdl ? `: ${erroDdl.message.slice(0, 160)}` : ""}. Sem ela não confiro políticas nem funções.`,
      comoArrumar: "Conferir se a função do backup do esquema (aura_esquema_ddl) existe e se a chave de serviço pode executá-la.",
    });
  } else {
    const lidas = politicasDoEsquema(ddl);
    politicas = lidas.length;
    for (const p of lidas.filter(politicaAbertaAoPublico)) {
      const grava = p.comando !== "select";
      riscos.push({
        chave: `politica-publica:${p.tabela}:${p.nome}`,
        severidade: grava ? "urgente" : "alta",
        titulo: `${p.tabela}: ${grava ? "qualquer um grava" : "qualquer um lê"} sem login`,
        detalhe: `A política "${p.nome}" (${p.comando}) vale para o papel ${p.papeis.join(", ")} com condição "true": quem nem fez login ${grava ? "altera" : "lê"} a tabela ${p.tabela} inteira.`,
        comoArrumar: `Numa migração, trocar a política "${p.nome}" para "to authenticated" com a condição por loja/dono (como nas outras tabelas), ou apagá-la se não for usada.`,
      });
    }
    const lista = funcoesDoEsquema(ddl);
    funcoes = lista.length;
    for (const f of lista) {
      if (!f.definer) continue;
      if (!f.comSearchPath) {
        riscos.push({
          chave: `definer-sem-search-path:${f.nome}`,
          severidade: "alta",
          titulo: `Função ${f.nome} roda como dono sem search_path`,
          detalhe: `public.${f.nome} é SECURITY DEFINER e não fixa o search_path: um objeto criado com o mesmo nome de algo que ela usa pode ser executado com o poder do dono.`,
          comoArrumar: `Numa migração: alter function public.${f.nome}(...) set search_path = public; (o mesmo que as outras funções já fazem).`,
        });
      }
      const doPublico = f.executam.includes("anon") || f.executam.includes("public");
      if (!f.gatilho && doPublico && !FUNCOES_PUBLICAS_DE_PROPOSITO.has(f.nome)) {
        riscos.push({
          chave: `definer-publica:${f.nome}`,
          severidade: "alta",
          titulo: `Função ${f.nome} pode ser chamada sem login`,
          detalhe: `public.${f.nome} roda como dono (ignora a RLS) e o papel anon/PUBLIC tem permissão de executar: qualquer um com a chave pública a chama.`,
          comoArrumar: `Numa migração: revoke execute on function public.${f.nome}(...) from public, anon; grant execute ... to authenticated (ou só service_role, se for do servidor).`,
        });
      }
    }
  }

  // Aberto a qualquer LOGADO (de qualquer loja): o que a migração 105 lista.
  const { data: abertas } = await sb.rpc("aura_politicas_abertas");
  for (const p of (Array.isArray(abertas) ? abertas : []) as Array<{ tabela: string; politica: string; comando: string }>) {
    const sensivel = DADO_DE_CLIENTE.test(p.tabela);
    riscos.push({
      chave: `politica-logados:${p.tabela}:${p.politica}`,
      severidade: sensivel ? "media" : "baixa",
      titulo: `${p.tabela}: qualquer pessoa logada ${p.comando === "SELECT" ? "lê" : "mexe em"} tudo`,
      detalhe: `A política "${p.politica}" (${p.comando}) usa "true" para todo usuário logado: vendedor de uma loja enxerga ${sensivel ? "dado de cliente" : "a configuração"} das outras.`,
      comoArrumar: sensivel
        ? `Restringir a política "${p.politica}" por loja (administro_a_loja(empresa) ou dono = auth.uid()), se não for de propósito.`
        : "Se for configuração comum às lojas, está ok; senão, restringir por loja.",
    });
  }

  // ---------- 4. quem tem poder ----------
  const { data: perfis, error: erroPerfis } = await sb
    .from("profiles")
    .select("id, cargo, ativo, gestor_mestre, gestor_aprovado, excluido_em");
  if (erroPerfis) throw new Error(`Não consegui ler os perfis: ${erroPerfis.message}`);
  const ativos = (perfis ?? []).filter((p) => p.ativo !== false && !p.excluido_em);
  const mestres = ativos.filter((p) => p.gestor_mestre === true && p.gestor_aprovado === true && p.cargo === "Gestor");
  const aprovados = ativos.filter((p) => p.gestor_aprovado === true && p.cargo === "Gestor");
  for (const p of ativos) {
    if (p.gestor_mestre !== true || (p.cargo === "Gestor" && p.gestor_aprovado === true)) continue;
    riscos.push({
      chave: `mestre-irregular:${p.id}`,
      severidade: "alta",
      titulo: "Perfil com poder de mestre sem ser Gestor aprovado",
      detalhe: `Um perfil ativo tem gestor_mestre ligado, mas o cargo é "${p.cargo ?? "vazio"}"${p.gestor_aprovado ? "" : " e não foi aprovado"}. Qualquer checagem que olhe só gestor_mestre dá a ele as quatro lojas.`,
      comoArrumar: "Em Gestor › Usuários, desligar o gestor mestre deste perfil ou corrigir o cargo e aprovar — e confirmar quem fez a mudança.",
    });
  }
  // Mestre a mais do que nos últimos 7 dias (as rodadas anteriores guardam a contagem).
  const { data: anteriores } = await sb
    .from("aura_agente_execucoes")
    .select("metricas")
    .eq("agente_id", ID_CACADOR_BRECHAS)
    .eq("status", "ok")
    .gte("inicio", new Date(agora.getTime() - 7 * 86_400_000).toISOString())
    .limit(50);
  const contagens = (anteriores ?? [])
    .map((a) => Number((a.metricas as Record<string, unknown> | null)?.mestres))
    .filter((n) => Number.isFinite(n) && n > 0);
  const menor = contagens.length ? Math.min(...contagens) : null;
  if (menor !== null && mestres.length > menor) {
    riscos.push({
      chave: `mestres-aumentaram:${mestres.length}`,
      severidade: "alta",
      titulo: `Gestores mestres: de ${menor} para ${mestres.length} nesta semana`,
      detalhe: `Entrou gestor mestre novo nos últimos 7 dias. Mestre enxerga e muda as quatro lojas.`,
      comoArrumar: "Conferir em Gestor › Usuários quem é o mestre novo e se a promoção foi de propósito.",
    });
  }

  // ---------- 5. rotas protegidas, sem login ----------
  const base = baseDoServidor();
  const sondagens: Array<{ rota: string; resultado: ResultadoSondagem; status: number }> = [];
  for (const rota of ROTAS_PROTEGIDAS) {
    if (ctx.prazo !== undefined && ctx.prazo - Date.now() < 30_000) break;
    const { status, local } = await sondar(base, rota);
    sondagens.push({ rota, resultado: classificarSondagem(status, local), status });
  }
  const semResposta = sondagens.filter((s) => s.resultado === "sem_resposta");
  if (sondagens.length && semResposta.length === sondagens.length) {
    riscos.push({
      chave: "sondagem-sem-resposta",
      severidade: "media",
      titulo: "Não consegui sondar as rotas do próprio servidor",
      detalhe: `Nenhuma das ${sondagens.length} rotas respondeu em ${TEMPO_SONDAGEM_MS / 1000} s em ${base}.`,
      comoArrumar: "Conferir NEXT_PUBLIC_SITE_URL no .env.local (é o endereço que a sondagem usa) e se o servidor está no ar.",
    });
  } else {
    for (const s of sondagens) {
      const caminho = s.rota.split("?")[0];
      if (s.resultado === "aberta") {
        riscos.push({
          chave: `rota-aberta:${caminho}`,
          severidade: "urgente",
          titulo: `${caminho} responde sem login`,
          detalhe: `GET ${s.rota} sem credencial nenhuma devolveu ${s.status}: os dados dessa rota estão abertos para a internet.`,
          comoArrumar: "No começo da rota, conferir o login (getEmpresaAutenticada / cronAutorizado) e devolver 401 antes de ler qualquer dado.",
        });
      } else if (s.resultado === "erro_servidor") {
        riscos.push({
          chave: `rota-erro-sem-login:${caminho}`,
          severidade: "media",
          titulo: `${caminho} quebra quando chamada sem login`,
          detalhe: `GET ${s.rota} sem credencial devolveu ${s.status} em vez de 401: a rota faz alguma coisa antes de conferir quem chama.`,
          comoArrumar: "Mover a checagem de login para a primeira linha da rota e ver o erro no log do servidor.",
        });
      } else if (s.resultado === "sumiu" || s.resultado === "estranho") {
        riscos.push({
          chave: `rota-inesperada:${caminho}`,
          severidade: "baixa",
          titulo: `${caminho} respondeu ${s.status} sem login`,
          detalhe: `Esperava 401/403 e veio ${s.status}. Se a rota mudou de lugar, a lista de sondagem precisa ser atualizada.`,
          comoArrumar: "Atualizar ROTAS_PROTEGIDAS em src/lib/agentes/nativos/equipe-vermelha-regras.ts.",
        });
      }
    }
  }

  return entregarRiscos(ctx, {
    agente: ID_CACADOR_BRECHAS,
    nome: "Caçador de Brechas",
    rotulo: "Brecha",
    riscos,
    resumoOk: `Nenhuma brecha: RLS em todas as tabelas, ${politicas} políticas e ${funcoes} funções conferidas, ${sondagens.length} rotas fechadas sem login.`,
    metricas: {
      politicasLidas: politicas,
      funcoesLidas: funcoes,
      rotasSondadas: sondagens.length,
      rotasProtegidas: sondagens.filter((s) => s.resultado === "protegida").length,
      mestres: mestres.length,
      gestoresAprovados: aprovados.length,
    },
  });
}

export const agenteCacadorBrechas: DefinicaoAgente = {
  id: ID_CACADOR_BRECHAS,
  nome: "Caçador de Brechas",
  cargo: "Equipe Vermelha: segurança",
  setor: "seguranca",
  icone: "ShieldAlert",
  missao:
    "Todo dia tenta achar por onde alguém entraria no CRM — tabela sem RLS, regra aberta, função perigosa, poder indevido, rota que responde sem login — e diz como fechar. Só lê e sonda; nunca muda nada.",
  agenda: { tipo: "diario", horas: [6], minuto: 0 },
  usaIA: true,
  orcamentoMensalUsd: 0.5,
  tipo: "nativo",
  executar,
};
