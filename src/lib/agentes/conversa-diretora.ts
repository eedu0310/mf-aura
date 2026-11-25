/**
 * "Conversar com a Diretora": o gestor manda uma ideia de melhoria e a AURA
 * Diretora responde NA HORA, dizendo o que vai fazer com ela.
 *
 * Pedido do dono (25/11/2026): "um botão para eu conversar com a Diretora
 * geral, mandar minhas ideias de melhoria direto para ela".
 *
 * Tudo fica em aura_escritorio_mensagens, a mesma tabela do mural:
 *
 *   gestor → Diretora ... tipo "ideia", de "gestor:<id do perfil>", para a
 *                         Diretora, já marcada como lida (ela responde agora;
 *                         a rodada das 7h20 não responde de novo);
 *   Diretora → gestor ... tipo "resposta", para "gestor:<id>", com o que ela
 *                         encaminhou e a proposta (se houver) em `dados`;
 *   Diretora → agente ... tipo "pedido", NÃO lida: cai na caixa de entrada do
 *                         agente na próxima rodada dele e aparece no mural;
 *   proposta ............ vira linha em aura_agente_propostas pelo mesmo
 *                         caminho das propostas da equipe (status "proposta":
 *                         quem aprova é o gestor mestre, na aba Propostas).
 *
 * A IA é a da Diretora: sai do orçamento dela (agente/diretora em ia_uso),
 * respeita o saldo do gestor e não pode inventar número (o texto é conferido
 * contra os dados que ela recebeu). Sem IA, ela responde por regra e a ideia
 * vai para o mural do mesmo jeito.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarRegistro, chamarIAComOrcamento, gravarPropostas, temMigracao108, type AgenteRegistrado } from "./motor";
import { configuracaoValida, FONTES } from "./configuravel";
import { ID_DIRETORA } from "./diretora";
import { montarEstadoEscritorio } from "./escritorio";
import { faltaNoBanco, idNoEscritorioDoGestor, MOTIVO_SEM_108, numerosDoTexto } from "./util";
import {
  interpretarRespostaDaDiretora,
  mensagemDaConversa,
  respostaPorRegra,
  RESPOSTA_SEM_IA,
} from "./conversa-diretora-regras";
import type { ConversaDiretora, MensagemConversaDiretora, PropostaAgente } from "./tipos";

/** As tabelas da equipe (migração 110) não estão no banco: a rota responde 409. */
export class EquipeSemTabelas extends Error {
  constructor() {
    super(MOTIVO_SEM_108);
    this.name = "EquipeSemTabelas";
  }
}

const LIMITE_CONVERSA = 50;
const CAMPOS = "id, de_agente, para_agente, tipo, texto, dados, criado_em";

interface Linha {
  id: string;
  de_agente: string;
  para_agente: string | null;
  tipo: string;
  texto: string;
  dados: unknown;
  criado_em: string;
}

export interface QuemConversa {
  userId: string;
  empresa: string;
  /** Gestor mestre: o retrato da equipe é do grupo inteiro, não só da loja. */
  vejoTodas: boolean;
}

/** A Diretora do registro: o agente do setor "direcao" (a que tem "diretor" no nome, se houver mais de um). */
export function acharDiretoraNoRegistro(registro: AgenteRegistrado[]): AgenteRegistrado | null {
  return (
    registro.find((a) => a.id === ID_DIRETORA) ??
    registro.find((a) => a.setor === "direcao" && /diretor/i.test(`${a.id} ${a.nome}`)) ??
    registro.find((a) => a.setor === "direcao") ??
    null
  );
}

