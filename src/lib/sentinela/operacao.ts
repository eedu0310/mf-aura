import type { SupabaseClient } from "@supabase/supabase-js";
import { totaisIA, saldoIA } from "@/lib/aura/custo-ia";
import { BUCKET_NUVEM } from "@/lib/backup/executar";
import { type Achado, type ResultadoSentinela, horasAtras, nivelGeral } from "./tipos";

/**
 * Sentinela de Operação: as rotinas rodaram, o backup existe, a IA responde e
 * o dinheiro dela não está acabando.
 *
 * O intervalo de cada cron é o do deploy/aura-crons com folga: um cron diário
 * só é cobrado depois de 26 h sem rodar; o de segunda a sábado, depois de 50 h
 * (para o domingo não virar alarme falso).
 */
const CRONS_ESPERADOS: Array<{ nome: string; horas: number; rotulo: string }> = [
  { nome: "repassar-leads", horas: 1, rotulo: "Repasse de leads parados (a cada 5 min)" },
  { nome: "briefing-do-dia", horas: 26, rotulo: "Briefing do dia (7h)" },
  { nome: "supervisao-aura", horas: 26, rotulo: "Supervisão da AURA (9h)" },
  { nome: "cobranca-supervisora", horas: 50, rotulo: "Cobrança da supervisora (seg a sáb)" },
  { nome: "cobrar-metas", horas: 26, rotulo: "Cobrança da meta do mês (11h)" },
  // Semanal desde 25/11/2026 (domingo 21h): cobrar em 26 h seria alarme falso.
  { nome: "aprendizado-do-dia", horas: 24 * 8, rotulo: "Aprendizado da semana (domingo, 21h)" },
  { nome: "agentes", horas: 2, rotulo: "Equipe de agentes (a cada 10 min)" },
  { nome: "assistentes", horas: 1, rotulo: "Agente do Instagram e assistente do chat do site (a cada 5 min)" },
  { nome: "backup", horas: 26, rotulo: "Backup do banco (22h)" },
  { nome: "gerar-relatorios", horas: 24 * 8, rotulo: "Relatório semanal (sábado)" },
  // A própria sentinela (7h30 e 13h30) está no deploy/aura-crons e faltava
  // aqui: parada, ninguém notava — o sino só ficava quieto. Rodada na mão pela
  // tela de Saúde do sistema, ela acusa o próprio cron parado.
  { nome: "sentinela", horas: 26, rotulo: "Sentinelas (7h30 e 13h30)" },
];

