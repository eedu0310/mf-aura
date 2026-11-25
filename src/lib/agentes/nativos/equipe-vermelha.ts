/**
 * EQUIPE VERMELHA — a entrega comum dos dois sabotadores (Caçador de Brechas
 * e Caçador de Erros): transforma a lista de riscos achada por regra em
 *
 *   - UM alerta para a Diretora no escritório (só quando aparece risco que
 *     ela ainda não ouviu nas últimas 24 h — sem repetir a cada 6 horas);
 *   - um card no Meu Dia de cada gestor mestre para cada risco ALTO ou
 *     URGENTE (chave estável: o card se atualiza em vez de repetir e fecha
 *     sozinho quando o problema some — "resolvida_sozinha" do motor).
 *
 * O "como arrumar" é escrito por regra. A IA (perfil rápido, uma chamada só,
 * com teto de tokens do tamanho da lista e o prazo da rodada) só reescreve
 * esse texto mais claro para quem lê — e só para risco NOVO: o que já tem
 * card mantém o texto (não paga duas vezes nem muda o card à toa). Número que
 * a IA trouxer e não estava no achado descarta o texto dela.
 */
import type { Achado, ContextoAgente, MensagemEscritorio, Prioridade, ResultadoAgente } from "../tipos";
import { numerosConferem, numerosDoTexto } from "../util";
import { chaveDe, limitarPorPessoa, plural, responsaveisDaLoja } from "./comum";
import { ordenarRiscos, viraCard, type Risco } from "./equipe-vermelha-regras";

/** Quantos riscos novos, no máximo, vão para a IA reescrever numa rodada. */
const MAX_PARA_IA = 10;

const SEPARADOR = "\nComo arrumar: ";

/** Descrição do card: o que foi achado + como arrumar. */
function descricaoDoCard(r: Risco, comoArrumar: string): string {
  return `${r.detalhe}${SEPARADOR}${comoArrumar}`;
}

/** O "como arrumar" que já está num card aberto (para não reescrever). */
function comoArrumarDoCard(descricao: string | null | undefined): string | null {
  const i = (descricao ?? "").indexOf(SEPARADOR);
  return i === -1 ? null : (descricao as string).slice(i + SEPARADOR.length).trim() || null;
}

async function reescreverComIA(ctx: ContextoAgente, agente: string, riscos: Risco[]): Promise<Map<string, string>> {
  const saida = new Map<string, string>();
  if (!riscos.length) return saida;
  const lote = riscos.slice(0, MAX_PARA_IA);
  const r = await ctx.ia({
    perfil: "rapido",
    json: true,
    // ~90 tokens por item (chave + até 2 frases) mais a moldura do JSON.
    maxTokens: Math.min(2000, 250 + lote.length * 140),
    sistema:
      `Você é o ${agente}, da Equipe Vermelha do CRM AURA (lojas de lareiras e aquecimento). ` +
      "Recebe problemas de segurança ou de funcionamento achados por regra, cada um com uma sugestão de conserto. " +
      "Reescreva a sugestão para o gestor, em português do Brasil, em até 2 frases curtas e práticas, sem emojis e sem markdown. " +
      "Não invente nada: não acrescente número, nome de tabela, rota ou comando que não esteja no item. " +
      'Responda só JSON: {"itens":[{"chave":"...","comoArrumar":"..."}]} com um objeto por item recebido.',
    usuario: JSON.stringify(lote.map((x) => ({ chave: x.chave, problema: x.titulo, detalhe: x.detalhe, sugestao: x.comoArrumar }))),
  });
  const itens = r && typeof r === "object" && Array.isArray((r as { itens?: unknown }).itens) ? (r as { itens: unknown[] }).itens : [];
  const porChave = new Map(lote.map((x) => [x.chave, x]));
  for (const item of itens) {
    if (!item || typeof item !== "object") continue;
    const { chave, comoArrumar } = item as { chave?: unknown; comoArrumar?: unknown };
    const risco = typeof chave === "string" ? porChave.get(chave) : undefined;
    const texto = typeof comoArrumar === "string" ? comoArrumar.trim() : "";
    if (!risco || texto.length < 10 || texto.length > 500) continue;
    const permitidos = numerosDoTexto(`${risco.titulo} ${risco.detalhe} ${risco.comoArrumar}`);
    if (!numerosConferem(texto, permitidos)) continue;
    saida.set(risco.chave, texto);
  }
  return saida;
}

const PRIORIDADE: Record<"alta" | "urgente", Prioridade> = { alta: "alta", urgente: "urgente" };

/**
 * Monta o resultado da rodada a partir dos riscos (já achados por regra).
 * `rotulo` aparece no título dos cards ("Brecha", "Erro").
 */
