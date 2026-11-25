"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  History,
  Lightbulb,
  Star,
  Link2,
  Loader2,
  RefreshCw,
  Tags,
  Target,
  UserPlus,
  X,
} from "lucide-react";
import { estiloDaEtapa, postJson, type Alerta, type Etapa, type LeadInfo } from "./types";
import { listarLinksParaWhatsapp, textoParaWhatsapp, type LinkUtil } from "@/lib/supabase/links";
import { montarMensagensDeAvaliacao } from "@/lib/avaliacoes/mensagens";
import {
  ehGanho,
  ehPerda,
  ehPosVenda,
  etapasVisiveis,
  FUNIL_PADRAO,
  nomeDaChave,
  type EtapaFunil,
} from "@/lib/funil";
import {
  CATEGORIAS_CONTATO,
  INFO_CATEGORIA,
  INFO_NATUREZA,
  MOTIVOS_NAO_LEAD,
  NATUREZAS,
  PALPITES_DE_CLIENTE_ANTIGO,
} from "@/lib/categoria-contato";

interface ConfigAvaliacao {
  empresa: string;
  link_google: string | null;
  link_instagram: string | null;
  link_facebook: string | null;
  mensagem_padrao: string | null;
  mensagem_redes: string | null;
}

interface PedidoAvaliacao {
  id: string;
  empresa: string;
  cliente: string | null;
  token: string;
  enviado_em: string | null;
  confirmado_em: string | null;
}

const SIGLA_DA_LOJA: Record<string, string> = {
  "LF Lareiras": "LF",
  "A&G Aquecimento": "A&G",
  "Sole Aquecimento": "Sole",
  "MF International": "MF",
};

interface Props {
  chatId: string;
  /** Nome e telefone da conversa, para achar o pedido de avaliação. */
  nomeDoContato?: string;
  telefoneDoContato?: string;
  lead: LeadInfo | null;
  alertas: Alerta[];
  /** O funil da loja, como veio da API. Sem ele, o padrão. */
  funil?: EtapaFunil[];
  onClose: () => void;
  onChanged: () => void;
  /**
   * Põe um texto no campo de mensagem da conversa (não envia). Usado pelos
   * atalhos de catálogo e links da loja, para o vendedor conferir e enviar.
   */
  onUsarTexto?: (texto: string) => void;
}

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#111b21] px-5 py-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[#00a884]">
        {icone}
        {titulo}
      </h4>
      {children}
    </section>
  );
}