async function linhasDaConversa(sb: SupabaseClient, gestor: string, diretoraId: string): Promise<Linha[]> {
  // Duas consultas simples (em vez de um "or" com aspas no PostgREST) e junta.
  const [ida, volta] = await Promise.all([
    sb
      .from("aura_escritorio_mensagens")
      .select(CAMPOS)
      .eq("de_agente", gestor)
      .eq("para_agente", diretoraId)
      .order("criado_em", { ascending: false })
      .limit(LIMITE_CONVERSA),
    sb
      .from("aura_escritorio_mensagens")
      .select(CAMPOS)
      .eq("de_agente", diretoraId)
      .eq("para_agente", gestor)
      .order("criado_em", { ascending: false })
      .limit(LIMITE_CONVERSA),
  ]);
  for (const r of [ida, volta]) {
    if (r.error) {
      if (faltaNoBanco(r.error)) throw new EquipeSemTabelas();
      throw new Error(`Não consegui ler a conversa: ${r.error.message}`);
    }
  }
  return [...((ida.data ?? []) as Linha[]), ...((volta.data ?? []) as Linha[])]
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    .slice(-LIMITE_CONVERSA);
}

/** GET: as últimas 50 mensagens entre este gestor e a Diretora, da mais antiga para a mais nova. */
export async function lerConversaComDiretora(sb: SupabaseClient, userId: string): Promise<ConversaDiretora> {
  if (!(await temMigracao108(sb))) throw new EquipeSemTabelas();
  const registro = await carregarRegistro(sb, true);
  const diretora = acharDiretoraNoRegistro(registro);
  if (!diretora) return { diretora: null, mensagens: [] };
  const gestor = idNoEscritorioDoGestor(userId);
  const linhas = await linhasDaConversa(sb, gestor, diretora.id);
  return { diretora: { id: diretora.id, nome: diretora.nome }, mensagens: linhas.map((l) => mensagemDaConversa(l, gestor)) };
}

function curto(texto: string | null | undefined, limite: number): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  return t.length > limite ? `${t.slice(0, limite - 1)}…` : t;
}

/** O retrato da equipe que a Diretora recebe — os mesmos dados da tela do escritório. */
async function retratoDaEquipe(sb: SupabaseClient, quem: QuemConversa, registro: AgenteRegistrado[], diretoraId: string) {
  try {
    const estado = await montarEstadoEscritorio(sb, { empresa: quem.vejoTodas ? null : quem.empresa });
    return {
      equipe: estado.mesas
        .filter((m) => m.id !== diretoraId)
        .map((m) => ({
          agenteId: m.id,
          nome: m.nome,
          cargo: m.cargo,
          setor: m.setor,
          missao: curto(m.missao, 220),
          ligado: m.ativo,
          estado: m.estado,
          ultimoResultado: curto(m.ultimaExecucao?.resumo, 200) || null,
          achadosAbertos: m.achadosAbertos,
          resolvidosEm30Dias: m.achadosResolvidos30d,
        })),
      planoDoDia: estado.planoDoDia?.texto ?? null,
      propostasEsperandoOGestor: estado.propostas.filter((p) => p.status === "proposta").map((p) => p.nome),
    };
  } catch (e) {
    // Sem o retrato completo ela ainda conhece a equipe pelo registro.
    console.error("[gestor/agentes/diretora] retrato da equipe:", e);
    return {
      equipe: registro
        .filter((a) => a.id !== diretoraId)
        .map((a) => ({ agenteId: a.id, nome: a.nome, cargo: a.cargo, setor: a.setor, missao: curto(a.missao, 220), ligado: a.ativo })),
      planoDoDia: null,
      propostasEsperandoOGestor: [] as string[],
    };
  }
}

