import Anthropic from "@anthropic-ai/sdk";
import type { getSupabaseServiceClient } from "@/lib/supabase/service";
import { materiaisParaPergunta } from "@/lib/aura/trechos";
import { podeChamarIA, registrarUsoIA } from "@/lib/aura/custo-ia";
import { modeloDeVolume } from "@/lib/aura/modelos";
import { EMPRESA_DO_SITE } from "./tipos";
import { CONTATO_MF, PRESENCA_VALE_MS } from "./chat";
import { dentroDoHorario, horarioEmTexto, limparHorario } from "./horario";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

/**
 * Assistente virtual do chat do site da MF.
 *
 * Pedido do Elton (26/10/2026): fora do horário, quem chama no site não fica
 * sem resposta. O assistente responde com base no material da MF que já está
 * na AURA (manual de vendas, ficha técnica, instalação e garantia, regras da
 * casa) e deixa o cliente pronto para o consultor: entende o ambiente, o
 * modelo de interesse, a cidade. Ele se apresenta como assistente virtual,
 * nunca como pessoa.
 *
 * Quando responde:
 *  - fora do horário de atendimento configurado; e, se o gestor ligar,
 *  - dentro do horário quando ninguém da equipe está com a AURA aberta.
 * Não responde se alguém da equipe falou na conversa nos últimos 30 minutos
 * (a pessoa assumiu), se a conversa foi encerrada ou se já respondeu demais.
 */

export const NOME_DO_ASSISTENTE = "Assistente virtual MF";
const MAX_RESPOSTAS_POR_CONVERSA = 20;
const EQUIPE_ASSUMIU_MS = 30 * 60 * 1000;
const ESPERA_MS = 6000;

const emAndamento = new Set<string>();

function chave() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
}