export async function entregarRiscos(
  ctx: ContextoAgente,
  opcoes: { agente: string; nome: string; rotulo: string; riscos: Risco[]; metricas: Record<string, number>; resumoOk: string },
): Promise<ResultadoAgente> {
  const { sb } = ctx;
  // Mesma chave duas vezes (ex.: duas rodadas presas do mesmo agente) conta uma vez, a mais grave.
  const unicos = new Map<string, Risco>();
  for (const r of ordenarRiscos(opcoes.riscos)) if (!unicos.has(r.chave)) unicos.set(r.chave, r);
  const riscos = [...unicos.values()];
  const graves = riscos.filter(viraCard);

  // Cards já abertos deste agente: o texto (e o "como arrumar") fica como está.
  const { data: abertos } = await sb
    .from("aura_recomendacoes")
    .select("chave, descricao")
    .eq("agente", opcoes.agente)
    .eq("status", "pendente")
    .limit(2000);
  const textoAberto = new Map<string, string>();
  for (const a of (abertos ?? []) as Array<{ chave: string; descricao: string | null }>) {
    const como = comoArrumarDoCard(a.descricao);
    if (como) textoAberto.set(a.chave, como);
  }

  const equipe = await responsaveisDaLoja(sb);
  const mestres = equipe.mestres();
  const chaveDoCard = (r: Risco, mestreId: string) => chaveDe(opcoes.agente, r.chave, mestreId);
  const jaTemTexto = (r: Risco) => mestres.some((m) => textoAberto.has(chaveDoCard(r, m.id)));
  const novos = graves.filter((r) => !jaTemTexto(r));
  const daIA = await reescreverComIA(ctx, opcoes.nome, novos);

  const achados: Achado[] = [];
  for (const r of graves) {
    for (const m of mestres) {
      const chave = chaveDoCard(r, m.id);
      const como = textoAberto.get(chave) ?? daIA.get(r.chave) ?? r.comoArrumar;
      achados.push({
        chave,
        empresa: m.empresa,
        destinatarioId: m.id,
        titulo: `${opcoes.rotulo}: ${r.titulo}`.slice(0, 140),
        descricao: descricaoDoCard(r, como).slice(0, 1500),
        prioridade: PRIORIDADE[r.severidade as "alta" | "urgente"],
        entidadeTipo: "perfil",
        entidadeId: m.id,
        acaoUrl: "/gestor?aba=agentes-equipe",
        expiraEmDias: 7,
      });
    }
  }
  const { achados: final, cortados } = limitarPorPessoa(achados);

  // Alerta para a Diretora só quando há risco que ela não ouviu nas últimas 24 h.
  const mensagens: MensagemEscritorio[] = [];
  if (riscos.length) {
    const { data: ditos } = await sb
      .from("aura_escritorio_mensagens")
      .select("dados")
      .eq("de_agente", opcoes.agente)
      .eq("tipo", "alerta")
      .gte("criado_em", new Date(ctx.agora.getTime() - 24 * 3_600_000).toISOString())
      .limit(50);
    const ouvidos = new Set<string>();
    for (const d of (ditos ?? []) as Array<{ dados: { chaves?: unknown } | null }>) {
      if (Array.isArray(d.dados?.chaves)) for (const c of d.dados.chaves) ouvidos.add(String(c));
    }
    const inedito = riscos.some((r) => r.severidade !== "baixa" && !ouvidos.has(r.chave));
    if (inedito) {
      const linhas = riscos
        .filter((r) => r.severidade !== "baixa")
        .slice(0, 8)
        .map((r) => `[${r.severidade}] ${r.titulo} — como arrumar: ${daIA.get(r.chave) ?? r.comoArrumar}`);
      const resto = riscos.filter((r) => r.severidade !== "baixa").length - linhas.length;
      mensagens.push({
        de: opcoes.agente,
        tipo: "alerta",
        texto: `${linhas.join("\n")}${resto > 0 ? `\n… e mais ${resto}.` : ""}`.slice(0, 3000),
        dados: { chaves: riscos.map((r) => r.chave), graves: graves.length },
      });
    }
  }

  const conta = (s: Risco["severidade"]) => riscos.filter((r) => r.severidade === s).length;
  return {
    resumo: riscos.length
      ? `${plural(riscos.length, "achado")}: ${conta("urgente")} urgente(s), ${conta("alta")} alto(s), ${conta("media")} médio(s), ${conta("baixa")} baixo(s).`
      : opcoes.resumoOk,
    achados: final,
    mensagens,
    metricas: {
      ...opcoes.metricas,
      riscos: riscos.length,
      urgentes: conta("urgente"),
      altos: conta("alta"),
      medios: conta("media"),
      baixos: conta("baixa"),
      textosComIA: daIA.size,
      cortadosPeloTeto: cortados,
    },
  };
}
