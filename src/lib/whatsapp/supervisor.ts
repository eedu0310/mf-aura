/**
 * Supervisor AURA — acompanha as conversas de WhatsApp do vendedor e:
 *  1. identifica se o contato é um lead e cria/vincula o relacionamento e a
 *     oportunidade no CRM;
 *  2. avança a oportunidade no pipeline conforme a conversa evolui
 *     (apresentação, orçamento, negociação, fechamento — nunca volta etapa);
 *  3. gera resumo, próxima ação, dicas baseadas no manual de treinamento e
 *     uma sugestão de resposta;
 *  4. avisa quando o cliente está sem resposta ou precisa de follow-up.
 */
import fs from "fs";
import { registrarUsoIA } from "@/lib/aura/custo-ia";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { modeloDeVolume } from "@/lib/aura/modelos";
import { textoDoAprendizado, blocoDeAprendizado } from "@/lib/aura/aprendizado";
import { nucleoDoManual, textoDosTrechos, trechosRelevantes } from "@/lib/aura/trechos";
import { estadoComPreposicao, origemDoTelefone } from "@/lib/ddd-estado";
import {
  ehCategoria,
  ehNatureza,
  type CategoriaContato,
  type NaturezaContato,
} from "@/lib/categoria-contato";
import {
  connectedUserIds,
  getChat,
  getChats,
  getMessages,
  onMessage,
  sendText,
  type WaMessage,
} from "./live-manager";
import { calcularAlertas, detectarEtapa, type Alerta } from "./stage-rules";
import {
  ehFechada,
  ehGanho,
  ehPerda,
  etapasVisiveis,
  nomeDaChave,
  nomesDasEtapas,
  primeiraEtapa,
  ordemDe,
  probabilidadeDe,
  type ChaveEtapa,
  type Etapa,
  type EtapaFunil,
} from "@/lib/funil";
import { carregarFunil } from "@/lib/funil-servidor";

export interface LeadInfo {
  chatJid: string;
  ehLead: boolean;
  ignorado: boolean;
  /**
   * O que o contato e para o negocio, decidido pelo vendedor:
   * 'lead' entra no pipeline, 'nao_lead' e instalador/colega/amigo e a AURA
   * nao acompanha, 'cliente' ja comprou e pertence ao pos-venda.
   * null = ninguem decidiu ainda.
   */
  natureza: NaturezaContato | null;
  /** Cliente Final, Arquiteto, Construtora... o mesmo vocabulario da carteira. */
  categoria: CategoriaContato | null;
  /** Por que nao e lead, quando for o caso. */
  motivoNatureza: string | null;
  /** O que a AURA achou que o contato e, para o vendedor so confirmar. */
  categoriaSugerida: CategoriaContato | null;
  /** A AURA achou que pode ser lead, mas não teve certeza: espera confirmação. */
  leadSugerido: boolean;
  motivoSugestao: string | null;
  etapa: Etapa | null;
  etapaPipeline: Etapa | null;
  oportunidadeId: string | null;
  relacionamentoId: string | null;
  resumo: string | null;
  proximaAcao: string | null;
  sugestaoResposta: string | null;
  interesse: string | null;
  valorEstimado: number | null;
  dicas: string[];
  alertasIa: string[];
  historico: { em: string; de: string | null; para: string; evidencia: string; fonte: string }[];
  ultimaAnaliseEm: string | null;
  analisando: boolean;
  iaDisponivel: boolean;
  aviso: string | null;
}

/**
 * Quanto a AURA espera o cliente terminar de falar antes de analisar.
 *
 * Era 20 segundos, e 20 segundos é menos do que uma pessoa leva para escrever
 * três mensagens no WhatsApp. O resultado, medido no consumo real: 80% das
 * análises aconteciam a menos de 90 segundos da anterior, e metade a menos de
 * 30. Um "oi" / "tudo bem?" / "queria saber o preço" / "da lareira a gás"
 * virava QUATRO análises completas de ~6.500 tokens cada, quando é uma
 * conversa só. A análise do WhatsApp é 84% de toda a conta da IA.
 *
 * 90 segundos pega a faixa onde estão as rajadas sem o vendedor sentir: a
 * mensagem do cliente chega na tela dele na hora de qualquer jeito — o que
 * espera é só o resumo e a dica da IA. Os alertas de "cliente esperando" e
 * "follow-up pendente" também não dependem disto: saem da varredura de 5 em
 * 5 minutos, sem IA.
 *
 * E tem um efeito colateral bom: responder no meio da rajada é pior. Com 20
 * segundos a resposta automática saía em cima do "oi", antes de a pessoa
 * dizer o que queria. Com 90, ela lê a pergunta inteira.
 *
 * Ajustável sem deploy pelo ambiente, para afinar sem mexer em código.
 */
const DEBOUNCE_MS = Math.max(
  Number(process.env.AURA_DEBOUNCE_ANALISE_MS) || 90_000,
  5_000,
);
const MANUAL_DIR = path.join(process.cwd(), "manual-treinamento");

const g = globalThis as unknown as {
  __auraSupTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __auraSupRunning?: Set<string>;
  __auraSupNotified?: Set<string>;
  __auraSupStarted?: boolean;
  __auraSupManual?: { key: string; texto: string };
  __auraSupEmpresa?: Map<string, string>;
};
const timers = (g.__auraSupTimers ??= new Map());
const running = (g.__auraSupRunning ??= new Set());
const notified = (g.__auraSupNotified ??= new Set());
const empresaCache = (g.__auraSupEmpresa ??= new Map());

// ---------------------------------------------------------------- infra

let admin: SupabaseClient | null | undefined;
function db(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return admin;
}

function aiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
}

const chaveInvalida = ((globalThis as any).__auraSupChaveInvalida ??= { key: "" }) as { key: string };

/** false se não há chave ou se a Anthropic recusou a chave atual. */
export function iaDisponivel() {
  const key = aiKey();
  return !!key && chaveInvalida.key !== key;
}

let anthropic: Anthropic | null = null;
let anthropicKey = "";
function ai(): Anthropic | null {
  const key = aiKey();
  if (!key || chaveInvalida.key === key) return null;
  if (!anthropic || anthropicKey !== key) {
    anthropic = new Anthropic({ apiKey: key });
    anthropicKey = key;
  }
  return anthropic;
}

/** Lê todos os .md/.txt da pasta manual-treinamento (recarrega se mudar). */
export function lerManual(): string {
  try {
    const arquivos = fs
      .readdirSync(MANUAL_DIR)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .sort();
    const key = arquivos
      .map((f) => `${f}:${fs.statSync(path.join(MANUAL_DIR, f)).mtimeMs}`)
      .join("|");
    if (g.__auraSupManual?.key === key) return g.__auraSupManual.texto;
    const texto = arquivos
      .map((f) => `### ${f}\n${fs.readFileSync(path.join(MANUAL_DIR, f), "utf8")}`)
      .join("\n\n")
      .slice(0, 60_000);
    g.__auraSupManual = { key, texto };
    return texto;
  } catch {
    return "";
  }
}

/**
 * A loja de quem está atendendo.
 *
 * O padrão era "LF Lareiras" escrito à mão. Perfil sem empresa — conta recém
 * criada, cadastro incompleto — fazia TODO lead e TODO negócio daquela pessoa
 * nascer na LF: na loja errada, fora da vista de quem devia atender, e
 * somando no faturamento de outra operação. Um erro silencioso que só
 * apareceria na reunião de fechamento do mês.
 *
 * Agora, sem empresa, devolve vazio e quem chama decide o que fazer. É pior
 * falhar visível do que gravar certo-por-acaso na loja de alguém.
 *
 * O cache só guarda loja de verdade: cachear o vazio prenderia a pessoa no
 * limbo até o servidor reiniciar, mesmo depois de o gestor completar o
 * cadastro dela.
 */
async function empresaDo(userId: string): Promise<string> {
  const cached = empresaCache.get(userId);
  if (cached) return cached;
  const { data } = (await db()?.from("profiles").select("empresa").eq("id", userId).maybeSingle()) ?? {};
  const empresa = ((data?.empresa as string) ?? "").trim();
  if (!empresa) {
    console.error(`[supervisor] usuário ${userId} está sem loja no perfil; não vou adivinhar.`);
    return "";
  }
  empresaCache.set(userId, empresa);
  return empresa;
}

function variantesTelefone(phone: string): string[] {
  const d = phone.replace(/\D/g, "");
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return [];
  const local = d.slice(2);
  const out = new Set([local]);
  if (local.length === 10) out.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  if (local.length === 11 && local[2] === "9") out.add(`${local.slice(0, 2)}${local.slice(3)}`);
  return [...out];
}

function formatarTelefone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

// ---------------------------------------------------------------- IA

interface AnaliseIa {
  e_lead: boolean;
  /** O que a IA achou que o contato e. O vendedor confirma; ela nao decide. */
  categoria_sugerida: CategoriaContato | null;
  /** Quando nao e lead: instalador, fornecedor, colega... serve de etiqueta. */
  tipo_nao_lead: string | null;
  etapa: Etapa | null;
  confianca: number;
  evidencia: string;
  resumo: string;
  interesse: string | null;
  valor_estimado: number | null;
  proxima_acao: string;
  sugestao_resposta: string;
  dicas: string[];
  alertas: string[];
}

