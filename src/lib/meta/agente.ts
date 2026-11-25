/**
 * Agente de IA do Instagram.
 *
 * Pedido do Elton (24/11/2026): se o vendedor não responder o direct em 2
 * horas, o agente responde — configurável por loja, como o chat do site, e
 * sabendo a diferença entre loja (LF, A&G, Sole) e fábrica (MF).
 *
 * Quando responde:
 *  - o cliente foi o último a escrever e já passou o tempo configurado
 *    (padrão 2h) sem resposta da loja — o cron passa de 5 em 5 minutos;
 *  - ou, se o gestor ligar, na hora quando a mensagem chega fora do horário
 *    da loja.
 * Não responde se: o agente está desligado na loja ou pausado na conversa,
 * o prazo de 24h da Meta está no fim, ou já respondeu demais nas últimas 24h.
 *
 * Ele se apresenta como assistente virtual, não fala preço nem condição de
 * pagamento, usa só o material da loja que está na AURA e deixa tudo pronto
 * para o vendedor continuar.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { materiaisParaPergunta } from "@/lib/aura/trechos";
import { podeChamarIA, registrarUsoIA } from "@/lib/aura/custo-ia";
import { modeloDeVolume } from "@/lib/aura/modelos";
import { dentroDoHorario, horarioEmTexto, limparHorario, type Horario } from "@/lib/site-mf/horario";
import { contaDaLoja, dentroDaJanela, enviarMensagem, responderComentario } from "./cliente";
import { registrarEnviada } from "./conversa";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

export const NOME_DO_AGENTE = "assistente virtual";
const MAX_RESPOSTAS_24H = 6;
const ESPERA_NA_HORA_MS = 20_000;
const MARGEM_DA_JANELA_MS = 10 * 60_000;
const POR_RODADA = 15;

export interface ConfigAgente {
  empresa: string;
  ativa: boolean;
  esperar_horas: number;
  fora_do_horario: boolean;
  horario: Horario;
  responder_comentarios: boolean;
  instrucoes: string;
}

export const CONFIG_PADRAO = (empresa: string): ConfigAgente => ({
  empresa,
  ativa: false,
  esperar_horas: 2,
  fora_do_horario: true,
  horario: {},
  responder_comentarios: false,
  instrucoes: "",
});

// --- Quem é quem ------------------------------------------------------------
// Fábrica e lojas falam de jeitos diferentes: a MF fabrica e atende
// arquitetos, construtoras e revendas; as lojas vendem para o cliente final,
// com showroom e instalação própria.

interface Perfil {
  papel: "fabrica" | "loja";
  apresentacao: string;
  contato: string;
  objetivo: string;
}

const PERFIS: Record<string, Perfil> = {
  "MF International": {
    papel: "fabrica",
    apresentacao:
      "a MF International, FÁBRICA de lareiras de alto rendimento, fornos, braseiros e tubulações prediais em São Sebastião do Caí/RS, desde 1977, pioneira na tripla combustão",
    contato: "WhatsApp (51) 3536-1422 · ERS-122, Km 08, Conceição, São Sebastião do Caí/RS",
    objetivo: `Descubra primeiro QUEM está falando: cliente final, arquiteto(a), construtora ou revenda.
- Arquiteto(a): ofereça os blocos 3D dos modelos e a orientação técnica gratuita no projeto; pergunte o projeto e a cidade.
- Construtora: fale do sistema predial de chaminés MF (padronização, prazo de obra) e pergunte a obra, a cidade e o número de unidades.
- Revenda: pergunte a cidade e a loja; a equipe comercial da fábrica retorna.
- Cliente final: entenda o ambiente (m² e pé-direito), o tipo de lareira e a CIDADE; a equipe indica quem atende a região (a própria fábrica ou a loja parceira mais próxima). Não prometa qual loja.`,
  },
  "LF Lareiras": {
    papel: "loja",
    apresentacao:
      "a LF Lareiras, LOJA de aquecimento com showroom ao lado da fábrica MF, em São Sebastião do Caí/RS, com instalação própria",
    contato: "WhatsApp (51) 3536-1701 · ERS-122, km 8, nº 8250, Conceição, São Sebastião do Caí/RS",
    objetivo:
      "A LF é LOJA (não fábrica): vende lareiras e também outros produtos de aquecimento e área gourmet que estiverem no material dela. Entenda o que o cliente procura e, se for aquecimento, o ambiente (m² e pé-direito), se é casa pronta ou obra, a cidade e o estilo. Convide para conhecer o showroom e peça o WhatsApp para o consultor mandar a proposta.",
  },
  "A&G Aquecimento": {
    papel: "loja",
    apresentacao:
      "a A&G Aquecimento, LOJA de aquecimento em Garibaldi/RS (Centro e loja conceito no Boulevard Convention), com instalação própria",
    contato: "WhatsApp (54) 99327-2098 · Av. Rio Branco, 495, Centro e Av. Garibaldina, 1441, loja 05, Garibaldi/RS",
    objetivo:
      "Entenda o que o cliente quer aquecer (ambiente em m² e pé-direito), se é casa pronta ou obra, a cidade e o estilo. Convide para conhecer uma das lojas e peça o WhatsApp para o consultor mandar a proposta.",
  },
  "Sole Aquecimento": {
    papel: "loja",
    apresentacao: "a Sole Ferro e Fogo, LOJA de aquecimento de alto padrão em Bento Gonçalves/RS",
    contato: "WhatsApp (54) 99180-5838 · R. Fiorelo Bertuol, 739, Progresso, Bento Gonçalves/RS",
    objetivo:
      "Entenda o que o cliente quer aquecer (ambiente em m² e pé-direito), se é casa pronta ou obra, a cidade e o estilo. Convide para conhecer a loja e peça o WhatsApp para o consultor mandar a proposta.",
  },
};

function perfilDa(empresa: string): Perfil {
  return (
    PERFIS[empresa] ?? {
      papel: "loja",
      apresentacao: `a ${empresa}, loja de aquecimento do Rio Grande do Sul`,
      contato: "",
      objetivo: "Entenda a necessidade do cliente e peça o WhatsApp para o consultor continuar.",
    }
  );
}

// --- Config -----------------------------------------------------------------

export async function configDoAgente(sb: ClienteServico, empresa: string): Promise<ConfigAgente> {
  const { data } = await sb.from("meta_ia_config").select("*").eq("empresa", empresa).maybeSingle();
  if (!data) return CONFIG_PADRAO(empresa);
  return {
    empresa,
    ativa: Boolean(data.ativa),
    esperar_horas: Number(data.esperar_horas ?? 2),
    fora_do_horario: data.fora_do_horario !== false,
    horario: limparHorario(data.horario),
    responder_comentarios: Boolean(data.responder_comentarios),
    instrucoes: String(data.instrucoes ?? ""),
  };
}

// --- IA ---------------------------------------------------------------------

let cliente: Anthropic | null = null;
function ia() {
  const k = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  if (!k) return null;
  cliente ??= new Anthropic({ apiKey: k });
  return cliente;
}

const emAndamento = new Set<string>();
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Só o material da própria loja, ligado em Materiais. Pedido do Elton
 * (25/11): o agente da LF trabalha com o que a LF trabalha, nada além —
 * nem o material da fábrica nem o de outra loja.
 */