const SISTEMA = [
  "Você é a AURA Diretora: lidera a equipe de agentes de IA dentro do CRM de um grupo de lojas de lareiras, fogões a lenha, churrasqueiras e aquecimento no Rio Grande do Sul.",
  "Um gestor da empresa está conversando com você para mandar ideias de melhoria.",
  "Responda em português do Brasil, em no máximo 4 frases curtas, com tom direto e gentil, sem emojis e sem markdown.",
  "Diga com clareza o que você vai fazer com a ideia: qual agente (pelo nome, da EQUIPE) ou setor vai cuidar dela. Se nenhum agente cobre a ideia, proponha um agente novo. Se a ideia não couber no que os agentes podem fazer, diga com franqueza e sugira um caminho.",
  "NUNCA invente números: só use números que aparecem nos DADOS ou na mensagem do gestor. Não cite nome de cliente.",
  "Os agentes nunca mandam mensagem para cliente nem alteram venda, cliente, etapa ou dono: eles só sugerem para as pessoas. Agente novo só passa a existir quando o gestor mestre aprovar a proposta na aba Propostas — não prometa que ele já está funcionando.",
  "Devolva um objeto JSON com:",
  '  "resposta": o texto para o gestor;',
  '  "encaminhar": lista (no máximo 3) de {"agenteId": "<agenteId exatamente como na EQUIPE>", "pedido": "o que esse agente deve fazer, em 1 ou 2 frases"} — use [] se não for passar para ninguém;',
  '  "proposta": só quando nenhum agente atual cobre a ideia (senão omita): {"nome": "...", "setor": "vendas|pos-venda|marketing|gestao|conhecimento|dados", "missao": "uma frase", "justificativa": "até duas frases", "config": {"fonte": "<uma das FONTES>", "filtroDescricao": "o que procurar nessa fonte", "instrucoes": "como decidir e escrever cada item", "agenda": {"tipo": "diario", "horas": [9], "diasSemana": [1,2,3,4,5,6]}, "destinatario": "dono|gestor_da_loja|pos_venda_da_loja|marketing_da_loja", "limitePorExecucao": 10}}.',
].join("\n");