let cliente: Anthropic | null = null;
function ia() {
  const k = chave();
  if (!k) return null;
  cliente ??= new Anthropic({ apiKey: k });
  return cliente;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function responderComAssistente(sb: ClienteServico, conversaId: string): Promise<void> {
  if (!ia() || emAndamento.has(conversaId)) return;

  const { data: config } = await sb
    .from("site_chat_config")
    .select("ia_ativa, ia_sem_ninguem, horario")
    .eq("empresa", EMPRESA_DO_SITE)
    .maybeSingle();
  if (!config?.ia_ativa) return;

  const horario = limparHorario(config.horario);
  const aberto = dentroDoHorario(horario);
  if (aberto) {
    if (!config.ia_sem_ninguem) return;
    const desde = new Date(Date.now() - PRESENCA_VALE_MS).toISOString();
    const { count } = await sb
      .from("site_presenca")
      .select("profile_id", { count: "exact", head: true })
      .eq("empresa", EMPRESA_DO_SITE)
      .eq("disponivel", true)
      .gte("visto_em", desde);
    if ((count ?? 0) > 0) return;
  }

  emAndamento.add(conversaId);
  try {
    // O cliente costuma mandar duas ou três mensagens seguidas: espera um
    // pouco e responde tudo de uma vez.
    await esperar(ESPERA_MS);

    const { data: conversa } = await sb
      .from("site_conversas")
      .select("id, status, nome, cidade, empresa")
      .eq("id", conversaId)
      .maybeSingle();
    if (!conversa || conversa.status !== "aberta" || conversa.empresa !== EMPRESA_DO_SITE) return;

    const { data: mensagens } = await sb
      .from("site_mensagens")
      .select("autor, autor_nome, texto, anexo_tipo, anexo_nome, created_at")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true })
      .limit(60);
    const lista = mensagens ?? [];
    const ultima = lista[lista.length - 1];
    if (!ultima || ultima.autor !== "visitante") return;

    const equipeRecente = lista.some(
      (m) => m.autor === "equipe" && Date.now() - new Date(m.created_at).getTime() < EQUIPE_ASSUMIU_MS,
    );
    if (equipeRecente) return;
    if (lista.filter((m) => m.autor === "assistente").length >= MAX_RESPOSTAS_POR_CONVERSA) return;
    if (!(await podeChamarIA())) return;

    const falas = lista
      .filter((m) => m.autor !== "sistema")
      .slice(-24)
      .map((m) => {
        const anexo = m.anexo_tipo
          ? m.anexo_tipo.startsWith("image/")
            ? "[o cliente mandou uma foto]"
            : m.anexo_tipo.startsWith("audio/")
              ? "[o cliente mandou um áudio, que você não consegue ouvir]"
              : `[arquivo: ${m.anexo_nome ?? "documento"}]`
          : "";
        return { papel: m.autor === "visitante" ? ("user" as const) : ("assistant" as const), texto: [m.texto, anexo].filter(Boolean).join(" ") || "…" };
      });
    // A API pede que a conversa comece pelo cliente e alterne os papéis.
    const turnos: { role: "user" | "assistant"; content: string }[] = [];
    for (const f of falas) {
      const ant = turnos[turnos.length - 1];
      if (ant && ant.role === f.papel) ant.content += `\n${f.texto}`;
      else turnos.push({ role: f.papel, content: f.texto });
    }
    while (turnos.length && turnos[0].role !== "user") turnos.shift();
    if (!turnos.length) return;

    const assunto = falas.filter((f) => f.papel === "user").map((f) => f.texto).join("\n");
    const material = await materiaisParaPergunta(sb as never, EMPRESA_DO_SITE, assunto, 8).catch(() => "");
    const horarioTexto = horarioEmTexto(horario) || "horário comercial";

    const sistema = `Você é o ${NOME_DO_ASSISTENTE}, o assistente virtual do chat do site da MF International: fábrica de lareiras de alto rendimento em São Sebastião do Caí/RS, desde 1977, pioneira na tripla combustão.

SITUAÇÃO: ${aberto ? "a equipe não está disponível no chat neste momento" : "agora é FORA do horário de atendimento"}. Horário da equipe: ${horarioTexto}. Você atende até um consultor assumir; tudo o que você escrever a equipe lê na AURA.
Cliente: ${conversa.nome ?? "não informado"}${conversa.cidade ? `, de ${conversa.cidade}` : ""}.

COMO ESCREVER
- Português do Brasil, tom cordial e próximo, como um bom atendente gaúcho, tratando por "você". Mensagens curtas (no máximo 3 frases curtas), sem listas longas, sem markdown.
- Sempre termine com UMA pergunta que faça a conversa andar.
- Diga que é o assistente virtual se perguntarem, e nunca finja ser uma pessoa.
- Valor antes de preço: entenda o que o cliente precisa antes de falar de produto.

OBJETIVO: entender e anotar para o consultor: o ambiente (área em m² e pé-direito, ou volume em m³), se a lareira fica embutida, exposta, de canto, central ou dupla face, o estilo que agrada, a cidade, e se é para casa pronta ou obra. Com isso, indique os modelos MF que fazem sentido, explicando o porquê com os dados da ficha técnica.

REGRAS QUE NÃO PODEM SER QUEBRADAS
- Use somente informação dos MATERIAIS abaixo. Se não estiver lá, diga que o consultor confirma.
- NÃO informe preços, descontos, parcelamento nem condições de pagamento: o consultor manda a proposta conforme o projeto. Pode dizer que há opções para vários orçamentos.
- Garantia: "até 5 anos, conforme o modelo". Nunca diga garantia vitalícia de lareira.
- As lareiras suspensas (MF 360, MF Ottanta) giram 360° e não têm tripla combustão; não diga que têm.
- Não prometa prazo de entrega, de instalação nem visita com data. Não fale mal da concorrência.
- Não oriente instalação em móvel de madeira/MDF ou gesso comum; segurança da instalação é com o consultor e o instalador.
- Assunto sério (cheiro de gás, fumaça dentro de casa, princípio de incêndio): oriente a apagar o fogo com segurança, ventilar e ligar para os bombeiros (193).
- Se o cliente quiser falar com alguém agora, ofereça o WhatsApp ${CONTATO_MF.telefone} e diga que um consultor responde também por aqui no próximo horário.
- Se o cliente já tem lareira MF e precisa de manual, peça ou assistência, anote o modelo e o problema e diga que a equipe de pós-venda retorna.

MATERIAIS DA MF (manual de vendas, ficha técnica, instalação e garantia, regras da casa):
${material || "(sem material: seja breve, colete as informações e diga que o consultor confirma os detalhes)"}`;

    const modelo = modeloDeVolume();
    const resposta = await ia()!.messages.create({
      model: modelo,
      max_tokens: 400,
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      messages: turnos,
    });
    void registrarUsoIA({ funcao: "chat-site", modelo, uso: (resposta as any).usage, empresa: EMPRESA_DO_SITE });

    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim()
      .slice(0, 1500);
    if (!texto) return;

    // Se, enquanto pensava, alguém da equipe respondeu ou o cliente escreveu
    // de novo, esta resposta ficou velha: a próxima chamada responde.
    const { data: depois } = await sb
      .from("site_mensagens")
      .select("autor, created_at")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (depois && depois.created_at !== ultima.created_at) return;

    await sb.from("site_mensagens").insert({ conversa_id: conversaId, autor: "assistente", autor_nome: NOME_DO_ASSISTENTE, texto });
    await sb.from("site_conversas").update({ ultima_mensagem: texto.slice(0, 200), ultima_em: new Date().toISOString() }).eq("id", conversaId);
  } finally {
    emAndamento.delete(conversaId);
  }
}