async function material(sb: ClienteServico, empresa: string, assunto: string) {
  return materiaisParaPergunta(sb as never, empresa, assunto, 8).catch(() => "");
}

function regras(empresa: string, cfg: ConfigAgente, situacao: string, publico: boolean) {
  const p = perfilDa(empresa);
  const horario = horarioEmTexto(cfg.horario);
  return `Você é o ${NOME_DO_AGENTE} do Instagram d${p.apresentacao.startsWith("a ") ? "" : "e "}${p.apresentacao}.

SITUAÇÃO: ${situacao}${horario ? ` Horário da equipe: ${horario}.` : ""} Você atende até um consultor assumir; tudo o que você escreve a equipe lê no AURA.
Contato da ${p.papel === "fabrica" ? "fábrica" : "loja"}: ${p.contato || "não informado"}.

COMO ESCREVER
- Português do Brasil, tom cordial e próximo, como um bom atendente gaúcho, tratando por "você". ${publico ? "É uma resposta PÚBLICA num comentário: no máximo 2 frases curtas, e convide para continuar pelo direct." : "É o direct do Instagram: no máximo 3 frases curtas por mensagem, sem listas, sem markdown."}
- Um emoji no máximo, e só se combinar.
- ${publico ? "Não peça telefone em público." : "Termine com UMA pergunta que faça a conversa andar."}
- Se perguntarem, diga que é o assistente virtual; nunca finja ser uma pessoa.
- Valor antes de preço: entenda o que o cliente precisa antes de falar de produto.

OBJETIVO
${p.objetivo}

REGRAS QUE NÃO PODEM SER QUEBRADAS
- Fale SOMENTE do que está nos MATERIAIS DESTA ${p.papel === "fabrica" ? "FÁBRICA" : "LOJA"} abaixo: produtos, marcas, modelos, dados técnicos e serviços. Não cite produto, marca ou informação que não esteja lá, nem de outras lojas. Se não estiver lá, diga que o consultor confirma.
- NÃO informe preços, descontos, parcelamento nem condições de pagamento: o consultor manda a proposta conforme o projeto.
- Garantia: só o que o material disser; nunca diga garantia vitalícia de lareira.
- Não diga que lareira suspensa tem tripla combustão.
- Não prometa prazo de entrega, de instalação nem visita com data. Não fale mal da concorrência.
- Não oriente instalação em móvel de madeira/MDF ou gesso comum.
- Emergência (fumaça dentro de casa, princípio de incêndio): apagar o fogo com segurança, ventilar e ligar 193.
- Reclamação ou problema com produto comprado: peça desculpas pelo transtorno, anote o modelo e o problema e diga que a equipe retorna. Não discuta.
- Se o cliente quiser falar com alguém agora, passe o WhatsApp da ${p.papel === "fabrica" ? "fábrica" : "loja"}.
${cfg.instrucoes.trim() ? `\nINSTRUÇÕES DO GESTOR DESTA ${p.papel === "fabrica" ? "FÁBRICA" : "LOJA"} (valem junto com as regras acima, nunca contra elas):\n${cfg.instrucoes.trim().slice(0, 2000)}\n` : ""}`;
}