export async function sentinelaDeOperacao(sb: SupabaseClient, agora = new Date()): Promise<ResultadoSentinela> {
  const achados: Achado[] = [];

  // ---------- 1. Cada cron rodou dentro do prazo? ----------
  const { data: execucoes, error: erroDiario } = await sb
    .from("aura_execucoes_cron")
    .select("nome, inicio, ok, detalhe")
    .gte("inicio", horasAtras(24 * 9, agora))
    .order("inicio", { ascending: false })
    .limit(5000);

  if (erroDiario) {
    achados.push({
      nivel: "atencao",
      titulo: "Diário dos crons indisponível",
      detalhe: `Não consegui ler aura_execucoes_cron (${erroDiario.message}).`,
      acao: "Aplicar a migração 105 no Supabase.",
    });
  } else {
    const ultima = new Map<string, { inicio: string; ok: boolean; detalhe: unknown }>();
    for (const e of execucoes ?? []) if (!ultima.has(e.nome)) ultima.set(e.nome, e);

    for (const c of CRONS_ESPERADOS) {
      const u = ultima.get(c.nome);
      if (!u) {
        // Diário recém-criado: só cobra depois que ele tem ao menos um dia de vida.
        const diarioTemIdade = (execucoes ?? []).some((e) => e.inicio <= horasAtras(c.horas, agora));
        if (diarioTemIdade) {
          achados.push({
            nivel: "critico",
            titulo: `Cron parado: ${c.nome}`,
            detalhe: `${c.rotulo} não rodou nenhuma vez no período esperado.`,
            acao: "Conferir /etc/cron.d/aura e /var/log/aura-cron.log na VPS.",
          });
        }
        continue;
      }
      if (u.inicio < horasAtras(c.horas, agora)) {
        achados.push({
          nivel: "critico",
          titulo: `Cron parado: ${c.nome}`,
          detalhe: `${c.rotulo}: última execução em ${new Date(u.inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
          acao: "Conferir /etc/cron.d/aura e /var/log/aura-cron.log na VPS.",
        });
      } else if (!u.ok) {
        const erro = (u.detalhe as { erro?: string } | null)?.erro ?? "sem mensagem";
        achados.push({
          nivel: "atencao",
          titulo: `Cron falhou: ${c.nome}`,
          detalhe: `${c.rotulo} rodou, mas terminou com erro: ${erro}`,
          acao: "Ver journalctl -u aura na VPS.",
        });
      }
    }
  }

  // ---------- 2. O backup existe fora do servidor? ----------
  // Confere o arquivo no Storage, não o diário: é o arquivo que salva a
  // empresa num desastre, não o registro de que o cron rodou.
  const { data: arquivos, error: erroBucket } = await sb.storage
    .from(BUCKET_NUVEM)
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (erroBucket) {
    achados.push({
      nivel: "critico",
      titulo: "Backup na nuvem inacessível",
      detalhe: `Não consegui listar o bucket "${BUCKET_NUVEM}": ${erroBucket.message}`,
    });
  } else {
    const backups = (arquivos ?? []).filter((a) => /^aura-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(a.name));
    const maisNovo = backups[0];
    if (!maisNovo) {
      achados.push({
        nivel: "critico",
        titulo: "Nenhum backup na nuvem",
        detalhe: `O bucket "${BUCKET_NUVEM}" não tem nenhum arquivo de backup do banco.`,
        acao: "Rodar o cron de backup e conferir o resultado.",
      });
    } else if ((maisNovo.created_at ?? "") < horasAtras(26, agora)) {
      achados.push({
        nivel: "critico",
        titulo: "Backup atrasado",
        detalhe: `O backup mais novo é ${maisNovo.name}, de mais de 26 horas atrás.`,
        acao: "Conferir o cron de backup das 22h.",
      });
    }
  }

  // ---------- 3. A IA está respondendo? ----------
  const { data: falhas, count: totalFalhas } = await sb
    .from("ia_falhas")
    .select("funcao", { count: "exact" })
    .gte("criado_em", horasAtras(24, agora))
    .limit(1000);
  const n = totalFalhas ?? 0;
  if (n >= 20) {
    const porFuncao = new Map<string, number>();
    for (const f of falhas ?? []) porFuncao.set(f.funcao, (porFuncao.get(f.funcao) ?? 0) + 1);
    const pior = [...porFuncao.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([f, q]) => `${f} (${q})`).join(", ");
    achados.push({
      nivel: n >= 100 ? "critico" : "atencao",
      titulo: "IA falhando",
      detalhe: `${n} chamadas da IA falharam nas últimas 24 h. Mais afetadas: ${pior}.`,
      acao: "Ver a tabela ia_falhas: chave, saldo na Anthropic ou modelo inválido.",
    });
  }

  // ---------- 4. O dinheiro da IA ----------
  const [totais, saldo] = await Promise.all([totaisIA(agora), saldoIA(true)]);
  if (saldo.depositado > 0) {
    if (saldo.saldo <= 0) {
      achados.push({
        nivel: "critico",
        titulo: "Saldo da IA esgotado",
        detalhe: `Gasto US$ ${saldo.gasto.toFixed(2)} de US$ ${saldo.depositado.toFixed(2)} depositados.`,
        acao: "Registrar o novo depósito em Gestor › Custo da IA.",
      });
    } else if (saldo.saldo < saldo.alerta) {
      achados.push({
        nivel: "atencao",
        titulo: "Saldo da IA baixo",
        detalhe: `Restam US$ ${saldo.saldo.toFixed(2)} (alerta configurado em US$ ${saldo.alerta.toFixed(2)}).`,
        acao: "Planejar o próximo depósito.",
      });
    }
  }

  // Gasto do dia muito acima da média do mês: sinal de laço ou abuso.
  const diaDoMes = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "numeric" }).format(agora));
  const mediaDiaria = diaDoMes > 1 ? (totais.gastoMes - totais.gastoHoje) / (diaDoMes - 1) : 0;
  if (mediaDiaria > 0.5 && totais.gastoHoje > mediaDiaria * 3) {
    achados.push({
      nivel: "atencao",
      titulo: "Gasto da IA disparou hoje",
      detalhe: `Hoje: US$ ${totais.gastoHoje.toFixed(2)} em ${totais.chamadasHoje} chamadas; média do mês: US$ ${mediaDiaria.toFixed(2)}/dia.`,
      acao: "Ver em Gestor › Custo da IA qual função puxou o gasto.",
    });
  }

  const nivel = nivelGeral(achados);
  return {
    sentinela: "operacao",
    nivel,
    achados,
    resumo:
      nivel === "ok"
        ? `Crons em dia, backup na nuvem, IA respondendo. Gasto de hoje: US$ ${totais.gastoHoje.toFixed(2)}.`
        : `${achados.length} ponto(s) de operação pedindo atenção.`,
    memoria: { gastoHoje: totais.gastoHoje, gastoMes: totais.gastoMes, falhasIA24h: n },
  };
}
