import type { SupabaseClient } from "@supabase/supabase-js";
import { type Achado, type ResultadoSentinela, horasAtras, nivelGeral } from "./tipos";

const CARGOS_QUE_EXISTEM = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda", "Marketing", "Gestor"];

/**
 * Sentinela de Segurança: quem tem poder, o que está aberto e quem entrou.
 *
 * A auditoria de 24/11/2026 achou uma brecha que deixava qualquer conta nova
 * se dar o cargo "Diretor" (que nem existe mais na empresa) e ler as quatro
 * lojas. Ninguém tinha usado — mas
 * ninguém teria percebido se tivesse. Esta sentinela é quem percebe: ela
 * lembra quem era gestor mestre ontem e grita se aparecer um novo, e confere
 * todo dia que nenhuma tabela ficou sem RLS.
 */
export async function sentinelaDeSeguranca(
  sb: SupabaseClient,
  memoriaAnterior: Record<string, unknown> | null,
  agora = new Date(),
): Promise<ResultadoSentinela> {
  const achados: Achado[] = [];

  // ---------- 1. Tabela sem RLS (qualquer um com a chave pública lê) ----------
  const { data: semRls, error: erroRls } = await sb.rpc("aura_tabelas_sem_rls");
  if (erroRls) {
    achados.push({
      nivel: "atencao",
      titulo: "Checagem de RLS indisponível",
      detalhe: `Não consegui consultar as tabelas sem RLS (${erroRls.message}).`,
      acao: "Aplicar a migração 105 no Supabase.",
    });
  } else if (Array.isArray(semRls) && semRls.length) {
    achados.push({
      nivel: "critico",
      titulo: "Tabelas sem RLS",
      detalhe: `Sem proteção de linha, qualquer pessoa com a chave pública lê e grava: ${semRls.map((t: { tabela: string }) => t.tabela).join(", ")}.`,
      acao: "alter table ... enable row level security; e criar as políticas.",
    });
  }

  // ---------- 2. Políticas abertas para qualquer logado ----------
  const { data: abertas } = await sb.rpc("aura_politicas_abertas");
  if (Array.isArray(abertas) && abertas.length) {
    const tabelas = [...new Set(abertas.map((p: { tabela: string }) => p.tabela))];
    achados.push({
      nivel: "atencao",
      titulo: "Tabelas abertas a qualquer usuário logado",
      detalhe: `Regras "using (true)": qualquer pessoa logada, de qualquer loja, lê estas tabelas: ${tabelas.join(", ")}.`,
      acao: "Decidir se é de propósito; se não for, restringir por loja.",
    });
  }

  // ---------- 3. Quem tem poder ----------
  const { data: perfis } = await sb
    .from("profiles")
    .select("id, nome, empresa, cargo, ativo, gestor_mestre, gestor_aprovado, created_at")
    .is("excluido_em", null);
  const ativos = (perfis ?? []).filter((p) => p.ativo !== false);

  const mestres = ativos.filter((p) => p.gestor_mestre && p.gestor_aprovado);
  const mestresAntes = Array.isArray(memoriaAnterior?.mestres) ? (memoriaAnterior!.mestres as string[]) : null;
  if (mestresAntes) {
    const novos = mestres.filter((m) => !mestresAntes.includes(m.id));
    if (novos.length) {
      achados.push({
        nivel: "critico",
        titulo: "Novo gestor mestre",
        detalhe: `Passou a ter poder sobre as quatro lojas desde a última checagem: ${novos.map((m) => `${m.nome} (${m.empresa})`).join(", ")}.`,
        acao: "Confirmar que a promoção foi feita de propósito.",
      });
    }
  }

  // Cargo fora da lista (o antigo "Diretor", por exemplo): não existe na
  // empresa, então uma conta assim só aparece por erro ou por tentativa.
  const estranhos = ativos.filter((p) => !CARGOS_QUE_EXISTEM.includes(String(p.cargo ?? "")));
  if (estranhos.length) {
    achados.push({
      nivel: "critico",
      titulo: "Contas com cargo que não existe",
      detalhe: `${estranhos.map((d) => `${d.nome || "sem nome"} (cargo "${d.cargo ?? "vazio"}")`).join(", ")}.`,
      acao: "Corrigir o cargo ou desativar em Gestor › Usuários.",
    });
  }

  const aguardando = ativos.filter((p) => p.cargo === "Gestor" && !p.gestor_aprovado);
  if (aguardando.length) {
    achados.push({
      nivel: "atencao",
      titulo: "Gestores aguardando aprovação",
      detalhe: `${aguardando.map((g) => `${g.nome || "sem nome"} (${g.empresa || "sem loja"})`).join(", ")}.`,
      acao: "Aprovar ou recusar em Gestor › Usuários.",
    });
  }

  // ---------- 4. Contas de login sem perfil ----------
  // São as que poderiam se cadastrar com qualquer cargo antes da migração 105.
  const comPerfil = new Set((perfis ?? []).map((p) => p.id));
  const semPerfil: Array<{ email?: string; created_at: string }> = [];
  let totalLogins = 0;
  try {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) throw error;
      const usuarios = data?.users ?? [];
      totalLogins += usuarios.length;
      for (const u of usuarios) if (!comPerfil.has(u.id)) semPerfil.push({ email: u.email, created_at: u.created_at });
      if (usuarios.length < 200) break;
    }
  } catch (e) {
    console.error("[sentinela/seguranca] listUsers:", e);
  }
  const recentes = semPerfil.filter((u) => u.created_at >= horasAtras(24, agora));
  if (recentes.length) {
    achados.push({
      nivel: "atencao",
      titulo: "Contas novas sem perfil",
      detalhe: `${recentes.length} login(s) criado(s) nas últimas 24 h que ainda não completaram o cadastro.`,
      acao: "Se ninguém da equipe se cadastrou ontem, desligar o cadastro público no Supabase (Authentication › Sign In / Providers).",
    });
  }

  // ---------- 5. Segredos fracos na configuração ----------
  const segredoCron = process.env.CRON_SECRET?.trim() ?? "";
  if (segredoCron.length < 32) {
    achados.push({
      nivel: segredoCron ? "atencao" : "critico",
      titulo: "CRON_SECRET fraco ou ausente",
      detalhe: segredoCron ? "O segredo dos crons tem menos de 32 caracteres." : "Sem CRON_SECRET, nenhum cron roda.",
      acao: "Gerar outro com: openssl rand -hex 32",
    });
  }

  const nivel = nivelGeral(achados);
  return {
    sentinela: "seguranca",
    nivel,
    achados,
    resumo:
      nivel === "ok"
        ? `${mestres.length} gestor(es) mestre(s), RLS em todas as tabelas, nenhuma conta suspeita.`
        : `${achados.length} ponto(s) de segurança pedindo atenção.`,
    memoria: { mestres: mestres.map((m) => m.id), logins: totalLogins, semPerfil: semPerfil.length },
  };
}