async function gerar(sistema: string, turnos: { role: "user" | "assistant"; content: string }[], empresa: string, maxTokens: number) {
  const modelo = modeloDeVolume();
  const resposta = await ia()!.messages.create({
    model: modelo,
    max_tokens: maxTokens,
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: turnos,
  });
  void registrarUsoIA({ funcao: "instagram-agente", modelo, uso: (resposta as any).usage, empresa });
  return resposta.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

function descreverAnexo(tipo: string) {
  if (tipo === "image") return "[o cliente mandou uma foto, que você não consegue ver]";
  if (tipo === "audio") return "[o cliente mandou um áudio, que você não consegue ouvir]";
  if (tipo === "video") return "[o cliente mandou um vídeo]";
  if (tipo === "share" || tipo === "ig_reel" || tipo === "reel") return "[o cliente compartilhou uma publicação]";
  if (tipo === "story_mention") return "[o cliente marcou a loja num story]";
  if (tipo && tipo !== "text") return "[anexo]";
  return "";
}

// --- Direct -----------------------------------------------------------------

/**
 * Responde a conversa se ainda for a vez da loja. `motivo` só muda o que o
 * agente sabe da situação.
 */
export async function responderConversa(conversaId: string, motivo: "demora" | "fora_do_horario"): Promise<boolean> {
  const sb = getSupabaseServiceClient();
  if (!sb || !ia() || emAndamento.has(conversaId)) return false;
  emAndamento.add(conversaId);
  try {
    const { data: conversa } = await sb
      .from("meta_conversas")
      .select("id, empresa, cliente_ig_id, cliente_nome, cliente_usuario, responde_ate, ignorado, ia_pausada")
      .eq("id", conversaId)
      .maybeSingle();
    if (!conversa || conversa.ignorado || conversa.ia_pausada) return false;
    // Sem tempo de janela, a Meta recusaria o envio.
    if (!dentroDaJanela(conversa.responde_ate)) return false;
    if (new Date(conversa.responde_ate).getTime() - Date.now() < MARGEM_DA_JANELA_MS) return false;

    const cfg = await configDoAgente(sb, conversa.empresa);
    if (!cfg.ativa) return false;

    const { data: msgs } = await sb
      .from("meta_mensagens")
      .select("id, de_mim, texto, tipo, por_ia, criado_em")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: true })
      .limit(80);
    const lista = msgs ?? [];
    const ultima = lista[lista.length - 1];
    if (!ultima || ultima.de_mim) return false;

    const ontem = Date.now() - 24 * 3600_000;
    const daIa = lista.filter((m) => m.por_ia && new Date(m.criado_em).getTime() > ontem).length;
    if (daIa >= MAX_RESPOSTAS_24H) return false;
    if (!(await podeChamarIA())) return false;

    const turnos: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of lista.slice(-24)) {
      const papel = m.de_mim ? ("assistant" as const) : ("user" as const);
      const texto = [m.texto, descreverAnexo(m.tipo)].filter(Boolean).join(" ") || "…";
      const ant = turnos[turnos.length - 1];
      if (ant && ant.role === papel) ant.content += `\n${texto}`;
      else turnos.push({ role: papel, content: texto });
    }
    while (turnos.length && turnos[0].role !== "user") turnos.shift();
    if (!turnos.length) return false;

    const assunto = turnos.filter((t) => t.role === "user").map((t) => t.content).join("\n");
    const mat = await material(sb, conversa.empresa, assunto);
    const nome = conversa.cliente_nome || (conversa.cliente_usuario ? `@${conversa.cliente_usuario}` : "não informado");
    const situacao =
      motivo === "fora_do_horario"
        ? "agora é FORA do horário de atendimento da equipe."
        : `o cliente está esperando há mais de ${cfg.esperar_horas} hora(s) e a equipe ainda não conseguiu responder. Agradeça a paciência de forma natural, sem se desculpar demais.`;
    const sistema = `${regras(conversa.empresa, cfg, situacao, false)}
Cliente: ${nome}.

MATERIAIS DESTA ${perfilDa(conversa.empresa).papel === "fabrica" ? "FÁBRICA" : "LOJA"} (a única fonte que você pode usar):
${mat || "(nenhum material cadastrado: não fale de produto nenhum; cumprimente, pergunte o que o cliente precisa, a cidade e o WhatsApp, e diga que o consultor responde com os detalhes)"}`;

    const texto = (await gerar(sistema, turnos, conversa.empresa, 350)).slice(0, 900);
    if (!texto) return false;

    // Enquanto pensava, alguém respondeu ou o cliente escreveu de novo? Então
    // esta resposta ficou velha.
    const { data: depois } = await sb
      .from("meta_mensagens")
      .select("id")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (depois && depois.id !== ultima.id) return false;

    const conta = await contaDaLoja(conversa.empresa);
    if (!conta) return false;
    const r = await enviarMensagem(conta, String(conversa.cliente_ig_id), texto);
    await registrarEnviada(sb, conversaId, { mid: r?.message_id, texto, porIa: true });
    return true;
  } catch (e) {
    console.error("[instagram/agente]", (e as Error).message);
    return false;
  } finally {
    emAndamento.delete(conversaId);
  }
}