/**
 * Como cada mensagem chega para a IA.
 *
 * NÃO usa o previewOf da tela. Lá, "🎤 Áudio" é um rótulo bonito para o
 * vendedor, que vai ouvir o áudio. Aqui era uma armadilha: a IA lia
 *
 *     CLIENTE: 🎤 Áudio
 *     VENDEDOR: 📄 Catálogo.pdf
 *
 * e concluía que o vendedor mandou catálogo sem perguntar nada — quando o
 * pedido do cliente estava dentro do áudio, que ela não ouve. Um vendedor da
 * A&G foi cobrado exatamente assim por um atendimento que ele fez certo.
 *
 * A marcação agora é explícita na própria transcrição, e não só numa regra
 * distante do prompt: a IA vê, na linha, que ali existe conteúdo que ela não
 * tem. Dezessete por cento das conversas da semana passam por isso.
 */
function conteudoParaIa(m: WaMessage): string {
  switch (m.type) {
    case "audio":
      return "🎤 [ÁUDIO NÃO TRANSCRITO — o que foi dito aqui você NÃO tem acesso]";
    case "image":
      return m.text
        ? `📷 [FOTO que você não vê] com legenda: ${m.text}`
        : "📷 [FOTO SEM LEGENDA — você NÃO vê a imagem]";
    case "video":
      return m.text
        ? `🎥 [VÍDEO que você não vê] com legenda: ${m.text}`
        : "🎥 [VÍDEO — você NÃO vê o conteúdo]";
    case "document":
      return `📄 [documento enviado: ${m.fileName ?? "sem nome"}]`;
    case "sticker":
      return "(figurinha)";
    default:
      return m.text || "(mensagem vazia)";
  }
}

