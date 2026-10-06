import type { Relacionamento, Oportunidade, Venda } from "@/lib/types";
import type { Compromisso } from "@/lib/supabase/compromissos";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import type { MembroEquipe } from "@/lib/supabase/team";
import type { Lead } from "@/lib/supabase/leads";
import type { CompromissoMensal } from "@/lib/supabase/compromisso-mensal";
import { colunaDoNegocio, etapasVisiveis, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarDataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(ano, mes - 1, dia)
  );
}

export function montarContextoDados({
  nome,
  empresa,
  relacionamentos,
  oportunidades,
  vendas,
  atividades,
  compromissos = [],
  funil = FUNIL_PADRAO,
  posVendas,
  equipe,
  meuId,
  leads,
  compromissoMensal,
}: {
  nome: string;
  empresa: string;
  relacionamentos: Relacionamento[];
  oportunidades: Oportunidade[];
  vendas: Venda[];
  atividades: any[];
  compromissos?: Compromisso[];
  /** O funil da loja: as etapas do resumo saem dele, não de uma lista fixa. */
  funil?: EtapaFunil[];
  posVendas?: PosVenda[];
  equipe?: MembroEquipe[];
  meuId?: string;
  leads?: Lead[];
  compromissoMensal?: CompromissoMensal | null;
}) {
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const agoraLocal = new Date();
  const hojeISO = `${agoraLocal.getFullYear()}-${String(agoraLocal.getMonth() + 1).padStart(2, "0")}-${String(agoraLocal.getDate()).padStart(2, "0")}`;
  const em7dias = new Date();
  em7dias.setDate(em7dias.getDate() + 7);
  const em7diasISO = em7dias.toISOString().slice(0, 10);

  const valorPipeline = oportunidades.reduce((s, o) => s + o.valor, 0);
  const valorVendido = vendas.reduce((s, v) => s + v.valor, 0);

  const atrasados = relacionamentos.filter((r) => r.proximoContato.toLowerCase().includes("atrasado"));
  const paraHoje = relacionamentos.filter(
    (r) => r.proximoContato.toLowerCase().includes("hoje") && !atrasados.includes(r)
  );

  const followUpsDeAtividades = atividades
    .filter((atividade) => Boolean(atividade.proximoContatoEm))
    .filter((atividade) => String(atividade.proximoContatoEm).slice(0, 10) <= hojeISO)
    .map((atividade) => {
      const data = String(atividade.proximoContatoEm).slice(0, 10);
      const marcador = data < hojeISO ? "ATRASADO" : "HOJE";
      return `- [${marcador}] ${atividade.clienteNome || atividade.contexto || "Contato sem nome"} — próximo passo: ${atividade.proximoPasso || atividade.titulo} (${data})`;
    });

  const pendenciasHoje = [
    ...atrasados.map((r) => `- [ATRASADO] ${r.nome} (${r.categoria}) — próximo contato: ${r.proximoContato}`),
    ...paraHoje.map((r) => `- [HOJE] ${r.nome} (${r.categoria}) — próximo contato: ${r.proximoContato}`),
    ...followUpsDeAtividades,
  ].join("\n");

  const compromissosHoje = compromissos.filter((c) => c.data === hojeISO && !c.concluido);
  const compromissosProximos = compromissos.filter(
    (c) => c.data > hojeISO && c.data <= em7diasISO && !c.concluido
  );
  const compromissosAtrasados = compromissos.filter((c) => c.data < hojeISO && !c.concluido);

  function formatarCompromisso(c: Compromisso) {
    const partes = [c.hora ? `${formatarDataCurta(c.data)} ${c.hora}` : formatarDataCurta(c.data)];
    return `- ${partes.join(" ")} · ${c.tipo}: ${c.titulo}${c.relacionamentoNome ? ` (${c.relacionamentoNome})` : ""}${c.subtitulo ? ` — ${c.subtitulo}` : ""}`;
  }

  const agendaTexto = [
    compromissosAtrasados.length > 0
      ? `Atrasados (não concluídos, data já passou):\n${compromissosAtrasados.map(formatarCompromisso).join("\n")}`
      : "",
    compromissosHoje.length > 0
      ? `Hoje:\n${compromissosHoje.map(formatarCompromisso).join("\n")}`
      : "Hoje: nenhum compromisso agendado.",
    compromissosProximos.length > 0
      ? `Próximos 7 dias:\n${compromissosProximos.map(formatarCompromisso).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const porEtapa = etapasVisiveis(funil)
    .filter((e) => e.tipo !== "perda")
    .map(({ nome: etapa }) => {
      const itens = oportunidades.filter((o) => colunaDoNegocio(o.etapa, funil) === etapa);
      return `${etapa}: ${itens.length} oportunidade(s), ${formatarMoeda(itens.reduce((s, o) => s + o.valor, 0))}`;
    })
    .join("\n");

  const paradas = oportunidades
    .filter((o) => Number(o.diasParado ?? 0) >= 7)
    .sort((a, b) => Number(b.diasParado ?? 0) - Number(a.diasParado ?? 0))
    .slice(0, 10)
    .map((o) => `- ${o.cliente} — ${o.diasParado} dias sem avanço, etapa ${o.etapa}, valor ${formatarMoeda(o.valor)}`)
    .join("\n");

  const semContatoRecente = relacionamentos
    .filter((r) => r.temperatura === "esfriando" || r.temperatura === "frio")
    .map((r) => `- ${r.nome} (${r.categoria}), último contato: ${r.ultimoContato}`)
    .join("\n");

  const ultimasAtividades = [...atividades]
    .sort((a, b) => new Date(b.quando || b.ocorridaEm || b.criadoEm || 0).getTime() - new Date(a.quando || a.ocorridaEm || a.criadoEm || 0).getTime())
    .slice(0, 5)
    .map((a) => {
      const base = `- ${a.titulo} · ${a.contexto} (${a.quando})`;
      return a.observacao ? `${base}\n  Observação registrada: "${a.observacao}"` : base;
    })
    .join("\n");

  let secaoPosVenda = "";
  if (posVendas && posVendas.length > 0) {
    const atrasadas = posVendas.filter(
      (pv) => pv.status === "instalacao_agendada" && pv.dataAgendamento && pv.dataAgendamento < hojeISO
    );
    const reclamacoesAbertas = posVendas.filter((pv) => pv.reclamacao?.trim() && !pv.reclamacaoResolvida);
    const hojeInstalacoes = posVendas.filter(
      (pv) => pv.status === "instalacao_agendada" && pv.dataAgendamento === hojeISO
    );

    const partes = [
      atrasadas.length > 0
        ? `Instalações atrasadas:\n${atrasadas.map((pv) => `- ${pv.cliente} (${pv.produto})`).join("\n")}`
        : "",
      hojeInstalacoes.length > 0
        ? `Instalações agendadas para hoje:\n${hojeInstalacoes.map((pv) => `- ${pv.cliente} às ${pv.horaAgendamento ?? "sem horário definido"}`).join("\n")}`
        : "",
      reclamacoesAbertas.length > 0
        ? `Reclamações em aberto:\n${reclamacoesAbertas.map((pv) => `- ${pv.cliente}: "${pv.reclamacao}"`).join("\n")}`
        : "",
    ].filter(Boolean);

    secaoPosVenda = `\n\nPÓS-VENDA (instalações e satisfação do cliente):\n${
      partes.length > 0 ? partes.join("\n") : "Nenhuma pendência de pós-venda no momento."
    }`;
  }

  let secaoEquipe = "";
  if (equipe && equipe.length > 1 && meuId) {
    const outros = equipe.filter((m) => m.id !== meuId);
    if (outros.length > 0) {
      const mediaVendasEquipe = outros.reduce((s, m) => s + m.vendasEsteMes, 0) / outros.length;
      const mediaAtividadesEquipe = outros.reduce((s, m) => s + m.atividades7dias, 0) / outros.length;
      const eu = equipe.find((m) => m.id === meuId);
      const ordenadoPorVendas = [...equipe].sort((a, b) => b.vendasEsteMes - a.vendasEsteMes);
      const minhaPosicao = ordenadoPorVendas.findIndex((m) => m.id === meuId) + 1;

      secaoEquipe = `\n\nCOMPARAÇÃO COM A EQUIPE (mesma loja, ${equipe.length} vendedores):
Minha posição no ranking do mês: ${minhaPosicao}º de ${equipe.length}
Minhas vendas este mês: ${formatarMoeda(eu?.vendasEsteMes ?? 0)} | Média da equipe (sem contar eu): ${formatarMoeda(mediaVendasEquipe)}
Minhas atividades em 7 dias: ${eu?.atividades7dias ?? 0} | Média da equipe: ${mediaAtividadesEquipe.toFixed(1)}`;
    }
  }

  let secaoLeads = "";
  if (leads && leads.length > 0) {
    const meusLeads = meuId ? leads.filter((l) => l.vendedorId === meuId || l.sdrId === meuId) : leads;
    if (meusLeads.length > 0) {
      const respondidos = meusLeads.filter((l) => l.status === "respondido").length;
      const perdidos = meusLeads.filter((l) => l.status === "perdido").length;
      const pendentes = meusLeads.filter((l) =>
        ["aguardando_sdr", "atribuido_sdr", "repassado_vendedor"].includes(l.status)
      ).length;
      const taxaResposta = meusLeads.length > 0 ? Math.round((respondidos / meusLeads.length) * 100) : 0;
      const orcamentosEnviados = atividades.filter((a) => a.tipo?.toLowerCase().includes("orçamento")).length;

      secaoLeads = `\n\nLEADS E CONVERSÃO:
Recebi ${meusLeads.length} leads no total — ${respondidos} respondidos (${taxaResposta}% de taxa de resposta), ${pendentes} ainda pendentes, ${perdidos} perdidos.
Orçamentos enviados registrados: ${orcamentosEnviados} (comparar com o total de leads recebidos ajuda a ver se está faltando orçamento pra alguém que já esperou resposta).`;
    }
  }

  let secaoMetas = "";
  if (compromissoMensal && compromissoMensal.status === "aprovado") {
    const agora = new Date();
    const diaDoMes = agora.getDate();
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const percentualMesDecorrido = Math.round((diaDoMes / diasNoMes) * 100);

    const relIdsComAtividade = atividades.map((a) => a.relacionamentoId).filter(Boolean) as string[];
    const categoriaPorId = new Map(relacionamentos.map((r) => [r.id, r.categoria]));
    const arquitetosFeitos = relIdsComAtividade.filter((id) => categoriaPorId.get(id) === "Arquiteto").length;
    const construtorasFeitos = relIdsComAtividade.filter((id) => categoriaPorId.get(id) === "Construtora").length;
    const clientesNovosFeitos = atividades.filter((a) => a.tipo === "Cadastro" || a.tipo === "Prospecção").length;
    const visitasFeitas = atividades.filter((a) => a.tipo?.toLowerCase().includes("visita")).length;
    const ligacoesFeitas = atividades.filter((a) => a.tipo?.toLowerCase().includes("liga")).length;

    secaoMetas = `\n\nMETAS DO MÊS (Compromisso Mensal — ele mesmo definiu, o gestor já aprovou. Já estamos em aproximadamente ${percentualMesDecorrido}% do mês, use isso como referência de ritmo esperado):
Faturamento: meta ${formatarMoeda(compromissoMensal.metaFaturamento)} — vendido até agora ${formatarMoeda(valorVendido)}
Clientes novos: meta ${compromissoMensal.metaClientesNovos} — feito até agora ${clientesNovosFeitos}
Arquitetos: meta ${compromissoMensal.metaArquitetos} — feito até agora ${arquitetosFeitos}
Construtoras: meta ${compromissoMensal.metaConstrutoras} — feito até agora ${construtorasFeitos}
Visitas: meta ${compromissoMensal.metaVisitas} — feito até agora ${visitasFeitas}
Ligações: meta ${compromissoMensal.metaLigacoes} — feito até agora ${ligacoesFeitas}
Se algum item estiver claramente abaixo do ritmo esperado pra essa altura do mês, avise o vendedor com prioridade quando ele perguntar sobre o dia/resumo — é a meta que ele mesmo se comprometeu a cumprir.`;
  } else if (compromissoMensal === null) {
    secaoMetas = `\n\nMETAS DO MÊS: esse vendedor ainda não tem um Compromisso Mensal aprovado pelo gestor. Se ele perguntar sobre metas, lembre-o de preencher o Compromisso do Mês em "Meu Dia".`;
  }

  return `Hoje é ${hoje} (${hojeISO} no formato AAAA-MM-DD).
Vendedor: ${nome} — Loja: ${empresa}

AGENDA (compromissos reais cadastrados pelo vendedor):
${agendaTexto}

PENDÊNCIAS DE FOLLOW-UP (prioridade máxima — atrasados ou marcados para hoje):
${pendenciasHoje || "Nenhum follow-up atrasado ou marcado para hoje."}

PIPELINE (${formatarMoeda(valorPipeline)} em aberto, ${oportunidades.length} oportunidades):
${porEtapa || "Nenhuma oportunidade no momento."}

${paradas ? `OPORTUNIDADES PARADAS HÁ 7+ DIAS (merecem atenção):\n${paradas}\n` : ""}
VENDAS (total ${formatarMoeda(valorVendido)}, ${vendas.length} negócios fechados)

RELACIONAMENTOS: ${relacionamentos.length} no total.
${semContatoRecente ? `Esfriando ou sem contato recente (bons candidatos a uma ligação hoje):\n${semContatoRecente}\n` : ""}
ÚLTIMAS ATIVIDADES REGISTRADAS:
${ultimasAtividades || "Nenhuma atividade registrada ainda."}${secaoPosVenda}${secaoEquipe}${secaoLeads}${secaoMetas}`;
}