/** Chamado pelo webhook: fora do horário, responde em seguida (se ligado). */
export async function agenteNaHora(conversaId: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  const { data: c } = await sb.from("meta_conversas").select("empresa").eq("id", conversaId).maybeSingle();
  if (!c) return;
  const cfg = await configDoAgente(sb, c.empresa);
  if (!cfg.ativa || !cfg.fora_do_horario || dentroDoHorario(cfg.horario)) return;
  // O cliente costuma mandar duas ou três mensagens seguidas: espera um pouco.
  await esperar(ESPERA_NA_HORA_MS);
  await responderConversa(conversaId, "fora_do_horario");
}

// --- Comentários ------------------------------------------------------------

async function responderComentarioComIA(sb: ClienteServico, cfg: ConfigAgente, c: any): Promise<boolean> {
  if (!(await podeChamarIA())) return false;
  const mat = await material(sb, cfg.empresa, c.texto ?? "");
  const sistema = `${regras(cfg.empresa, cfg, "um comentário numa publicação ficou sem resposta da equipe.", true)}
Se o comentário for só elogio, emoji ou marcação de amigo, agradeça em poucas palavras. Se for spam ou ofensa, responda exatamente: PULAR

MATERIAIS DESTA LOJA (a única fonte que você pode usar):
${mat || "(nenhum material: não fale de produto; só agradeça e convide para o direct)"}`;
  const texto = (await gerar(sistema, [{ role: "user", content: `@${c.autor_usuario ?? "cliente"} comentou: ${c.texto}` }], cfg.empresa, 160)).slice(0, 400);
  if (!texto || /^PULAR\b/i.test(texto)) {
    await sb.from("meta_comentarios").update({ respondido: true }).eq("id", c.id);
    return false;
  }
  const conta = await contaDaLoja(cfg.empresa);
  if (!conta) return false;
  await responderComentario(conta, String(c.comentario_id), texto);
  await sb.from("meta_comentarios").update({ respondido: true, respondido_por_ia: true }).eq("id", c.id);
  return true;
}