function transcricao(msgs: WaMessage[], nomeCliente: string) {
  return msgs
    .slice(-50)
    .map((m) => {
      const quando = new Date(m.timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const quem = m.fromMe ? "VENDEDOR" : `CLIENTE (${nomeCliente})`;
      return `[${quando}] ${quem}: ${conteudoParaIa(m)}`;
    })
    .join("\n");
}

const FERRAMENTA_ANALISE = {
  name: "analise",
  description: "Entrega a análise da conversa de WhatsApp.",
  input_schema: {
    type: "object" as const,
    properties: {
      e_lead: { type: "boolean" },
      categoria_sugerida: {
        type: ["string", "null"],
        enum: [
          "Cliente Final",
          "Arquiteto",
          "Construtora",
          "Revendedor",
          "Engenheiro",
          "Designer de Interiores",
          "Consultor",
          "Obra",
          "Distribuidor",
          "Outro",
          null,
        ],
      },
      tipo_nao_lead: { type: ["string", "null"] },
      /*
       * Sem lista fixa aqui: as etapas são as da loja, e vão escritas no
       * prompt. O que a IA devolver é conferido contra o funil depois, em
       * nomesDasEtapas() — uma etapa inventada vira null em vez de entrar.
       */
      etapa: { type: ["string", "null"] },
      confianca: { type: "number" },
      evidencia: { type: "string" },
      resumo: { type: "string" },
      interesse: { type: ["string", "null"] },
      valor_estimado: { type: ["number", "null"] },
      proxima_acao: { type: "string" },
      sugestao_resposta: { type: "string" },
      dicas: { type: "array", items: { type: "string" }, maxItems: 3 },
      alertas: { type: "array", items: { type: "string" }, maxItems: 4 },
    },
    required: ["e_lead", "etapa", "confianca", "resumo", "proxima_acao", "sugestao_resposta", "dicas", "alertas"],
  },
};

const cacheMateriais = ((globalThis as any).__auraSupMateriais ??= new Map<string, { at: number; texto: string }>()) as Map<string, { at: number; texto: string }>;

/**
 * Onde a loja atende presencialmente e o que oferecer a quem está longe.
 *
 * O gestor escreve os dois textos; é o texto dele que entra no prompt. Sem
 * isto a AURA convidava cliente de São Paulo para conhecer o showroom.
 */
interface ConfigAtendimento {
  estados: string[];
  presencial: string | null;
  remoto: string | null;
  /** Mandar a primeira resposta sozinha para quem está fora dos estados atendidos. */
  automatico: boolean;
  /** A mensagem que o CLIENTE lê. Aceita {nome}, {estado} e {loja}. */
  textoAutomatico: string | null;
  horaInicio: number | null;
  horaFim: number | null;
}

const cacheAtendimento = ((globalThis as any).__auraAtendimento ??= new Map<
  string,
  { at: number; cfg: ConfigAtendimento }
>()) as Map<string, { at: number; cfg: ConfigAtendimento }>;

async function configDeAtendimento(empresa: string) {
  const hit = cacheAtendimento.get(empresa);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.cfg;
  let cfg: ConfigAtendimento = {
    estados: ["RS"],
    presencial: null as string | null,
    remoto: null as string | null,
    automatico: false,
    textoAutomatico: null as string | null,
    horaInicio: null as number | null,
    horaFim: null as number | null,
  };
  try {
    const { data } = (await db()
      ?.from("config_atendimento")
      .select(
        "estados_presenciais, texto_presencial, texto_remoto, envio_automatico, texto_automatico, auto_hora_inicio, auto_hora_fim",
      )
      .eq("empresa", empresa)
      .maybeSingle()) ?? { data: null };
    if (data) {
      cfg = {
        estados: Array.isArray(data.estados_presenciais) && data.estados_presenciais.length
          ? data.estados_presenciais
          : ["RS"],
        presencial: (data.texto_presencial as string | null) ?? null,
        remoto: (data.texto_remoto as string | null) ?? null,
        automatico: data.envio_automatico === true,
        textoAutomatico: (data.texto_automatico as string | null) ?? null,
        horaInicio: data.auto_hora_inicio === null ? null : Number(data.auto_hora_inicio),
        horaFim: data.auto_hora_fim === null ? null : Number(data.auto_hora_fim),
      };
    }
  } catch {
    /* sem config, segue com o padrão */
  }
  cacheAtendimento.set(empresa, { at: Date.now(), cfg });
  return cfg;
}

/**
 * O bloco que diz à IA de onde o contato é e o que ela pode oferecer.
 *
 * Vai na parte VARIÁVEL do prompt, depois do corte do cache: muda a cada
 * contato, então cacheá-lo invalidaria o cache a cada conversa.
 */
async function blocoDeAtendimento(empresa: string, telefone: string | null): Promise<string> {
  const cfg = await configDeAtendimento(empresa);
  const o = origemDoTelefone(telefone);

  // Sem saber de onde é, não se tira a opção do vendedor: ele pergunta.
  if (!o.uf && !o.exterior) return "";

  const perto = !!o.uf && cfg.estados.map((e) => e.toUpperCase()).includes(o.uf);
  const onde = o.exterior ? "fora do Brasil" : `${o.estado} (DDD ${o.ddd})`;

  if (perto) {
    return cfg.presencial
      ? `ONDE ESTE CLIENTE ESTÁ: ${onde}, dentro da região que a loja atende pessoalmente.\n${cfg.presencial}`
      : "";
  }

  return (
    `ONDE ESTE CLIENTE ESTÁ: ${onde}. A loja atende pessoalmente em: ${cfg.estados.join(", ")}.\n` +
    `Ele está LONGE. Não convide para o showroom, não marque visita e não fale em "passar na loja" — ` +
    `é um convite impossível, e o cliente percebe que do outro lado ninguém leu o que ele escreveu.\n` +
    (cfg.remoto ?? "Ofereça atendimento a distância: videochamada, fotos e vídeos dos produtos, e envio.")
  );
}

/** Manuais e playbooks que o gestor enviou pelo painel (+ pasta manual-treinamento). */
async function materiaisDaEmpresa(empresa: string): Promise<string> {
  const hit = cacheMateriais.get(empresa);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.texto;
  let texto = "";
  try {
    const { data } = (await db()
      ?.from("aura_materiais")
      .select("titulo, descricao, texto")
      .eq("empresa", empresa)
      .eq("ativo", true)
      .order("criado_em", { ascending: true })) ?? { data: null };
    texto = (data ?? [])
      .map((m: any) => `### ${m.titulo}${m.descricao ? ` — ${m.descricao}` : ""}\n${m.texto}`)
      .join("\n\n");
  } catch {
    texto = "";
  }
  if (!texto) texto = lerManual();
  if (texto.length > 40000) texto = `${texto.slice(0, 40000)}\n\n[...material cortado por tamanho...]`;
  cacheMateriais.set(empresa, { at: Date.now(), texto });
  return texto;
}

/**
 * As etapas da loja, descritas para a IA.
 *
 * O texto de cada uma vem do PAPEL (a chave), não do nome: assim o gestor
 * renomeia "Proposta" para "Follow-up" e a IA continua sabendo que ali é
 * "o vendedor já enviou o orçamento". Etapa criada pelo gestor, que não tem
 * papel conhecido, entra na lista só pelo nome — a IA passa a conhecê-la, mas
 * sem instrução do que ela significa, o que é melhor do que inventar uma.
 */
const EXPLICACAO_DA_CHAVE: Record<ChaveEtapa, string> = {
  prospeccao: "cliente demonstrou interesse, vendedor ainda qualificando.",
  qualificacao: "vendedor está levantando a necessidade, o ambiente, o prazo e quem decide.",
  apresentacao: "vendedor mostrou produtos (fotos, vídeos, catálogo) ou agendou visita/showroom/medição.",
  followup: "vendedor ENVIOU orçamento/proposta/valor (não basta o cliente pedir) e está acompanhando.",
  negociacao: "depois da proposta, discutem desconto, parcelamento, condições, concorrência.",
  fechamento: "cliente confirmou a compra, pagou, mandou comprovante ou pedido confirmado.",
  posvenda: "já comprou: entrega, instalação, acompanhamento.",
  perda: "cliente desistiu claramente ou comprou em outro lugar.",
};

function descricaoDasEtapas(funil: EtapaFunil[]): string {
  return etapasVisiveis(funil)
    .map((e) => `- ${e.nome}${e.chave ? `: ${EXPLICACAO_DA_CHAVE[e.chave]}` : ""}`)
    .join("\n");
}

async function analisarComIa(
  msgs: WaMessage[],
  nomeCliente: string,
  etapaAtual: Etapa | null,
  alertas: Alerta[],
  funil: EtapaFunil[],
  materiais?: string,
  aprendizado?: string,
  /**
   * Trechos do manual escolhidos POR ESTA conversa. Viajam depois do ponto de
   * corte do cache, porque mudam a cada análise - o que vem antes é idêntico
   * e por isso é relido a 10% do preço.
   */
  trechos?: string,
  /** De onde o cliente é e o que pode ser oferecido a ele. Também variável. */
  atendimento?: string,
  /**
   * A loja, só para o registro de consumo. Sem ela, as quase quatro mil
   * chamadas do supervisor ficavam todas com empresa nula e o painel de custo
   * não sabia dizer qual operação gasta o quê — e é esta função que faz 84%
   * da conta.
   */
  empresaDoUso?: string,
): Promise<AnaliseIa | null> {
  const client = ai();
  if (!client) return null;

  const manual = materiais ?? lerManual();
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const system = `Você é o Supervisor AURA, um gerente comercial experiente que acompanha em tempo real as conversas de WhatsApp dos vendedores de uma empresa de lareiras, churrasqueiras e aquecimento. Seu objetivo: nenhum lead perdido, atendimento rápido, follow-up em dia e mais vendas.

O QUE VOCÊ NÃO VÊ (leia antes de apontar qualquer erro do vendedor):
Áudio, foto e vídeo chegam para você marcados entre colchetes, SEM o conteúdo.
Você não ouve áudio e não vê imagem. Então:
- NUNCA conclua que o vendedor pulou uma etapa, deixou de perguntar algo ou
  respondeu sem entender quando existe áudio ou foto do cliente logo antes.
  O pedido, a medida ou a dúvida provavelmente estavam ali.
- O caso mais comum: o cliente manda áudio pedindo o catálogo e o vendedor
  envia. Na sua transcrição isso parece "mandou catálogo sem diagnosticar".
  NÃO é. Não escreva esse apontamento quando houver áudio do cliente antes.
- Quando a falta de conteúdo atrapalhar sua leitura, aponte a LACUNA, não a
  pessoa: "há áudios não transcritos nesta conversa; confirme por escrito o
  que foi combinado". Isso ajuda; acusar o vendedor de algo que ele fez
  destrói a confiança dele no sistema.
- Erro só vale como erro se estiver VISÍVEL no texto que você recebeu.

REGRA DE OURO SOBRE "e_lead": na dúvida, diga que NÃO tem certeza em vez de
chutar que sim. O campo "confianca" é levado a sério: abaixo de 0,75 o
sistema não cria nada e apenas pergunta ao vendedor. Criar lead errado suja
a carteira da pessoa e faz ela perder confiança no sistema — é pior do que
perguntar. Use confiança alta só quando a conversa fala claramente de
produto, preço, medida, prazo, instalação ou orçamento do nosso ramo.

QUEM NÃO É LEAD, mesmo falando do nosso produto o tempo todo. Estes são os
erros que mais aparecem na prática, e todos devem ter "e_lead": false:
- INSTALADOR e equipe de instalação: combina data, endereço, medida, peça que
  faltou, foto da obra pronta. Fala de produto porque é o trabalho dele —
  não está comprando. Sinais: "tô na obra", "o cliente pediu", "vou passar lá
  amanhã", "faltou a peça", manda foto de serviço executado.
- COLEGA DE EQUIPE, GESTOR ou CHEFE: fala de meta, cliente de terceiro,
  escala, preço de custo, comissão. Trata o vendedor como colega, não como
  fornecedor.
- FORNECEDOR e transportadora: nota fiscal, prazo de entrega PARA NÓS, frete,
  pedido de compra nosso.
- AMIGO e FAMÍLIA, mesmo que puxem assunto de lareira.
- SUPORTE a quem já comprou: a peça não acende, veio torta, quer manutenção.
  É pós-venda, não venda nova. Use "tipo_nao_lead": "Suporte técnico".
Quando "e_lead" for false, preencha "tipo_nao_lead" com o que o contato é
(Instalador, Fornecedor, Colega de equipe, Gestor ou chefe, Amigo ou família,
Suporte técnico, Outro assunto). É isso que o vendedor vê na etiqueta.

CATEGORIA: quando for lead, diga em "categoria_sugerida" o que o contato é no
mercado, pela forma de falar. Arquiteto, designer e consultor falam de
projeto, cliente dele, especificação, planta, acabamento, RT. Construtora e
obra falam de várias unidades, cronograma, engenheiro, medição. Revendedor e
distribuidor pedem tabela, margem, condição para revenda. Quem fala da casa
dele, da lareira dele, é "Cliente Final". Sem sinal claro, devolva null — o
vendedor escolhe.

Use o MANUAL DE TREINAMENTO abaixo como a regra da casa. Suas dicas devem aplicar o manual ao caso concreto, citando o que o cliente disse.

ETAPAS DO PIPELINE DESTA LOJA (em ordem):
${descricaoDasEtapas(funil)}

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato:
{
  "e_lead": boolean,            // é uma conversa comercial com cliente/potencial cliente? (false para instalador, colega de equipe, gestor, fornecedor, família, amigos, spam, suporte de quem já comprou, ou qualquer assunto fora de lareira/churrasqueira/aquecimento)
  "categoria_sugerida": "Cliente Final"|"Arquiteto"|"Construtora"|"Revendedor"|"Engenheiro"|"Designer de Interiores"|"Consultor"|"Obra"|"Distribuidor"|"Outro"|null,
  "tipo_nao_lead": "o que o contato é, quando e_lead for false, ou null",
  "etapa": ${nomesDasEtapas(funil).map((n) => JSON.stringify(n)).join("|")}|null,
  "confianca": número de 0 a 1,
  "evidencia": "trecho curto da conversa que justifica a etapa",
  "resumo": "2 a 3 frases: quem é o cliente, o que quer, em que pé está",
  "interesse": "produto/necessidade em poucas palavras ou null",
  "valor_estimado": número em reais ou null,
  "proxima_acao": "a ação mais importante que o vendedor deve fazer AGORA, específica",
  "sugestao_resposta": "mensagem pronta, curta e natural, que o vendedor pode enviar agora ao cliente (ou \\"\\" se não for o caso). Se houver um bloco ONDE ESTE CLIENTE ESTÁ, obedeça-o: não convide para o showroom quem está longe.",
  "dicas": ["até 3 dicas práticas baseadas no manual"],
  "alertas": ["riscos de perder este lead, se houver"]
}

REGRAS DA CASA (valem em toda conversa):
${manual || "(nenhum manual cadastrado — use boas práticas de venda consultiva)"}${blocoDeAprendizado(aprendizado ?? "")}`;

  /**
   * A parte do prompt que muda a cada conversa: o pedaço do manual que tem a
   * ver com o que está sendo falado agora.
   *
   * Fica DEPOIS do bloco cacheado de propósito. O cache da Anthropic funciona
   * por prefixo: tudo até o ponto de corte é relido a 10% do preço, e o que
   * vem depois é cobrado cheio. Com o manual inteiro no prefixo e só o trecho
   * variável no fim, a conta cai sem a IA perder contexto.
   */
  const partes: string[] = [];
  if (atendimento) partes.push(atendimento);
  if (trechos) {
    partes.push(
      `TRECHOS DO MANUAL PARA ESTE CASO (use-os nas dicas, citando o que o cliente disse):\n${trechos}`,
    );
  }
  const variavel = partes.join("\n\n");

  const user = `Agora: ${agora}
Etapa atual no pipeline: ${etapaAtual ?? "sem oportunidade ainda"}
Alertas automáticos: ${alertas.map((a) => a.texto).join("; ") || "nenhum"}

CONVERSA (mais recentes por último):
${transcricao(msgs, nomeCliente)}`;

  const resp = await client.messages.create({
    model: modeloDeVolume(),
    max_tokens: 1500,
    // O prompt do sistema é IDÊNTICO em toda análise da mesma loja: as regras,
    // o manual e o aprendizado só mudam quando o gestor mexe neles. Marcado
    // como cacheável, a Anthropic cobra 10% pela releitura em vez do preço
    // cheio — e isto roda centenas de vezes por dia.
    //
    // TTL de 1 hora, não os 5 minutos padrão: com as análises espalhadas ao
    // longo do dia, um cache de 5 min expiraria entre boa parte das chamadas e
    // a gente pagaria escrita atrás de escrita. A escrita de 1h custa 2x, mas
    // todas as leituras da hora seguinte custam 0,1x.
    system: [
      {
        type: "text" as const,
        text: system,
        cache_control: { type: "ephemeral" as const, ttl: "1h" as const },
      },
      // Depois do corte do cache: muda a cada conversa, então não é cacheável.
      {
        type: "text" as const,
        text: `${variavel}${variavel ? "\n\n" : ""}Entregue a análise chamando a ferramenta "analise".`,
      },
    ],
    messages: [{ role: "user", content: user }],
    tools: [FERRAMENTA_ANALISE],
    tool_choice: { type: "tool", name: "analise" },
  });
  void registrarUsoIA({
    funcao: "whatsapp",
    modelo: modeloDeVolume(),
    uso: (resp as any).usage,
    empresa: empresaDoUso ?? null,
  });

  const bloco = resp.content.find((b: any) => b.type === "tool_use") as any;
  let r: any = bloco?.input;
  if (!r) {
    const texto = resp.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    r = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  }
  return {
    e_lead: !!r.e_lead,
    categoria_sugerida: ehCategoria(r.categoria_sugerida) ? r.categoria_sugerida : null,
    tipo_nao_lead: r.tipo_nao_lead ? String(r.tipo_nao_lead).slice(0, 60) : null,
    // A IA só pode devolver etapa que existe NESTA loja. Antes ela era
    // conferida contra a lista fixa do código, que agora pode nem ser a da loja.
    etapa: nomesDasEtapas(funil).includes(r.etapa) ? r.etapa : null,
    confianca: Number(r.confianca) || 0,
    evidencia: String(r.evidencia ?? ""),
    resumo: String(r.resumo ?? ""),
    interesse: r.interesse ? String(r.interesse) : null,
    valor_estimado: Number(r.valor_estimado) > 0 ? Number(r.valor_estimado) : null,
    proxima_acao: String(r.proxima_acao ?? ""),
    sugestao_resposta: String(r.sugestao_resposta ?? ""),
    dicas: Array.isArray(r.dicas) ? r.dicas.map(String).slice(0, 4) : [],
    alertas: Array.isArray(r.alertas) ? r.alertas.map(String).slice(0, 4) : [],
  };
}

// ---------------------------------------------------------------- CRM

/**
 * Registra o contato novo do WhatsApp também na fila de leads.
 *
 * Sem isso, quem chega pelo WhatsApp do vendedor ficava fora do painel de
 * leads do gestor e fora do controle de tempo de resposta — só aparecia se
 * tivesse vindo pelo site. O lead já nasce com o vendedor que recebeu a
 * mensagem, então não é redistribuído.
 */
async function registrarLeadWhatsApp(
  sb: SupabaseClient,
  dados: {
    empresa: string;
    vendedorId: string;
    relacionamentoId: string;
    nome: string;
    telefone: string;
    mensagem: string | null;
  },
) {
  try {
    const variantes = variantesTelefone(dados.telefone);
    if (variantes.length) {
      const { data: jaTem } = await sb
        .from("leads_recebidos")
        .select("id")
        .eq("empresa", dados.empresa)
        .in("telefone", [dados.telefone, ...variantes])
        .not("status", "in", "(perdido,respondido)")
        .limit(1);
      if (jaTem && jaTem.length) return;
    }

    const prazo = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await sb.from("leads_recebidos").insert({
      empresa: dados.empresa,
      nome: dados.nome || null,
      telefone: dados.telefone,
      mensagem_inicial: dados.mensagem?.slice(0, 500) ?? null,
      origem: "WhatsApp",
      status: "repassado_vendedor",
      vendedor_id: dados.vendedorId,
      relacionamento_id: dados.relacionamentoId,
      prazo_resposta: prazo,
    });
    if (error) console.error("[supervisor] registrar lead do WhatsApp:", error.message);
  } catch (e: any) {
    console.error("[supervisor] registrar lead do WhatsApp:", e?.message ?? e);
  }
}

/**
 * Quando o vendedor responde pelo WhatsApp, o lead correspondente é fechado.
 * É isso que zera o alerta de "lead sem resposta" para o gestor e faz o
 * negócio entrar no pipeline.
 */
export async function marcarLeadRespondidoPorTelefone(
  sb: SupabaseClient,
  empresa: string,
  telefone: string,
  userId: string,
) {
  try {
    const variantes = variantesTelefone(telefone);
    if (!variantes.length) return;
    await sb
      .from("leads_recebidos")
      .update({ status: "respondido", respondido_em: new Date().toISOString(), respondido_por: userId })
      .eq("empresa", empresa)
      .in("telefone", [telefone, ...variantes])
      .not("status", "in", "(respondido,perdido)");
  } catch (e: any) {
    console.error("[supervisor] fechar lead respondido:", e?.message ?? e);
  }
}

async function garantirRelacionamento(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  nome: string,
  phone: string,
  /**
   * A categoria que o vendedor marcou na etiqueta do WhatsApp. Vai junto para
   * a carteira em vez de todo contato nascer "Cliente Final" e alguem ter de
   * corrigir depois, um por um.
   */
  categoria: CategoriaContato | null = null,
): Promise<{ id: string | null; aviso: string | null }> {
  const variantes = variantesTelefone(phone);
  if (variantes.length) {
    const { data } = await sb
      .from("relacionamentos")
      .select("id, owner_id, nome")
      .eq("empresa", empresa)
      .in("telefone_normalizado", variantes)
      .limit(5);
    const meu = data?.find((r) => r.owner_id === userId);
    if (meu) return { id: meu.id, aviso: null };
    if (data && data.length > 0) {
      return { id: null, aviso: "Este contato já está na carteira de outro vendedor — fale com seu gestor." };
    }
  }
  const { data, error } = await sb
    .from("relacionamentos")
    .insert({
      owner_id: userId,
      empresa,
      nome: nome || formatarTelefone(phone),
      categoria: categoria ?? "Cliente Final",
      telefone: variantes.length ? formatarTelefone(phone) : null,
      temperatura: "quente",
      origem: "WhatsApp",
      observacao: "Criado automaticamente pelo Supervisor AURA a partir de uma conversa no WhatsApp.",
      ultimo_contato_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[supervisor] criar relacionamento:", error.message);
    return { id: null, aviso: "Não consegui cadastrar o contato no CRM." };
  }

  // Contato novo entra também na fila de leads, para o gestor acompanhar.
  await registrarLeadWhatsApp(sb, {
    empresa,
    vendedorId: userId,
    relacionamentoId: data.id,
    nome: nome || "",
    telefone: phone,
    mensagem: null,
  });

  return { id: data.id, aviso: null };
}

/**
 * O negócio como esta parte do supervisor precisa dele. O tipo tem nome porque
 * os quatro caminhos de busca devolvem a mesma coisa e, escrito à mão em cada
 * um, o parceiro do atendimento em dupla ficaria de fora de algum deles sem o
 * compilador reclamar.
 */
type NegocioDaConversa = {
  id: string;
  etapa: Etapa;
  valor: number;
  cliente: string;
  parceiro_id: string | null;
  percentual_parceiro: number | null;
};

async function garantirOportunidade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  relacionamentoId: string,
  cliente: string,
  interesse: string | null,
  valor: number | null,
  oportunidadeId: string | null,
  funil: EtapaFunil[],
) {
  // "Negócio ainda em aberto" = toda etapa que não é de ganho nem de perda,
  // segundo o funil DESTA loja. Era uma lista fixa escrita na consulta.
  const fechadas = nomesDasEtapas(funil).filter((n) => ehFechada(n, funil));
  const listaFechadas = `(${fechadas.map((n) => `"${n}"`).join(",")})`;
  if (oportunidadeId) {
    const { data } = await sb.from("oportunidades").select("id, etapa, valor, cliente, parceiro_id, percentual_parceiro").eq("id", oportunidadeId).maybeSingle();
    if (data) return data as NegocioDaConversa;
  }
  const { data: aberta } = await sb
    .from("oportunidades")
    .select("id, etapa, valor, cliente, parceiro_id, percentual_parceiro")
    .eq("relacionamento_id", relacionamentoId)
    .not("etapa", "in", listaFechadas)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aberta) return aberta as NegocioDaConversa;

  // Sem negocio aberto, o padrao e criar um — e assim que o cliente que volta
  // depois de meses ganha a venda nova dele. Mas so existe um card fechado
  // porque a busca acima ignora Fechados e Perdidos, entao cada nova analise
  // criava OUTRO card para a mesma pessoa: "Tiago nunes" acumulou tres em
  // tres minutos, cada um contando como fechamento do mes. Negocio fechado
  // hoje e o mesmo negocio; recompra de verdade acontece noutro dia.
  const inicioDeHoje = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T00:00:00-03:00`).toISOString();
  const { data: deHoje } = await sb
    .from("oportunidades")
    .select("id, etapa, valor, cliente, parceiro_id, percentual_parceiro")
    .eq("relacionamento_id", relacionamentoId)
    .gte("created_at", inicioDeHoje)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deHoje) return deHoje as NegocioDaConversa;

  const { data, error } = await sb
    .from("oportunidades")
    .insert({
      owner_id: userId,
      empresa,
      cliente,
      produto: interesse,
      valor: valor ?? 0,
      // A primeira etapa é a do funil DESTA loja. Estava escrita à mão
      // ("Prospecção"): numa loja que renomeasse a etapa, o negócio nasceria
      // numa coluna que não existe e o card não apareceria no quadro.
      etapa: primeiraEtapa(funil),
      probabilidade: probabilidadeDe(primeiraEtapa(funil), funil),
      relacionamento_id: relacionamentoId,
      descricao: "Oportunidade criada automaticamente pelo Supervisor AURA (WhatsApp).",
    })
    .select("id, etapa, valor, cliente, parceiro_id, percentual_parceiro")
    .single();
  if (error) {
    console.error("[supervisor] criar oportunidade:", error.message);
    return null;
  }
  await registrarAtividade(sb, userId, empresa, relacionamentoId, cliente, `Oportunidade criada pela IA: ${cliente}`, interesse ?? "Lead vindo do WhatsApp", { oportunidade_id: data.id });
  return data as NegocioDaConversa;
}

async function registrarAtividade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  relacionamentoId: string | null,
  cliente: string,
  titulo: string,
  contexto: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await sb.from("atividades").insert({
    owner_id: userId,
    empresa,
    tipo: "WhatsApp",
    titulo,
    contexto,
    relacionamento_id: relacionamentoId,
    cliente_nome: cliente,
    origem: "whatsapp_ia",
    ocorrida_em: new Date().toISOString(),
    metadata: { ...metadata, fonte: "supervisor_aura" },
  });
  if (error) console.error("[supervisor] atividade:", error.message);
}

async function notificar(sb: SupabaseClient, userId: string, titulo: string, mensagem: string, acaoUrl = "/whatsapp") {
  const { error } = await sb.from("notificacoes").insert({
    vendedor_id: userId,
    titulo,
    mensagem,
    tipo: "ia",
    lida: false,
    acao_url: acaoUrl,
    criada_em: new Date().toISOString(),
  });
  if (error) console.error("[supervisor] notificação:", error.message);
}

async function moverOportunidade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  op: NegocioDaConversa,
  para: Etapa,
  evidencia: string,
  relacionamentoId: string | null,
  valorEstimado: number | null,
  funil: EtapaFunil[],
) {
  const patch: Record<string, unknown> = {
    etapa: para,
    probabilidade: probabilidadeDe(para, funil),
    dias_parado: 0,
    updated_at: new Date().toISOString(),
  };
  if ((!op.valor || Number(op.valor) === 0) && valorEstimado) patch.valor = valorEstimado;
  const { error } = await sb.from("oportunidades").update(patch).eq("id", op.id);
  if (error) {
    console.error("[supervisor] mover oportunidade:", error.message);
    return false;
  }

  await registrarAtividade(
    sb,
    userId,
    empresa,
    relacionamentoId,
    op.cliente,
    `IA moveu no pipeline: ${op.etapa} → ${para}`,
    evidencia,
    { oportunidade_id: op.id, de: op.etapa, para },
  );

  if (ehGanho(para, funil)) {
    const { data: jaTem } = await sb.from("vendas").select("id").eq("oportunidade_id", op.id).limit(1);
    if (!jaTem?.length) {
      const valor = Number(patch.valor ?? op.valor) || 0;
      // Atendimento em dupla: a dupla combinada no negócio viaja para a
      // venda. Parceiro igual ao dono é descartado — a mesma pessoa não
      // recebe duas fatias.
      const parceiro =
        op.parceiro_id && op.parceiro_id !== userId ? op.parceiro_id : null;
      const { error: vErr } = await sb.from("vendas").insert({
        owner_id: userId,
        empresa,
        cliente: op.cliente,
        valor,
        data: new Date().toISOString().slice(0, 10),
        relacionamento_id: relacionamentoId,
        oportunidade_id: op.id,
        valor_original: valor,
        valor_fechado: valor,
        forma_pagamento: "Não informado",
        quantidade_parcelas: 1,
        status: "aguardando_detalhes",
        origem: "WhatsApp",
        parceiro_id: parceiro,
        percentual_parceiro: parceiro ? (op.percentual_parceiro ?? 50) : 0,
      });
      if (vErr) console.error("[supervisor] venda:", vErr.message);
    }
    await notificar(
      sb,
      userId,
      "🎉 Venda identificada pela IA",
      `${op.cliente}: negócio marcado como fechado. Complete os detalhes da venda (valor, pagamento).`,
      "/vendas",
    );
    // O parceiro é avisado do fechamento que ele também trabalhou.
    if (op.parceiro_id && op.parceiro_id !== userId) {
      await notificar(
        sb,
        op.parceiro_id,
        "🎉 Venda da dupla fechada",
        `${op.cliente}: o negócio que vocês atenderam juntos foi fechado. Confira a divisão na tela de Vendas.`,
        "/vendas",
      );
    }
  } else {
    await notificar(sb, userId, "🤖 Lead avançou no pipeline", `${op.cliente}: ${op.etapa} → ${para}. ${evidencia}`.slice(0, 280), "/pipeline");
  }
  if (relacionamentoId) {
    await sb
      .from("relacionamentos")
      .update({ temperatura: "quente", ultimo_contato_em: new Date().toISOString() })
      .eq("id", relacionamentoId);
  }
  return true;
}

// ---------------------------------------------------------------- análise

function linhaParaLead(row: any, extra: Partial<LeadInfo> = {}): LeadInfo {
  return {
    chatJid: row?.chat_jid ?? "",
    ehLead: !!row?.oportunidade_id || !!row?.relacionamento_id,
    leadSugerido: !!row?.lead_sugerido,
    motivoSugestao: (row?.motivo_sugestao as string | null) ?? null,
    ignorado: !!row?.ignorado,
    natureza: ehNatureza(row?.natureza) ? row.natureza : null,
    categoria: ehCategoria(row?.categoria) ? row.categoria : null,
    motivoNatureza: (row?.motivo_natureza as string | null) ?? null,
    categoriaSugerida: ehCategoria(row?.categoria_sugerida) ? row.categoria_sugerida : null,
    etapa: row?.etapa ?? null,
    etapaPipeline: null,
    oportunidadeId: row?.oportunidade_id ?? null,
    relacionamentoId: row?.relacionamento_id ?? null,
    resumo: row?.resumo ?? null,
    proximaAcao: row?.proxima_acao ?? null,
    sugestaoResposta: null,
    interesse: row?.interesse ?? null,
    valorEstimado: row?.valor_estimado != null ? Number(row.valor_estimado) : null,
    dicas: Array.isArray(row?.dicas) ? row.dicas : [],
    alertasIa: Array.isArray(row?.alertas) ? row.alertas : [],
    historico: Array.isArray(row?.historico) ? row.historico : [],
    ultimaAnaliseEm: row?.ultima_analise_em ?? null,
    analisando: false,
    iaDisponivel: iaDisponivel(),
    aviso: null,
    ...extra,
  };
}

const sugestoes = ((globalThis as any).__auraSupSugestoes ??= new Map<string, string>()) as Map<string, string>;
const avisos = ((globalThis as any).__auraSupAvisos ??= new Map<string, string>()) as Map<string, string>;

export async function obterLead(userId: string, chatJid: string): Promise<LeadInfo> {
  const sb = db();
  const key = `${userId}|${chatJid}`;
  const base = { analisando: running.has(key) || timers.has(key), sugestaoResposta: sugestoes.get(key) ?? null, aviso: avisos.get(key) ?? null };
  if (!sb) return linhaParaLead(null, { chatJid, ...base, aviso: "Supabase não configurado no servidor." });
  const { data: row } = await sb.from("whatsapp_ia_leads").select("*").eq("owner_id", userId).eq("chat_jid", chatJid).maybeSingle();
  let etapaPipeline: Etapa | null = null;
  if (row?.oportunidade_id) {
    const { data: op } = await sb.from("oportunidades").select("etapa").eq("id", row.oportunidade_id).maybeSingle();
    etapaPipeline = (op?.etapa as Etapa) ?? null;
  }
  return linhaParaLead(row ?? { chat_jid: chatJid }, { ...base, etapaPipeline });
}

/** Resumo leve de todos os leads (para a lista de conversas). */
export async function listarLeads(userId: string) {
  const sb = db();
  if (!sb)
    return {} as Record<
      string,
      {
        etapa: Etapa | null;
        ignorado: boolean;
        lead: boolean;
        natureza: NaturezaContato | null;
        categoria: CategoriaContato | null;
      }
    >;
  const { data } = await sb
    .from("whatsapp_ia_leads")
    .select("chat_jid, etapa, ignorado, natureza, categoria, oportunidade_id, relacionamento_id")
    .eq("owner_id", userId);
  const out: Record<
    string,
    {
      etapa: Etapa | null;
      ignorado: boolean;
      lead: boolean;
      natureza: NaturezaContato | null;
      categoria: CategoriaContato | null;
    }
  > = {};
  for (const r of data ?? []) {
    out[r.chat_jid] = {
      etapa: r.etapa,
      ignorado: r.ignorado,
      lead: !!(r.oportunidade_id || r.relacionamento_id),
      // Vao para a etiqueta ao lado do nome na lista de conversas.
      natureza: ehNatureza(r.natureza) ? r.natureza : null,
      categoria: ehCategoria(r.categoria) ? r.categoria : null,
    };
  }
  return out;
}

/**
 * Quantas respostas automáticas uma loja pode disparar por hora.
 *
 * Não é economia: é o freio para o caso de algo dar errado em laço — um
 * número da própria casa conversando com o sistema, uma reconexão que
 * reprocessa mensagens antigas. Trinta cobre com folga um dia movimentado de
 * lead de fora do estado; passar disso é sinal de defeito, não de movimento.
 */
const TETO_AUTO_HORA = 30;
const autoEnviados = ((globalThis as any).__auraAutoEnviados ??= [] as {
  empresa: string;
  em: number;
}[]) as { empresa: string; em: number }[];

function passouDoTeto(empresa: string): boolean {
  const limite = Date.now() - 60 * 60 * 1000;
  while (autoEnviados.length && autoEnviados[0].em < limite) autoEnviados.shift();
  return autoEnviados.filter((x) => x.empresa === empresa).length >= TETO_AUTO_HORA;
}

/**
 * A primeira resposta para quem está longe, enviada pela AURA.
 *
 * O PEDIDO: lead de outro estado recebe sozinho a oferta de atendimento a
 * distância, sem esperar o vendedor abrir a conversa. Um lead de São Paulo
 * que escreve às 22h e é respondido na hora vale mais do que o mesmo lead
 * respondido na manhã seguinte.
 *
 * AS TRAVAS, E POR QUE CADA UMA EXISTE:
 *
 *  1. Desligado por padrão, loja por loja. Mandar mensagem em nome do
 *     vendedor é coisa séria; quem liga é o gestor, não o programa.
 *
 *  2. SÓ NO PRIMEIRO CONTATO — nenhuma mensagem nossa naquela conversa,
 *     nunca. Se o vendedor já falou com a pessoa alguma vez, a conversa é
 *     dele; um texto automático caindo no meio seria constrangedor.
 *
 *  3. Uma vez por contato, para sempre, garantida no banco e não na memória:
 *     a marca é gravada ANTES do envio, com a condição de ainda estar vazia.
 *     Duas análises simultâneas da mesma conversa — que acontecem — mandariam
 *     a mesma mensagem duas vezes.
 *
 *  4. Só para quem a IA reconheceu como venda, com a mesma confiança mínima
 *     que o resto do sistema usa. Instalador, colega, fornecedor e amigo de
 *     São Paulo NÃO recebem oferta de showroom por videochamada. Quando a
 *     IA não respondeu, ninguém recebe: no escuro não se manda nada.
 *
 *  5. Só quem está fora dos estados atendidos presencialmente. DDD que o
 *     sistema não reconhece não recebe — errar aqui é mandar "você está
 *     longe" para quem mora a dois quarteirões.
 *
 *  6. Conversa de grupo e status não recebem.
 *
 * O vendedor é avisado do que saiu, e o texto fica guardado na conversa.
 */
async function talvezResponderSozinha(
  sb: SupabaseClient,
  userId: string,
  chatJid: string,
  nome: string,
  telefone: string | null,
  msgs: WaMessage[],
  empresa: string,
  analise: AnaliseIa | null,
  jaEraLead: boolean,
) {
  if (chatJid.endsWith("@g.us") || chatJid.includes("broadcast")) return;

  // Alguém da casa já escreveu nesta conversa: ela tem dono humano.
  if (msgs.some((m) => m.fromMe)) return;

  /**
   * A conversa tem de ser NOVA, e não só "sem resposta nossa".
   *
   * O WhatsApp entrega as mensagens recentes de cada conversa, não o
   * histórico inteiro. Numa conversa de meses atrás, a janela carregada pode
   * não conter a resposta que o vendedor deu lá no começo — e aí a conversa
   * parece primeiro contato sem ser. Exigir que ela tenha começado nas
   * últimas 48 horas fecha esse buraco: pior que não mandar nada é mandar
   * "olá, tudo bem?" para quem já é cliente há meio ano.
   */
  const marcas = msgs.map((m) => m.timestamp).filter((t) => Number.isFinite(t) && t > 0);
  if (!marcas.length) return;
  // O live-manager guarda em milissegundos; a divisão protege de um registro
  // antigo que tenha ficado em segundos.
  const maisAntiga = Math.min(...marcas);
  const emSegundos = maisAntiga > 1e12 ? maisAntiga / 1000 : maisAntiga;
  if (Date.now() / 1000 - emSegundos > 48 * 3600) return;

  const cfg = await configDeAtendimento(empresa);
  if (!cfg.automatico) return;
  const modelo = (cfg.textoAutomatico ?? "").trim();
  if (!modelo) return;

  const o = origemDoTelefone(telefone);
  if (!o.uf && !o.exterior) return;
  if (o.uf && cfg.estados.map((e) => e.toUpperCase()).includes(o.uf)) return;

  // É venda? A régua é a mesma do resto do sistema.
  const ehVenda = jaEraLead || (analise?.e_lead === true && Number(analise.confianca ?? 0) >= 0.75);
  if (!ehVenda) return;

  // Janela de horário, quando o gestor definiu uma. Fora dela a AURA não
  // manda e o vendedor responde pela sugestão, como antes.
  if (cfg.horaInicio !== null && cfg.horaFim !== null && cfg.horaInicio !== cfg.horaFim) {
    // O "% 24" nao e enfeite: com hour12 falso, parte das versoes devolve "24"
    // para a meia-noite em vez de "00", e uma janela que comeca a zero hora
    // deixaria de valer justamente na primeira hora dela.
    const agora =
      Number(
        new Date().toLocaleString("en-GB", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          hour12: false,
        }),
      ) % 24;
    if (!Number.isFinite(agora)) return;
    const dentro =
      cfg.horaInicio < cfg.horaFim
        ? agora >= cfg.horaInicio && agora < cfg.horaFim
        : agora >= cfg.horaInicio || agora < cfg.horaFim;
    if (!dentro) return;
  }

  if (passouDoTeto(empresa)) {
    console.error(`[supervisor] teto de respostas automáticas atingido em ${empresa}`);
    return;
  }

  const primeiroNome = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  const texto = modelo
    .replace(/\{nome\}/g, /^[\p{L}'-]{2,}$/u.test(primeiroNome) ? ` ${primeiroNome}` : "")
    .replace(/\{estado\}/g, estadoComPreposicao(o))
    .replace(/\{uf\}/g, o.uf ?? "")
    .replace(/\{loja\}/g, empresa)
    .trim();

  // A marca vem ANTES do envio e só vale se ainda estava vazia: é isto que
  // impede duas análises simultâneas de mandarem a mesma mensagem duas vezes.
  const { data: reservou } = await sb
    .from("whatsapp_ia_leads")
    .update({ auto_enviado_em: new Date().toISOString(), auto_texto: texto })
    .eq("owner_id", userId)
    .eq("chat_jid", chatJid)
    .is("auto_enviado_em", null)
    .select("id");
  if (!reservou?.length) return;

  try {
    await sendText(userId, chatJid, texto);
    autoEnviados.push({ empresa, em: Date.now() });
  } catch (e: any) {
    // Não saiu: devolve a vaga, senão este contato nunca mais receberia.
    await sb
      .from("whatsapp_ia_leads")
      .update({ auto_enviado_em: null, auto_texto: null })
      .eq("owner_id", userId)
      .eq("chat_jid", chatJid);
    console.error("[supervisor] resposta automática não saiu:", e?.message ?? e);
    return;
  }

  await notificar(
    sb,
    userId,
    "A AURA respondeu por você",
    `${nome} é de ${o.exterior ? "fora do Brasil" : o.estado} e recebeu a oferta de atendimento a distância. Entre na conversa para continuar.`,
  );
}

export async function analisarConversa(
  userId: string,
  chatJid: string,
  opts: { forcar?: boolean; comoLead?: boolean } = {},
) {
  const key = `${userId}|${chatJid}`;
  if (running.has(key)) return;
  const sb = db();
  const chat = getChat(userId, chatJid);
  const msgs = getMessages(userId, chatJid);
  if (!sb || !chat || msgs.length === 0) return;

  running.add(key);
  try {
    const { data: row } = await sb
      .from("whatsapp_ia_leads")
      .select("*")
      .eq("owner_id", userId)
      .eq("chat_jid", chatJid)
      .maybeSingle();
    /**
     * Decisao do vendedor manda. Marcou "nao e lead" (instalador, colega,
     * chefe, amigo) ou "ja e nosso cliente"? A AURA nao reabre o assunto nem
     * volta a sugerir - era essa insistencia que enchia o pipeline de quem
     * nunca foi comprar nada.
     *
     * A unica porta de volta e o proprio vendedor tocar em "Tratar como lead",
     * que chega aqui como opts.comoLead.
     */
    const decidido = row?.natureza === "nao_lead" || row?.natureza === "cliente";
    if ((row?.ignorado || decidido) && !opts.comoLead) return;
    const ultimo = msgs[msgs.length - 1];
    if (!opts.forcar && row?.ultimo_msg_id === ultimo.id) return;

    const empresa = await empresaDo(userId);
    // Sem loja no perfil, nada daqui para baixo tem onde ser gravado: o lead,
    // o negócio e a conversa nasceriam órfãos ou na loja de outra pessoa. É
    // melhor não analisar e deixar o gestor completar o cadastro.
    if (!empresa) return;
    // O funil é desta loja: o gestor edita as etapas por loja, e tudo daqui
    // para baixo pergunta o PAPEL da etapa em vez de comparar o nome.
    const funil = await carregarFunil(sb, empresa);
    const regras = detectarEtapa(msgs);
    const alertas = calcularAlertas(msgs);

    let etapaPipelineAtual: Etapa | null = null;
    if (row?.oportunidade_id) {
      const { data: op } = await sb.from("oportunidades").select("etapa").eq("id", row.oportunidade_id).maybeSingle();
      etapaPipelineAtual = (op?.etapa as Etapa) ?? null;
    }

    let analise: AnaliseIa | null = null;
    let aviso: string | null = null;
    try {
      const sb0 = db();

      /**
       * O manual não viaja inteiro. Vão só as REGRAS DA CASA (o núcleo, que
       * vale em qualquer conversa) e os TRECHOS que a busca achou pelo assunto
       * desta conversa.
       *
       * Com os sete documentos da casa carregados, mandar tudo bateria no
       * corte de 40 mil caracteres e o manual chegaria partido no meio -
       * sempre na mesma parte, para toda conversa.
       *
       * QUEDA SEGURA: se ainda não há trechos gravados para a loja, o núcleo
       * vem vazio e voltamos ao jeito antigo, mandando o material inteiro. É
       * melhor pagar mais caro do que atender sem manual.
       */
      let fixo = sb0 ? await nucleoDoManual(sb0, empresa).catch(() => "") : "";
      let trechos = "";
      if (sb0 && fixo) {
        trechos = textoDosTrechos(
          await trechosRelevantes(sb0, empresa, transcricao(msgs, chat.name), 6),
        );
      }
      if (!fixo) fixo = await materiaisDaEmpresa(empresa);

      analise = await analisarComIa(
        msgs,
        chat.name,
        etapaPipelineAtual,
        alertas,
        funil,
        fixo,
        sb0 ? await textoDoAprendizado(sb0, empresa) : "",
        trechos,
        await blocoDeAtendimento(empresa, chat.phone).catch(() => ""),
        empresa,
      );
    } catch (e: any) {
      console.error("[supervisor] IA:", e?.message ?? e);
      if (e?.status === 401) {
        chaveInvalida.key = aiKey();
        aviso = "A chave da IA (ANTHROPIC_API_KEY) é inválida — usando só as regras automáticas.";
      } else {
        aviso = "A IA não respondeu agora — usei só as regras automáticas.";
      }
    }

    /**
     * Quem decide se é lead é o vendedor. Sempre.
     *
     * A AURA já criou lead sozinha com base na confiança dela, e o pipeline
     * encheu de conversa que não era venda: papo de amigo, suporte técnico,
     * um orçamento de tatuagem. Confiança alta também erra, e o erro cai na
     * carteira de alguém.
     *
     * Agora ela só entra no CRM por duas portas: o vendedor tocou em
     * "Tratar como lead", ou aquele contato já tem negócio aberto — nesse
     * caso alguém já decidiu antes. Fora isso, ela sugere e espera.
     */
    const CONFIANCA_MINIMA = 0.75;
    const jaEhNegocio = !!row?.oportunidade_id;
    const confiancaLead = analise ? Number(analise.confianca ?? 0) : 0;

    // Sem IA, palavra-chave também não cria nada: no máximo sugere.
    const soRegrasAchou = !analise && regras.comercial;

    const ehLead = !!opts.comoLead || jaEhNegocio;
    const sugerirLead = !ehLead && (!!analise?.e_lead || soRegrasAchou);

    /**
     * Etapa detectada: a mais avançada entre regras e IA (IA só com confiança
     * ≥ 0,7).
     *
     * As regras devolvem a CHAVE do que viram ("isto é orçamento enviado") e
     * aqui ela vira o nome da etapa DESTA loja. Se o gestor desligou a etapa
     * que faria aquele papel, não há para onde mover e a detecção fica nula —
     * o vendedor move à mão, que é melhor do que o card ir para uma etapa que
     * a loja decidiu não usar.
     */
    let detectada: Etapa | null = regras.chave ? nomeDaChave(regras.chave, funil) : null;
    let evidencia = regras.evidencias.filter((e) => e.chave === regras.chave).slice(-1)[0]?.texto ?? "";
    let fonte = "regras";
    if (analise?.etapa && !ehFechada(analise.etapa, funil) && analise.confianca >= 0.7) {
      if (!detectada || ordemDe(analise.etapa, funil) > ordemDe(detectada, funil)) {
        detectada = analise.etapa;
        evidencia = analise.evidencia || evidencia;
        fonte = "ia";
      }
    }
    if (ehLead && !detectada) detectada = primeiraEtapa(funil);

    /**
     * Fechar e perder são do vendedor, nunca da AURA.
     *
     * Entrar em Fechados cria a venda do mês. Uma IA que move o card
     * sozinha até lá registra faturamento que ninguém vendeu — foi o que
     * aconteceu quando um cliente mandou valores por WhatsApp e a conversa
     * apareceu como negócio fechado. Perdidos tem o problema espelhado:
     * encerra sozinha um negócio que ainda estava de pé.
     *
     * A AURA continua reconhecendo os dois e dizendo o que viu. Quem
     * arrasta o card é gente.
     */
    const soDoVendedor = (e: Etapa | null): boolean => ehFechada(e, funil);

    const alertasIa = [...(analise?.alertas ?? [])];
    if (regras.sinalPerda) alertasIa.unshift(`Risco de perda: cliente disse "${regras.sinalPerda.slice(0, 120)}"`);
    if (ehPerda(analise?.etapa, funil) && (analise?.confianca ?? 0) >= 0.7) alertasIa.unshift(`A IA acha que este lead está sendo perdido: ${analise?.evidencia ?? ""}`);
    if (ehLead && ehGanho(detectada, funil)) {
      alertasIa.unshift(
        `A AURA achou que este negócio fechou${evidencia ? `: "${evidencia.slice(0, 120)}"` : ""}. Se fechou mesmo, arraste o card para Fechados — a venda do mês só entra quando você confirma.`,
      );
    }

    const patch: Record<string, unknown> = {
      owner_id: userId,
      empresa,
      chat_jid: chatJid,
      telefone: chat.phone,
      nome: chat.name,
      ultimo_msg_id: ultimo.id,
      ultima_analise_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resumo: analise?.resumo ?? row?.resumo ?? null,
      proxima_acao: analise?.proxima_acao ?? (alertas[0]?.texto ?? row?.proxima_acao ?? null),
      dicas: analise?.dicas ?? row?.dicas ?? [],
      alertas: alertasIa,
      interesse: analise?.interesse ?? row?.interesse ?? null,
      valor_estimado: analise?.valor_estimado ?? row?.valor_estimado ?? null,
    };
    /**
     * O palpite da IA fica guardado, nao aplicado: a categoria so entra no
     * campo "categoria" quando o vendedor confirma. Se a IA escrevesse direto,
     * a etiqueta erraria sozinha e ninguem saberia de onde veio.
     */
    if (!row?.categoria && analise?.categoria_sugerida) {
      patch.categoria_sugerida = analise.categoria_sugerida;
    }
    // Instalador, colega, fornecedor: vira o motivo oferecido no painel.
    if (!analise?.e_lead && analise?.tipo_nao_lead && !row?.natureza) {
      patch.motivo_natureza = analise.tipo_nao_lead;
    }
    patch.lead_sugerido = sugerirLead;
    patch.confianca_lead = analise ? confiancaLead : null;
    patch.motivo_sugestao = sugerirLead
      ? analise?.resumo
        ? `${confiancaLead >= CONFIANCA_MINIMA ? "Parece venda" : "Pode ser venda"} (${Math.round(confiancaLead * 100)}%): ${analise.resumo}`
        : "Apareceram palavras de venda na conversa. Confirme se é cliente."
      : null;
    if (opts.comoLead) {
      patch.ignorado = false;
      patch.lead_sugerido = false;
      patch.motivo_sugestao = null;
    }
    if (analise?.sugestao_resposta) sugestoes.set(key, analise.sugestao_resposta);

    const historico: any[] = Array.isArray(row?.historico) ? [...row.historico] : [];

    if (ehLead) {
      let relacionamentoId: string | null = row?.relacionamento_id ?? null;
      if (!relacionamentoId) {
        const r = await garantirRelacionamento(
          sb,
          userId,
          empresa,
          chat.name,
          chat.phone,
          ehCategoria(row?.categoria) ? row.categoria : analise?.categoria_sugerida ?? null,
        );
        relacionamentoId = r.id;
        if (r.aviso) aviso = r.aviso;
      }
      patch.relacionamento_id = relacionamentoId;

      if (relacionamentoId) {
        const op = await garantirOportunidade(
          sb,
          userId,
          empresa,
          relacionamentoId,
          chat.name,
          patch.interesse as string | null,
          patch.valor_estimado as number | null,
          row?.oportunidade_id ?? null,
          funil,
        );
        if (op) {
          patch.oportunidade_id = op.id;
          const ultimaDetectada = (row?.etapa as Etapa | null) ?? null;
          // Só avança: nova etapa acima da atual no pipeline E acima da última
          // detectada (assim, se o vendedor voltar o card manualmente, a IA
          // não "desfaz" a decisão dele sem evidência nova).
          if (
            detectada &&
            !soDoVendedor(detectada) &&
            !ehFechada(op.etapa, funil) &&
            ordemDe(detectada, funil) > ordemDe(op.etapa, funil) &&
            (!ultimaDetectada || ordemDe(detectada, funil) > ordemDe(ultimaDetectada, funil))
          ) {
            const moved = await moverOportunidade(sb, userId, empresa, op, detectada, evidencia, relacionamentoId, patch.valor_estimado as number | null, funil);
            if (moved) historico.push({ em: new Date().toISOString(), de: op.etapa, para: detectada, evidencia, fonte });
          } else if (!row?.oportunidade_id) {
            historico.push({ em: new Date().toISOString(), de: null, para: op.etapa, evidencia: "Lead cadastrado no CRM", fonte });
          }
        }
      }
      // Guardar "Fechados" aqui pintaria a etiqueta de fechado sem que o
      // negócio tenha fechado. Vale o que está no card de verdade.
      patch.etapa = soDoVendedor(detectada) ? ((row?.etapa as Etapa | null) ?? null) : detectada;
    } else {
      patch.etapa = null;
    }
    patch.historico = historico.slice(-30);

    if (aviso) avisos.set(key, aviso);
    else avisos.delete(key);

    const { error } = await sb.from("whatsapp_ia_leads").upsert(patch, { onConflict: "owner_id,chat_jid" });
    if (error) console.error("[supervisor] salvar análise:", error.message);

    // Depois de gravar, nunca antes: a reserva da resposta automática precisa
    // da linha existindo para poder ser condicional.
    if (!error) {
      await talvezResponderSozinha(
        sb, userId, chatJid, chat.name, chat.phone, msgs, empresa, analise, ehLead,
      ).catch((e) => console.error("[supervisor] resposta automática:", e?.message ?? e));
    }
  } catch (e: any) {
    console.error("[supervisor] analisarConversa:", e?.message ?? e);
  } finally {
    running.delete(key);
  }
}

/**
 * O vendedor diz o que o contato e. Tres respostas possiveis:
 *
 *   'lead'     - prospecto. Dispara a analise e entra no pipeline.
 *   'nao_lead' - instalador, colega, chefe, amigo, fornecedor. A AURA para de
 *                acompanhar e nao sugere mais.
 *   'cliente'  - ja comprou da casa. E pos-venda do vendedor, nao prospeccao:
 *                fica na carteira dele, fora do funil de prospeccao.
 *
 * A categoria (Arquiteto, Construtora, Cliente Final...) e independente da
 * natureza e pode ser gravada sozinha, so para a etiqueta.
 *
 * Mantem o campo antigo "ignorado" coerente, porque ha codigo vivo que decide
 * por ele - inclusive a propria analise automatica.
 */
export async function classificarContato(
  userId: string,
  chatJid: string,
  entrada: {
    natureza?: NaturezaContato | null;
    categoria?: CategoriaContato | null;
    motivo?: string | null;
  },
) {
  const sb = db();
  if (!sb) throw new Error("Supabase não configurado.");
  const chat = getChat(userId, chatJid);

  const linha: Record<string, unknown> = {
    owner_id: userId,
    empresa: await empresaDo(userId),
    chat_jid: chatJid,
    telefone: chat?.phone ?? null,
    nome: chat?.name ?? null,
    updated_at: new Date().toISOString(),
  };

  if (entrada.natureza !== undefined) {
    linha.natureza = entrada.natureza;
    linha.classificado_em = new Date().toISOString();
    linha.classificado_por = userId;
    // 'nao_lead' e 'cliente' nao devem ser reabertos pela analise automatica.
    linha.ignorado = entrada.natureza === "nao_lead" || entrada.natureza === "cliente";
    if (entrada.natureza !== "nao_lead") linha.motivo_natureza = null;
    if (entrada.natureza === "lead") {
      // Deixou de ser palpite: virou decisao.
      linha.lead_sugerido = false;
      linha.motivo_sugestao = null;
    }
  }
  if (entrada.categoria !== undefined) {
    linha.categoria = entrada.categoria;
    linha.categoria_sugerida = null;
  }
  if (entrada.motivo !== undefined) linha.motivo_natureza = entrada.motivo;

  /**
   * "Ja e nosso cliente" tem de valer na carteira, nao so na conversa.
   *
   * Sem isto, o vendedor marcava o cliente antigo e nada acontecia: o contato
   * ficava de fora do funil (certo) e de fora da carteira (errado), ou seja,
   * sumia. Quem comprou da casa pertence a carteira de quem vendeu — e dali
   * que sai o pos-venda.
   *
   * Nao criamos pos_vendas aqui: aquela tabela exige uma venda registrada, e
   * cliente antigo de antes do CRM nao tem. Inventar venda para preencher a
   * tabela seria faturamento que ninguem vendeu.
   */
  if (entrada.natureza === "cliente" && chat?.phone) {
    const r = await garantirRelacionamento(
      sb,
      userId,
      String(linha.empresa ?? ""),
      chat.name ?? "",
      chat.phone,
      entrada.categoria ?? null,
    );
    if (r.id) {
      linha.relacionamento_id = r.id;
      await sb
        .from("relacionamentos")
        .update({
          status_relacionamento: "cliente",
          // 'ativo' e nao 'quente': cliente da casa e relacionamento para
          // manter, nao prospecto para perseguir. A tela da carteira mostra a
          // temperatura, entao esta e a parte que o vendedor realmente ve.
          temperatura: "ativo",
          ultimo_contato_em: new Date().toISOString(),
          ...(entrada.categoria ? { categoria: entrada.categoria } : {}),
        })
        .eq("id", r.id)
        .eq("owner_id", userId);
    }
  }

  const { error } = await sb
    .from("whatsapp_ia_leads")
    .upsert(linha, { onConflict: "owner_id,chat_jid" });
  if (error) throw new Error(error.message);

  // Marcou como lead: analisa agora, para o vendedor nao esperar o proximo ciclo.
  if (entrada.natureza === "lead") {
    agendarAnalise(userId, chatJid, 0, { forcar: true, comoLead: true });
  }
}

export async function marcarIgnorado(userId: string, chatJid: string, ignorado: boolean) {
  const sb = db();
  if (!sb) return;
  const chat = getChat(userId, chatJid);
  await sb.from("whatsapp_ia_leads").upsert(
    {
      owner_id: userId,
      empresa: await empresaDo(userId),
      chat_jid: chatJid,
      telefone: chat?.phone ?? null,
      nome: chat?.name ?? null,
      ignorado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,chat_jid" },
  );
  if (!ignorado) agendarAnalise(userId, chatJid, 0, { forcar: true, comoLead: true });
}

/** Vendedor escolhe a etapa manualmente pelo painel. */
export async function definirEtapaManual(userId: string, chatJid: string, etapa: Etapa) {
  const sb = db();
  if (!sb) throw new Error("Supabase não configurado.");
  const { data: row } = await sb.from("whatsapp_ia_leads").select("*").eq("owner_id", userId).eq("chat_jid", chatJid).maybeSingle();
  if (!row?.oportunidade_id) throw new Error("Este contato ainda não tem oportunidade no CRM. Clique em Analisar primeiro.");
  const { data: op } = await sb.from("oportunidades").select("id, etapa, cliente").eq("id", row.oportunidade_id).maybeSingle();
  if (!op) throw new Error("Oportunidade não encontrada.");
  await sb
    .from("oportunidades")
    .update({ etapa, probabilidade: probabilidadeDe(etapa, await carregarFunil(sb, await empresaDo(userId))), updated_at: new Date().toISOString(), dias_parado: 0 })
    .eq("id", op.id);
  const empresa = await empresaDo(userId);
  await registrarAtividade(sb, userId, empresa, row.relacionamento_id, op.cliente, `Etapa alterada no WhatsApp: ${op.etapa} → ${etapa}`, "Alteração manual pelo vendedor", { oportunidade_id: op.id, de: op.etapa, para: etapa });
  const historico = Array.isArray(row.historico) ? row.historico : [];
  historico.push({ em: new Date().toISOString(), de: op.etapa, para: etapa, evidencia: "Alterado manualmente pelo vendedor", fonte: "vendedor" });
  await sb.from("whatsapp_ia_leads").update({ etapa, historico: historico.slice(-30), updated_at: new Date().toISOString() }).eq("id", row.id);
}

export function agendarAnalise(
  userId: string,
  chatJid: string,
  delay = DEBOUNCE_MS,
  opts: { forcar?: boolean; comoLead?: boolean } = {},
) {
  const key = `${userId}|${chatJid}`;
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      analisarConversa(userId, chatJid, opts).catch((e) => console.error("[supervisor]", e));
    }, delay),
  );
}

// ---------------------------------------------------------------- vigilância

/** A cada 5 minutos avisa o vendedor sobre leads sem resposta ou sem follow-up. */
async function varredura() {
  const sb = db();
  if (!sb) return;
  for (const userId of connectedUserIds()) {
    try {
      const leads = await listarLeads(userId);
      for (const chat of getChats(userId)) {
        const info = leads[chat.id];
        if (!info?.lead || info.ignorado) continue;
        const msgs = getMessages(userId, chat.id);
        for (const alerta of calcularAlertas(msgs)) {
          const grave =
            (alerta.tipo === "sem_resposta" && alerta.nivel !== "medio") ||
            (alerta.tipo === "follow_up" && alerta.nivel === "alto");
          if (!grave) continue;
          const chave = `${userId}|${chat.id}|${alerta.tipo}|${alerta.desde}`;
          if (notified.has(chave)) continue;
          notified.add(chave);
          await notificar(
            sb,
            userId,
            alerta.tipo === "sem_resposta" ? "⏰ Cliente esperando resposta" : "📌 Follow-up pendente",
            `${chat.name}: ${alerta.texto}.`,
          );
        }
      }
    } catch (e: any) {
      console.error("[supervisor] varredura:", e?.message ?? e);
    }
  }
}

const atividadesDoDia = ((globalThis as any).__auraSupAtivDia ??= new Set<string>()) as Set<string>;

/** Conta o atendimento no WhatsApp como atividade (metas, relatórios, ranking). */
async function registrarAtividadeWhats(userId: string, chatJid: string) {
  const sb = db();
  if (!sb) return;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const chaveDia = `${userId}|${chatJid}|${hoje}`;
  if (atividadesDoDia.has(chaveDia)) return;
  const { data: row } = await sb
    .from("whatsapp_ia_leads")
    .select("relacionamento_id, ignorado, nome")
    .eq("owner_id", userId)
    .eq("chat_jid", chatJid)
    .maybeSingle();
  if (!row?.relacionamento_id || row.ignorado) return;
  atividadesDoDia.add(chaveDia);
  const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const { data: ja } = await sb
    .from("atividades")
    .select("id")
    .eq("owner_id", userId)
    .eq("relacionamento_id", row.relacionamento_id)
    .eq("origem", "whatsapp_auto")
    .gte("ocorrida_em", inicioDia)
    .limit(1);
  if (ja?.length) return;
  const empresa = await empresaDo(userId);
  const { error } = await sb.from("atividades").insert({
    owner_id: userId,
    empresa,
    tipo: "WhatsApp",
    titulo: "Atendimento pelo WhatsApp",
    contexto: "Registrado automaticamente pela AURA",
    relacionamento_id: row.relacionamento_id,
    cliente_nome: row.nome,
    origem: "whatsapp_auto",
    ocorrida_em: new Date().toISOString(),
    metadata: { chat_jid: chatJid, fonte: "supervisor_aura" },
  });
  if (error) console.error("[supervisor] atividade WhatsApp:", error.message);
}

export function alertasDoChat(userId: string, chatJid: string) {
  return calcularAlertas(getMessages(userId, chatJid));
}

if (!g.__auraSupStarted) {
  g.__auraSupStarted = true;
  onMessage((userId, chatJid, msg) => {
    agendarAnalise(userId, chatJid);
    if (msg.fromMe) registrarAtividadeWhats(userId, chatJid).catch((e) => console.error("[supervisor]", e));
  });
  setInterval(() => {
    varredura().catch(() => {});
  }, 5 * 60 * 1000);
}