export function SupervisorPanel({
  chatId,
  nomeDoContato,
  telefoneDoContato,
  lead,
  alertas,
  funil = FUNIL_PADRAO,
  onClose,
  onChanged,
  onUsarTexto,
}: Props) {
  // Catálogo e outros links da loja que o gestor marcou com frase para o
  // WhatsApp. Lista curta, carregada uma vez por painel aberto.
  const [atalhos, setAtalhos] = useState<LinkUtil[]>([]);
  useEffect(() => {
    let vivo = true;
    void listarLinksParaWhatsapp().then((l) => vivo && setAtalhos(l));
    return () => {
      vivo = false;
    };
  }, []);
  // Avaliação: o link de cada loja (para o "Enviar rápido") e o pedido deste
  // cliente, quando a venda já foi lançada.
  const [avaliacao, setAvaliacao] = useState<{
    empresa: string | null;
    todas: boolean;
    configs: ConfigAvaliacao[];
    pedido: PedidoAvaliacao | null;
  } | null>(null);
  const [avaliacaoEnviada, setAvaliacaoEnviada] = useState(false);
  const relacionamentoId = lead?.relacionamentoId ?? "";
  useEffect(() => {
    let vivo = true;
    setAvaliacaoEnviada(false);
    const q = new URLSearchParams({
      relacionamento: relacionamentoId,
      telefone: telefoneDoContato ?? "",
      nome: nomeDoContato ?? "",
    });
    fetch(`/api/avaliacoes/contato?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && j && setAvaliacao({ empresa: j.empresa ?? null, todas: !!j.todas, configs: j.configs ?? [], pedido: j.pedido ?? null }))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [chatId, relacionamentoId, telefoneDoContato, nomeDoContato]);

  /** As mensagens de avaliação de uma loja, com o link certo. */
  function mensagensDeAvaliacao(config: ConfigAvaliacao, pedido: PedidoAvaliacao | null) {
    // Com pedido, o link passa pelo AURA (/av/...) e o gestor vê quem abriu.
    const link = pedido ? `${window.location.origin}/av/${pedido.token}` : (config.link_google ?? "");
    return montarMensagensDeAvaliacao(config, nomeDoContato ?? pedido?.cliente ?? "", link);
  }

  async function usarAvaliacao(texto: string) {
    onUsarTexto?.(texto);
    const p = avaliacao?.pedido;
    if (p && !p.enviado_em && !avaliacaoEnviada) {
      setAvaliacaoEnviada(true);
      // Sai da lista de pendentes do Meu Dia: o texto já está na conversa.
      await fetch("/api/avaliacoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, enviado: true, canal: "whatsapp" }),
      }).catch(() => {});
    }
  }

  // Lojas com link de avaliação para o "Enviar rápido": a do vendedor; quem
  // enxerga o grupo todo vê uma por loja.
  const lojasComAvaliacao = (avaliacao?.configs ?? []).filter(
    (c) => c.link_google && (avaliacao?.todas || c.empresa === avaliacao?.empresa),
  );
  const configDoPedido =
    avaliacao?.configs.find((c) => c.empresa === (avaliacao.pedido?.empresa ?? avaliacao.empresa)) ?? lojasComAvaliacao[0] ?? null;

  // As etapas do caminho normal: as abertas mais a de ganho. Perdidos fica
  // fora da lista numerada porque perder não é um passo do caminho — tem
  // botão próprio embaixo.
  const etapasDoCaminho = etapasVisiveis(funil).filter(
    (e) => e.tipo === "aberta" || e.tipo === "ganho",
  );
  const nomeDePerda = nomeDaChave("perda", funil) ?? "Perdidos";
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function acao(nome: string, payload: Record<string, unknown>) {
    setOcupado(nome);
    setErro(null);
    try {
      await postJson({ chat: chatId, ...payload });
      onChanged();
    } catch (e: any) {
      setErro(e?.message ?? "Erro");
    } finally {
      setOcupado(null);
    }
  }

  const etapaAtual = (lead?.etapaPipeline ?? lead?.etapa) as Etapa | null;
  const idxAtual = etapaAtual ? etapasDoCaminho.findIndex((e) => e.nome === etapaAtual) : -1;
  const ehLead = !!lead && !lead.ignorado && (lead.ehLead || !!lead.oportunidadeId);
  // Venda fechada ou cliente antigo: some a cobrança (próxima ação, dicas do
  // manual) e aparece o pedido de avaliação.
  const fechado =
    ehGanho(etapaAtual, funil) || ehPosVenda(etapaAtual, funil) || lead?.natureza === "cliente" || !!avaliacao?.pedido;

  return (
    <aside className="flex h-full w-full flex-col border-l border-[#222d34] bg-[#0b141a] md:w-[360px]">
      <div className="flex h-[59px] items-center gap-4 bg-[#202c33] px-5">
        <button type="button" onClick={onClose} className="text-[#aebac1]" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#00a884]" />
          <h3 className="text-[16px] text-[#e9edef]">Supervisor AURA</h3>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pb-6">
        {/* Status da análise */}
        <div className="flex items-center justify-between bg-[#111b21] px-5 py-3 text-xs text-[#8696a0]">
          <span className="flex items-center gap-1.5">
            {lead?.analisando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a884]" /> Analisando conversa…
              </>
            ) : lead?.ultimaAnaliseEm ? (
              <>Analisado às {new Date(lead.ultimaAnaliseEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            ) : (
              "Ainda não analisado"
            )}
          </span>
          <button
            type="button"
            onClick={() => acao("analisar", { action: "analyze" })}
            disabled={!!ocupado || lead?.analisando}
            className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-[#00a884] hover:bg-[#202c33] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ocupado === "analisar" ? "animate-spin" : ""}`} /> Analisar agora
          </button>
        </div>

        {lead && !lead.iaDisponivel && (
          <p className="mx-4 rounded-lg bg-[#3d3219] px-3 py-2 text-xs text-[#ffd279]">
            IA desligada: falta uma chave válida da Anthropic no .env.local. Enquanto isso o supervisor usa as regras automáticas (palavras-chave e tempos de resposta).
          </p>
        )}
        {lead?.aviso && <p className="mx-4 rounded-lg bg-[#3d3219] px-3 py-2 text-xs text-[#ffd279]">{lead.aviso}</p>}
        {erro && <p className="mx-4 rounded-lg bg-[#3d1d22] px-3 py-2 text-xs text-[#f15c6d]">{erro}</p>}

        {/* Atalhos de envio: catálogo e links que o gestor cadastrou. Ficam no
            alto do painel porque são o que o vendedor mais manda; o texto cai
            no campo da conversa para ele conferir antes de enviar. */}
        {onUsarTexto && fechado && configDoPedido && (
          <Secao icone={<Star className="h-4 w-4 text-[#ffd279]" />} titulo="Pedir avaliação">
            {configDoPedido.link_google ? (
              <>
                <p className="text-xs text-[#aebac1]">
                  {avaliacao?.pedido?.confirmado_em
                    ? "Este cliente já avaliou. Obrigado!"
                    : avaliacao?.pedido?.enviado_em || avaliacaoEnviada
                      ? "O pedido de avaliação já foi para a conversa. Pode mandar de novo se precisar."
                      : "Venda fechada: peça a avaliação no Google enquanto o cliente está feliz."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(() => {
                    const msgs = mensagensDeAvaliacao(configDoPedido, avaliacao?.pedido ?? null);
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => usarAvaliacao(msgs[0])}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#00a884] px-3 py-1.5 text-[13px] font-medium text-[#111b21] hover:bg-[#06cf9c]"
                        >
                          <Star className="h-3.5 w-3.5" /> Avaliação no Google
                        </button>
                        {msgs[1] && (
                          <button
                            type="button"
                            onClick={() => onUsarTexto(msgs[1])}
                            className="rounded-full border border-[#00a884]/50 px-3 py-1.5 text-[13px] text-[#00a884] hover:bg-[#00a884]/10"
                          >
                            Convite para as redes
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
                <p className="mt-2 text-[11px] text-[#8696a0]">
                  Mande primeiro a avaliação, depois o convite. O texto vai para o campo de mensagem; confira e envie.
                </p>
              </>
            ) : (
              <p className="text-xs text-[#ffd279]">
                A loja {configDoPedido.empresa} ainda não tem o link de avaliação. O gestor cadastra em Painel do Gestor → Avaliações.
              </p>
            )}
          </Secao>
        )}

        {onUsarTexto && (atalhos.length > 0 || lojasComAvaliacao.length > 0) && (
          <Secao icone={<Link2 className="h-4 w-4" />} titulo="Enviar rápido">
            <div className="flex flex-wrap gap-2">
              {lojasComAvaliacao.map((c) => (
                <button
                  key={`aval-${c.empresa}`}
                  type="button"
                  onClick={() => {
                    // Se o pedido deste cliente é desta loja, vai o link que
                    // registra (e o pedido sai dos pendentes); senão, o link puro.
                    const doPedido = avaliacao?.pedido && avaliacao.pedido.empresa === c.empresa ? avaliacao.pedido : null;
                    const texto = mensagensDeAvaliacao(c, doPedido)[0];
                    if (doPedido) void usarAvaliacao(texto);
                    else onUsarTexto(texto);
                  }}
                  title={`Pedido de avaliação no Google da ${c.empresa}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#ffd279]/50 px-3 py-1.5 text-[13px] text-[#ffd279] hover:bg-[#ffd279]/10"
                >
                  <Star className="h-3.5 w-3.5" />
                  {lojasComAvaliacao.length > 1 ? `Avaliação ${SIGLA_DA_LOJA[c.empresa] ?? c.empresa}` : "Avaliação Google"}
                </button>
              ))}
              {atalhos.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onUsarTexto(textoParaWhatsapp(l))}
                  title={l.mensagemWhatsapp ?? l.url}
                  className="rounded-full border border-[#00a884]/50 px-3 py-1.5 text-[13px] text-[#00a884] hover:bg-[#00a884]/10"
                >
                  {l.titulo}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#8696a0]">
              O texto vai para o campo de mensagem; confira e envie. O gestor edita a lista em Configurações.
            </p>
          </Secao>
        )}

        {/* Alertas de atendimento */}
        {(alertas.length > 0 || (lead?.alertasIa.length ?? 0) > 0) && (
          <Secao icone={<AlertTriangle className="h-4 w-4 text-[#f15c6d]" />} titulo="Atenção">
            <ul className="space-y-1.5">
              {alertas.map((a) => (
                <li
                  key={a.tipo + a.desde}
                  className={`rounded-md px-3 py-2 text-sm ${
                    a.nivel === "critico" ? "bg-[#3d1d22] text-[#f15c6d]" : a.nivel === "alto" ? "bg-[#3d2a19] text-[#ffa65c]" : "bg-[#3d3219] text-[#ffd279]"
                  }`}
                >
                  {a.texto}
                </li>
              ))}
              {lead?.alertasIa.map((t, i) => (
                <li key={i} className="rounded-md bg-[#3d1d22] px-3 py-2 text-sm text-[#f15c6d]">
                  {t}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {/*
          O QUE E ESTE CONTATO — sempre visivel.

          Antes, a unica forma de dizer "nao e lead" era um botao que so
          aparecia quando a propria AURA tinha chutado que era. Quem sabia de
          saida que o numero era o instalador, o colega ou o chefe nao tinha
          onde dizer isso, e a IA seguia tratando como venda nova.

          Sao dois eixos independentes: a natureza decide se entra no pipeline,
          a categoria e so a etiqueta de como se fala com ele.
        */}
        <Secao icone={<Tags className="h-4 w-4" />} titulo="O que é este contato">
          <div className="flex flex-wrap gap-2">
            {NATUREZAS.map((n) => {
              const info = INFO_NATUREZA[n];
              const marcada = lead?.natureza === n;
              return (
                <button
                  key={n}
                  type="button"
                  title={info.descricao}
                  disabled={!!ocupado}
                  onClick={() => acao(`nat-${n}`, { action: "classify", natureza: n })}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                  style={
                    marcada
                      ? { background: info.fundo, borderColor: info.cor, color: info.cor }
                      : { background: "transparent", borderColor: "#2a3942", color: "#8696a0" }
                  }
                >
                  {ocupado === `nat-${n}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {info.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-[#8696a0]">
            {lead?.natureza
              ? INFO_NATUREZA[lead.natureza].descricao
              : "Ninguém decidiu ainda. Enquanto isso a AURA pergunta em vez de criar lead."}
          </p>

          {/* Por que nao e lead: a AURA usa isto para aprender o padrao. */}
          {lead?.natureza === "nao_lead" && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-[#8696a0]">
                O que ele é? {lead.motivoNatureza ? "" : "(a AURA aprende com isso)"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_NAO_LEAD.map((m) => {
                  const marcado = lead.motivoNatureza === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!!ocupado}
                      onClick={() => acao(`mot-${m}`, { action: "classify", motivo: m })}
                      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${
                        marcado
                          ? "border-[#8696a0] bg-[#202c33] text-[#e9edef]"
                          : "border-[#2a3942] text-[#8696a0] hover:bg-[#202c33]"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categoria: a etiqueta que aparece ao lado do nome na lista. */}
          {lead?.natureza !== "nao_lead" && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-[#8696a0]">
                Categoria
                {!lead?.categoria && lead?.categoriaSugerida
                  ? ` — a AURA achou que é ${lead.categoriaSugerida}, confirme`
                  : " — vira a etiqueta na lista de conversas"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS_CONTATO.map((c) => {
                  const info = INFO_CATEGORIA[c];
                  const marcada = lead?.categoria === c;
                  const sugerida = !lead?.categoria && lead?.categoriaSugerida === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={!!ocupado}
                      onClick={() => acao(`cat-${c}`, { action: "classify", categoria: marcada ? null : c })}
                      title={marcada ? "Clique para tirar a etiqueta" : `Marcar como ${c}`}
                      className="rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60"
                      style={
                        marcada
                          ? { background: info.fundo, borderColor: info.cor, color: info.cor }
                          : sugerida
                          ? { background: "transparent", borderColor: info.cor, color: info.cor, borderStyle: "dashed" }
                          : { background: "transparent", borderColor: "#2a3942", color: "#8696a0" }
                      }
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Secao>

        {!ehLead ? (
          <Secao
            icone={<UserPlus className="h-4 w-4" />}
            titulo={lead?.leadSugerido ? "É um lead?" : "Lead no CRM"}
          >
            {/*
              Antes a AURA criava o lead sozinha sempre que achasse a conversa
              comercial, e o pipeline enchia de papo de amigo e suporte
              técnico. Agora, quando ela não tem certeza, pergunta em vez de
              decidir — quem conhece o contato é o vendedor.
            */}
            <p className="text-sm text-[#8696a0]">
              {lead?.natureza === "cliente"
                ? "Cliente antigo. Foi para o pós-venda da loja (coluna Clientes antigos) e saiu do funil e dos alertas de lead. Continua na sua carteira."
                : lead?.natureza === "nao_lead" || lead?.ignorado
                ? `Marcado como não sendo lead${lead?.motivoNatureza ? ` (${lead.motivoNatureza})` : ""}. A AURA não acompanha e não sugere mais.`
                : lead?.analisando
                ? "Verificando se é uma conversa comercial…"
                : lead?.leadSugerido
                ? (lead.motivoSugestao ??
                  "A AURA achou que isto pode ser um cliente, mas não teve certeza.")
                : "A IA não identificou esta conversa como um lead."}
            </p>

            {/*
              O "nao e" e os tres estados moram na secao "O que e este contato",
              logo acima, que aparece sempre. Aqui fica so a confirmacao do que
              a AURA sugeriu, que e o atalho do dia a dia.
            */}
            {/*
              A AURA achou que é cliente antigo (o número já comprou da casa,
              ou a conversa é de quem já tem a lareira). Um toque manda para o
              pós-venda; "Tratar como lead" continua ali para compra nova.
            */}
            {!lead?.natureza && PALPITES_DE_CLIENTE_ANTIGO.some((p) => p === lead?.motivoNatureza) && (
              <div className="mt-3 rounded-md border border-[#53bdeb]/40 bg-[#0d2b36] px-3 py-2.5">
                <p className="text-sm text-[#e9edef]">
                  Parece cliente antigo: já comprou da casa ou fala do que já tem instalado.
                </p>
                <button
                  type="button"
                  onClick={() => acao("nat-cliente", { action: "classify", natureza: "cliente" })}
                  disabled={!!ocupado}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#53bdeb] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#7fd1ff] disabled:opacity-60"
                >
                  {ocupado === "nat-cliente" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sim, cliente antigo · pós-venda
                </button>
              </div>
            )}

            <div className="mt-3">
              <button
                type="button"
                onClick={() => acao("lead", { action: "classify", natureza: "lead" })}
                disabled={!!ocupado}
                className="inline-flex items-center gap-2 rounded-full bg-[#00a884] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#06cf9c] disabled:opacity-60"
              >
                {ocupado === "lead" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {lead?.leadSugerido ? "Sim, é um lead" : "Tratar como lead"}
              </button>
            </div>
          </Secao>
        ) : (
          <>
            {/* Funil */}
            <Secao icone={<Target className="h-4 w-4" />} titulo="Etapa no pipeline">
              <ol className="space-y-1">
                {etapasDoCaminho.map(({ nome: e }, i) => {
                  const feito = idxAtual >= 0 && i < idxAtual;
                  const atual = i === idxAtual;
                  return (
                    <li key={e}>
                      <button
                        type="button"
                        disabled={!!ocupado || atual}
                        onClick={() => acao(`etapa-${e}`, { action: "stage", etapa: e })}
                        title={atual ? "Etapa atual" : `Mover para ${e}`}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          atual ? "bg-[#0a332c] font-medium text-[#e9edef]" : "text-[#aebac1] hover:bg-[#202c33]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                            atual ? "border-[#00a884] bg-[#00a884] text-[#111b21]" : feito ? "border-[#00a884] text-[#00a884]" : "border-[#3b4a54]"
                          }`}
                        >
                          {feito ? <CheckCircle2 className="h-4 w-4" /> : ocupado === `etapa-${e}` ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                        </span>
                        {e}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => acao(`etapa-${nomeDePerda}`, { action: "stage", etapa: nomeDePerda })}
                  style={ehPerda(etapaAtual, funil) ? estiloDaEtapa("#f15c6d") : undefined}
                  className="rounded-full px-2 py-1 text-[#f15c6d] hover:bg-[#3d1d22]"
                >
                  {ehPerda(etapaAtual, funil) ? "Marcado como perdido" : "Marcar como perdido"}
                </button>
                <Link href="/pipeline" className="flex items-center gap-1 text-[#00a884] hover:underline">
                  Abrir pipeline <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="mt-2 text-xs text-[#8696a0]">
                A IA avança o card sozinha conforme a conversa (apresentação, orçamento, negociação, fechamento). Clique numa etapa para corrigir.
              </p>
            </Secao>

            {lead?.proximaAcao && !fechado && (
              <Secao icone={<Target className="h-4 w-4" />} titulo="Próxima ação">
                <p className="text-sm text-[#e9edef]">{lead.proximaAcao}</p>
              </Secao>
            )}

            {lead?.resumo && (
              <Secao icone={<Bot className="h-4 w-4" />} titulo="Resumo do lead">
                <p className="text-sm text-[#e9edef]">{lead.resumo}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {lead.interesse && <span className="rounded-full bg-[#202c33] px-2 py-1 text-[#aebac1]">Interesse: {lead.interesse}</span>}
                  {lead.valorEstimado ? (
                    <span className="rounded-full bg-[#202c33] px-2 py-1 text-[#aebac1]">
                      ~ {lead.valorEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </span>
                  ) : null}
                </div>
              </Secao>
            )}

            {lead && lead.dicas.length > 0 && !fechado && (
              <Secao icone={<Lightbulb className="h-4 w-4 text-[#ffd279]" />} titulo="Dicas do manual">
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-[#e9edef]">
                  {lead.dicas.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </Secao>
            )}

            {lead && lead.historico.length > 0 && (
              <Secao icone={<History className="h-4 w-4" />} titulo="Movimentações">
                <ul className="space-y-2">
                  {[...lead.historico].reverse().map((h, i) => (
                    <li key={i} className="text-xs text-[#aebac1]">
                      <span className="font-medium text-[#e9edef]">
                        {h.de ? `${h.de} → ${h.para}` : h.para}
                      </span>{" "}
                      · {new Date(h.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {h.fonte === "ia" ? " · IA" : h.fonte === "regras" ? " · automático" : " · manual"}
                      {h.evidencia && <p className="mt-0.5 italic text-[#8696a0]">“{h.evidencia}”</p>}
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

          </>
        )}
      </div>
    </aside>
  );
}