/** POST: grava a ideia, a Diretora responde agora, encaminha e (se for o caso) propõe um agente. */
export async function conversarComDiretora(
  sb: SupabaseClient,
  quem: QuemConversa,
  texto: string,
): Promise<{ pergunta: MensagemConversaDiretora; resposta: MensagemConversaDiretora }> {
  if (!(await temMigracao108(sb))) throw new EquipeSemTabelas();
  const registro = await carregarRegistro(sb, true);
  const diretora = acharDiretoraNoRegistro(registro);
  if (!diretora) throw new Error("A Diretora não está no registro de agentes.");
  const gestor = idNoEscritorioDoGestor(quem.userId);
  const nomesDosAgentes = new Map(registro.map((a) => [a.id, a.nome]));

  const [{ data: perfil }, historico] = await Promise.all([
    sb.from("profiles").select("nome").eq("id", quem.userId).maybeSingle(),
    linhasDaConversa(sb, gestor, diretora.id),
  ]);
  const nomeGestor = curto((perfil?.nome as string | undefined) ?? "", 60) || "O gestor";

  // 1. A ideia do gestor (já lida: ela responde agora mesmo).
  const { data: pergunta, error: erroPergunta } = await sb
    .from("aura_escritorio_mensagens")
    .insert({
      de_agente: gestor,
      para_agente: diretora.id,
      tipo: "ideia",
      texto,
      empresa: quem.empresa || null,
      dados: { conversaComGestor: true, gestorId: quem.userId },
      lida_por_agente: true,
    })
    .select(CAMPOS)
    .single();
  if (erroPergunta) {
    if (faltaNoBanco(erroPergunta)) throw new EquipeSemTabelas();
    throw new Error(`Não consegui guardar a mensagem: ${erroPergunta.message}`);
  }

  // 2. A resposta dela, por IA, com o retrato da equipe.
  const retrato = await retratoDaEquipe(sb, quem, registro, diretora.id);
  const conversaAnterior = historico.slice(-8).map((l) => ({
    quem: l.de_agente === gestor ? "gestor" : "Diretora",
    texto: curto(l.texto, 400),
  }));
  const dados = { ...retrato, FONTES: Object.keys(FONTES) };
  const usuario = [
    `QUEM FALA: ${nomeGestor}, ${quem.vejoTodas ? "gestor mestre (vê as quatro lojas)" : `gestor da loja ${quem.empresa}`}.`,
    `DADOS:\n${JSON.stringify(dados)}`,
    conversaAnterior.length ? `CONVERSA ANTERIOR:\n${JSON.stringify(conversaAnterior)}` : "",
    `MENSAGEM DO GESTOR:\n${texto}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const permitidos = [
    ...numerosDoTexto(JSON.stringify(dados)),
    ...numerosDoTexto(texto),
    ...conversaAnterior.flatMap((c) => numerosDoTexto(c.texto)),
  ];

  const { resultado, barrada } = await chamarIAComOrcamento(sb, diretora, {
    perfil: "redacao",
    json: true,
    maxTokens: 900,
    sistema: SISTEMA,
    usuario,
    empresa: quem.empresa || null,
    usuarioId: quem.userId,
  });
  if (barrada) console.log(`[gestor/agentes/diretora] IA barrada (${barrada}); resposta por regra`);
  const lida = interpretarRespostaDaDiretora(resultado, {
    diretoraId: diretora.id,
    agentes: new Map([...nomesDosAgentes].filter(([id]) => id !== diretora.id)),
    permitidos,
    validarConfig: configuracaoValida,
  });
  if (resultado && lida.descartes.length) console.log("[gestor/agentes/diretora] descartado da IA:", lida.descartes.join("; "));
  const semIA = resultado === null;

  // 3. Pedidos aos agentes (caem na caixa de entrada deles e aparecem no mural).
  const encaminhados = lida.encaminhar.map((e) => ({
    agenteId: e.agenteId,
    agenteNome: nomesDosAgentes.get(e.agenteId) ?? e.agenteId,
    pedido: e.pedido,
  }));
  const mural: Array<Record<string, unknown>> = encaminhados.map((e) => ({
    de_agente: diretora.id,
    para_agente: e.agenteId,
    tipo: "pedido",
    texto: `Ideia de ${nomeGestor}: ${e.pedido}`,
    empresa: quem.empresa || null,
    dados: { origem: "gestor", gestorId: quem.userId, ideia: pergunta.id },
  }));
  if (semIA) {
    // Sem IA a ideia não se perde: vai para o mural, para a equipe toda ver.
    mural.push({
      de_agente: diretora.id,
      para_agente: "todos",
      tipo: "ideia",
      texto: `${nomeGestor} deixou uma ideia para a equipe: "${curto(texto, 300)}"`,
      empresa: quem.empresa || null,
      dados: { origem: "gestor", gestorId: quem.userId, ideia: pergunta.id },
    });
  }

  // 4. Proposta de agente novo (pelo mesmo caminho das propostas da equipe).
  let proposta: { nome: string; setor: PropostaAgente["setor"]; gravada: boolean } | null = null;
  if (lida.proposta) {
    const gravadas = await gravarPropostas(sb, { id: diretora.id }, [lida.proposta], registro).catch((e) => {
      console.error("[gestor/agentes/diretora] proposta:", e);
      return 0;
    });
    proposta = { nome: lida.proposta.nome, setor: lida.proposta.setor, gravada: gravadas > 0 };
    if (gravadas > 0) {
      mural.push({
        de_agente: diretora.id,
        para_agente: "todos",
        tipo: "ideia",
        texto: `Propus ao gestor mestre um agente novo a partir de uma ideia de ${nomeGestor}: ${lida.proposta.nome}. ${lida.proposta.justificativa}`.trim(),
        empresa: quem.empresa || null,
        dados: { chave: `proposta:${lida.proposta.nome}`, origem: "gestor", ideia: pergunta.id },
      });
    }
  }
  if (mural.length) {
    const { error } = await sb.from("aura_escritorio_mensagens").insert(mural);
    if (error) console.error("[gestor/agentes/diretora] mural:", error.message);
  }

  // 5. A resposta para o gestor.
  const textoResposta = lida.resposta ?? (semIA ? RESPOSTA_SEM_IA : respostaPorRegra(encaminhados.map((e) => e.agenteNome)));
  const { data: resposta, error: erroResposta } = await sb
    .from("aura_escritorio_mensagens")
    .insert({
      de_agente: diretora.id,
      para_agente: gestor,
      tipo: "resposta",
      texto: textoResposta,
      empresa: quem.empresa || null,
      dados: { conversaComGestor: true, respondendo: pergunta.id, encaminhados, proposta, semIA },
      lida_por_agente: true,
    })
    .select(CAMPOS)
    .single();
  if (erroResposta) throw new Error(`Não consegui guardar a resposta da Diretora: ${erroResposta.message}`);

  return { pergunta: mensagemDaConversa(pergunta as Linha, gestor), resposta: mensagemDaConversa(resposta as Linha, gestor) };
}