// --- A rodada do cron -------------------------------------------------------

/** Roda de 5 em 5 minutos: procura o que esperou demais e responde. */
export async function rodadaDoAgente() {
  const sb = getSupabaseServiceClient();
  const resumo = { lojas: 0, conversas: 0, comentarios: 0, erros: [] as string[] };
  if (!sb || !ia()) return resumo;

  const { data: configs } = await sb.from("meta_ia_config").select("empresa").eq("ativa", true);
  for (const { empresa } of configs ?? []) {
    resumo.lojas++;
    try {
      const cfg = await configDoAgente(sb, empresa);
      const fora = cfg.fora_do_horario && !dentroDoHorario(cfg.horario);
      // Fora do horário (com a opção ligada) não precisa esperar as horas.
      const limite = new Date(Date.now() - (fora ? 2 * 60_000 : cfg.esperar_horas * 3600_000)).toISOString();
      const { data: candidatas } = await sb
        .from("meta_conversas")
        .select("id")
        .eq("empresa", empresa)
        .eq("ignorado", false)
        .eq("ia_pausada", false)
        .gt("responde_ate", new Date(Date.now() + MARGEM_DA_JANELA_MS).toISOString())
        .lte("ultima_em", limite)
        .order("ultima_em", { ascending: true })
        .limit(POR_RODADA);
      for (const c of candidatas ?? []) {
        if (await responderConversa(c.id, fora ? "fora_do_horario" : "demora")) resumo.conversas++;
      }

      if (cfg.responder_comentarios) {
        const { data: comentarios } = await sb
          .from("meta_comentarios")
          .select("id, comentario_id, autor_usuario, texto")
          .eq("empresa", empresa)
          .eq("respondido", false)
          .eq("oculto", false)
          .eq("apagado", false)
          .lte("criado_em", limite)
          .gte("criado_em", new Date(Date.now() - 3 * 86_400_000).toISOString())
          .order("criado_em", { ascending: true })
          .limit(5);
        for (const c of comentarios ?? []) {
          if (await responderComentarioComIA(sb, cfg, c)) resumo.comentarios++;
        }
      }
    } catch (e) {
      resumo.erros.push(`${empresa}: ${(e as Error).message}`);
    }
  }
  return resumo;
}
