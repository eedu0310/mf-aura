"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AtSign,
  Bot,
  Clock,
  Download,
  EyeOff,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Reply,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { ComposerInstagram } from "@/components/instagram/composer-instagram";
import { Alerta, EstadoVazio, PageContainer, PageHeader, Segmentado, Selo, classeBotao } from "@/components/ui";

/**
 * O Instagram da loja, dentro do AURA.
 *
 * Duas abas: as mensagens diretas e os comentários das publicações. O que
 * mais muda em relação ao WhatsApp é o prazo: aqui não se puxa conversa, e a
 * resposta vale 24 horas a partir da última mensagem do cliente. Por isso o
 * prazo aparece em cada conversa e o campo some quando ele vence — melhor
 * dizer antes do que deixar a pessoa escrever e levar erro.
 */

interface Conversa {
  id: string;
  cliente_nome: string | null;
  cliente_usuario: string | null;
  cliente_foto: string | null;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  nao_lidas: number;
  podeResponder: boolean;
  prazo: string | null;
  ia_pausada?: boolean;
  ia_respondeu_em?: string | null;
}

interface Mensagem {
  id: string;
  de_mim: boolean;
  texto: string | null;
  tipo: string;
  midia_url: string | null;
  criado_em: string;
  mid: string | null;
  por_ia?: boolean;
  autor_nome?: string | null;
  reacao?: string | null;
  reacao_cliente?: string | null;
}

interface Comentario {
  id: string;
  comentario_id: string;
  autor_usuario: string | null;
  texto: string;
  respondido: boolean;
  post_url: string | null;
  criado_em: string;
  oculto?: boolean;
  resposta_privada?: boolean;
  respondido_por_ia?: boolean;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

const SIGLA: Record<string, string> = {
  "LF Lareiras": "LF Lareiras",
  "A&G Aquecimento": "A&G",
  "Sole Aquecimento": "Sole",
  "MF International": "MF",
};

export default function InstagramPage() {
  const [aba, setAba] = useState<"mensagens" | "comentarios">("mensagens");
  // Uma sub-aba por conta conectada que a pessoa enxerga (o gestor mestre vê
  // todas). A escolhida fica lembrada neste navegador.
  const [contas, setContas] = useState<{ empresa: string; usuario: string | null }[]>([]);
  const [loja, setLoja] = useState<string | null>(() => {
    try {
      return localStorage.getItem("aura:instagram:loja");
    } catch {
      return null;
    }
  });
  const [gestor, setGestor] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conectada, setConectada] = useState(false);
  const [usuario, setUsuario] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [agente, setAgente] = useState<{ ativo: boolean; horas: number }>({ ativo: false, horas: 0 });
  const [soPendentes, setSoPendentes] = useState(true);
  const [respondendo, setRespondendo] = useState<{ id: string; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/meta/live${loja ? `?empresa=${encodeURIComponent(loja)}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (res.status === 403) {
        setSemAcesso(true);
        return;
      }
      if (!res.ok) throw new Error(d.erro ?? "Não consegui carregar.");
      setConectada(Boolean(d.conectada));
      setUsuario(d.usuario ?? null);
      setContas(d.contas ?? []);
      setGestor(Boolean(d.gestor));
      if (d.empresa && d.empresa !== loja) setLoja(d.empresa);
      setConversas(d.conversas ?? []);
      setComentarios(d.comentarios ?? []);
      setAgente(d.agente ?? { ativo: false, horas: 0 });
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, [loja]);

  function trocarLoja(empresa: string) {
    if (empresa === loja) return;
    try {
      localStorage.setItem("aura:instagram:loja", empresa);
    } catch {}
    setSelecionada(null);
    setMensagens([]);
    setAviso(null);
    setLoja(empresa);
  }

  async function puxarHistorico() {
    setImportando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/meta/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "importar", empresa: loja }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.erro ?? "Não consegui puxar o histórico.");
      setAviso(
        `Histórico atualizado: ${d.conversas ?? 0} conversas, ${d.mensagens ?? 0} mensagens e ${d.comentarios ?? 0} comentários.` +
          (d.avisos?.length ? ` Avisos da Meta: ${d.avisos.join(" · ")}` : ""),
      );
      void carregar();
    } catch (e: any) {
      setAviso(e?.message ?? "Não consegui puxar o histórico.");
    } finally {
      setImportando(false);
    }
  }

  useEffect(() => {
    void carregar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 15000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => setRespondendo(null), [selecionada]);

  const puxarMensagens = useCallback(async () => {
    if (!selecionada) return;
    const res = await fetch(`/api/meta/live?conversa=${encodeURIComponent(selecionada)}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setMensagens(d.mensagens ?? []);
  }, [selecionada]);

  useEffect(() => {
    if (!selecionada) return;
    let vivo = true;
    async function puxar() {
      if (vivo) await puxarMensagens();
    }
    void puxar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void puxar();
    }, 8000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [selecionada, puxarMensagens]);

  // Rola para o fim só quando chega mensagem nova (não a cada atualização).
  const ultimaId = mensagens[mensagens.length - 1]?.id;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ultimaId]);

  const atual = conversas.find((c) => c.id === selecionada) ?? null;

  async function acao(corpo: Record<string, unknown>, falha: string) {
    setErro(null);
    const res = await fetch("/api/meta/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...corpo, empresa: loja }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(d.erro ?? falha);
      return false;
    }
    return true;
  }

  async function reagir(m: Mensagem) {
    if (!selecionada) return;
    // Mostra já; se a Meta recusar, a próxima atualização desfaz.
    setMensagens((l) => l.map((x) => (x.id === m.id ? { ...x, reacao: x.reacao ? null : "❤️" } : x)));
    await acao({ acao: "reagir", conversa: selecionada, mensagem: m.id, ligar: !m.reacao }, "Não consegui reagir.");
    void puxarMensagens();
  }

  const [chamandoAgente, setChamandoAgente] = useState(false);
  async function agenteAgora() {
    if (!selecionada || chamandoAgente) return;
    setChamandoAgente(true);
    try {
      if (await acao({ acao: "agente_agora", conversa: selecionada }, "O agente não conseguiu responder.")) {
        void puxarMensagens();
        void carregar();
      }
    } finally {
      setChamandoAgente(false);
    }
  }

  async function pausarAgente(pausada: boolean) {
    if (!selecionada) return;
    if (await acao({ acao: "pausar_ia", conversa: selecionada, pausada }, "Não consegui mudar o agente.")) void carregar();
  }

  async function comentarioAcao(corpo: Record<string, unknown>, falha: string) {
    const ok = await acao(corpo, falha);
    void carregar();
    return ok;
  }

  const comentariosVisiveis = soPendentes ? comentarios.filter((c) => !c.respondido) : comentarios;

  if (semAcesso) {
    return (
      <PageContainer largura="estreita">
        <EstadoVazio
          icone={ShieldOff}
          titulo={<span className="font-display text-base font-semibold">Instagram não liberado</span>}
          descricao={
            <>
              Em cada loja quem responde o Instagram é o vendedor interno. Se for para ser você, peça ao
              gestor para ligar seu acesso em Painel do Gestor → Instagram.
            </>
          }
          className="mt-10 bg-aura-surface py-14"
        />
      </PageContainer>
    );
  }

  if (carregando)
    return (
      <PageContainer>
        <p className="flex items-center justify-center gap-2 py-20 text-center text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" />
          Carregando…
        </p>
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        titulo="Instagram"
        icone={AtSign}
        descricao={
          conectada ? `Conta ${usuario ? `@${usuario}` : "da loja"} conectada.` : "A conta desta loja ainda não foi conectada pelo gestor."
        }
        acoes={
          <Segmentado
            rotulo="Mensagens ou comentários"
            valor={aba}
            aoMudar={setAba}
            opcoes={(["mensagens", "comentarios"] as const).map((id) => ({
              valor: id,
              rotulo: id === "mensagens" ? `Mensagens (${conversas.length})` : `Comentários (${comentarios.length})`,
            }))}
          />
        }
      />

      {(contas.length > 1 || (gestor && conectada)) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {contas.length > 1 && (
            <div className="aura-segmentado max-w-full overflow-x-auto" role="tablist" aria-label="Contas do Instagram">
              {contas.map((c) => (
                <button
                  key={c.empresa}
                  type="button"
                  role="tab"
                  aria-selected={c.empresa === loja}
                  onClick={() => trocarLoja(c.empresa)}
                  className="aura-segmento"
                >
                  {SIGLA[c.empresa] ?? c.empresa}
                  {c.usuario && <span className="ml-1 font-normal text-aura-graphite-soft">@{c.usuario}</span>}
                </button>
              ))}
            </div>
          )}

          {gestor && conectada && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void puxarHistorico()}
                disabled={importando}
                className={classeBotao("secundario", "sm")}
              >
                {importando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Puxar histórico do Instagram
              </button>
              {aviso && <span className="text-xs text-aura-graphite-soft">{aviso}</span>}
            </div>
          )}
        </div>
      )}

      {erro && <Alerta tom="perigo" titulo={erro} className="mb-4" />}

      {!conectada && (
        <Alerta
          tom="atencao"
          className="mb-4"
          titulo="Enquanto a conta não for conectada, nada chega aqui. Quem conecta é o gestor mestre, em Painel do Gestor → Instagram."
        />
      )}

      {aba === "mensagens" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="aura-card self-start overflow-hidden">
            {conversas.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-aura-graphite-soft">
                Nenhuma conversa ainda. No Instagram é sempre o cliente que escreve primeiro.
              </p>
            ) : (
              <ul className="divide-y divide-aura-mist">
                {conversas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionada(c.id)}
                      className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-aura-sunken ${
                        selecionada === c.id
                          ? "bg-aura-sunken before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-aura-petrol-500"
                          : ""
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-500/12 text-sm font-semibold text-aura-petrol-600">
                        {(c.cliente_nome ?? c.cliente_usuario ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-aura-graphite">
                            {c.cliente_nome ?? (c.cliente_usuario ? `@${c.cliente_usuario}` : "Cliente")}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-aura-graphite-soft">{hora(c.ultima_em)}</span>
                        </span>
                        <span className="block truncate text-xs text-aura-graphite-soft">{c.ultima_mensagem}</span>
                        {c.prazo ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-aura-gold-700">
                            <Clock size={11} />
                            {c.prazo}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[11px] text-aura-graphite-soft">
                            Prazo encerrado — aguarde o cliente
                          </span>
                        )}
                      </span>
                      {c.nao_lidas > 0 && (
                        <span className="ml-1 shrink-0 rounded-full bg-aura-petrol-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-white">
                          {c.nao_lidas}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="aura-card flex min-h-[420px] min-w-0 flex-col overflow-hidden">
            {!atual ? (
              <div className="m-auto flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-sunken">
                  <MessageSquare size={18} className="text-aura-graphite-soft" />
                </span>
                <p className="text-sm text-aura-graphite-soft">Escolha uma conversa ao lado.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-aura-mist px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-500/12 text-sm font-semibold text-aura-petrol-600">
                      {(atual.cliente_nome ?? atual.cliente_usuario ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-aura-graphite">
                        {atual.cliente_nome ?? (atual.cliente_usuario ? `@${atual.cliente_usuario}` : "Cliente")}
                      </p>
                      <p className="text-xs text-aura-graphite-soft">
                        {atual.cliente_usuario && atual.cliente_nome ? `@${atual.cliente_usuario} · ` : ""}
                        {atual.prazo ?? "prazo de 24h encerrado"}
                      </p>
                    </div>
                  </div>
                  {agente.ativo && (
                    <div className="flex flex-wrap items-center gap-2">
                      {gestor && !atual.ia_pausada && atual.podeResponder && (
                        <button
                          type="button"
                          onClick={() => void agenteAgora()}
                          disabled={chamandoAgente}
                          className={classeBotao("primario", "sm")}
                          title="O agente responde agora, sem esperar o tempo configurado"
                        >
                          {chamandoAgente ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                          Agente responder agora
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void pausarAgente(!atual.ia_pausada)}
                        className={classeBotao("secundario", "sm", "h-auto min-h-[1.875rem] max-w-full whitespace-normal py-1 text-left")}
                        title={`O agente de IA responde se ninguém responder em ${agente.horas}h`}
                      >
                        {atual.ia_pausada ? <Play size={12} className="shrink-0" /> : <Pause size={12} className="shrink-0" />}
                        <Bot size={13} className="shrink-0 text-aura-petrol-600" />
                        {atual.ia_pausada ? "Agente pausado nesta conversa · retomar" : "Agente ligado · pausar nesta conversa"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-aura-bg/60 p-3 sm:p-4">
                  {mensagens.map((m) => (
                    <BolhaInstagram
                      key={m.id}
                      m={m}
                      podeReagir={atual.podeResponder}
                      onReagir={() => void reagir(m)}
                      onResponder={() => setRespondendo({ id: m.id, texto: m.texto || resumoTipo(m.tipo) })}
                    />
                  ))}
                  <div ref={fimRef} />
                </div>

                {atual.podeResponder ? (
                  <ComposerInstagram
                    conversa={atual.id}
                    empresa={loja}
                    respondendo={respondendo}
                    onCancelarResposta={() => setRespondendo(null)}
                    onEnviado={() => {
                      void puxarMensagens();
                      void carregar();
                    }}
                  />
                ) : (
                  <p className="flex items-start justify-center gap-2 border-t border-aura-mist bg-aura-sunken px-4 py-3.5 text-center text-xs leading-relaxed text-aura-graphite-soft">
                    <Clock size={13} className="mt-0.5 shrink-0" />
                    <span>
                      O prazo de 24 horas para responder terminou. O Instagram só libera de novo quando
                      esta pessoa escrever outra vez.
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="aura-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-aura-mist px-4 py-2.5">
            <Segmentado
              rotulo="Filtrar comentários"
              valor={soPendentes ? "pendentes" : "todos"}
              aoMudar={(v) => setSoPendentes(v === "pendentes")}
              opcoes={[
                { valor: "pendentes", rotulo: `Sem resposta (${comentarios.filter((c) => !c.respondido).length})` },
                { valor: "todos", rotulo: `Todos (${comentarios.length})` },
              ]}
            />
          </div>
          {comentariosVisiveis.length === 0 ? (
            <EstadoVazio
              icone={MessageSquare}
              className="m-4"
              titulo={
                comentarios.length === 0
                  ? "Nenhum comentário ainda. Eles aparecem aqui assim que alguém comentar numa publicação da loja."
                  : "Todos os comentários já foram respondidos."
              }
            />
          ) : (
            <ul className="divide-y divide-aura-mist">
              {comentariosVisiveis.map((c) => (
                <ComentarioItem key={c.id} comentario={c} onAcao={comentarioAcao} />
              ))}
            </ul>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function resumoTipo(tipo: string) {
  if (tipo === "image") return "📷 Foto";
  if (tipo === "video") return "🎬 Vídeo";
  if (tipo === "audio") return "🎤 Áudio";
  return "Mensagem";
}

function BolhaInstagram({
  m,
  podeReagir,
  onReagir,
  onResponder,
}: {
  m: Mensagem;
  podeReagir: boolean;
  onReagir: () => void;
  onResponder: () => void;
}) {
  if (m.tipo === "like_heart") {
    return (
      <div className={`flex ${m.de_mim ? "justify-end" : "justify-start"}`}>
        <span className="text-5xl" role="img" aria-label="Figurinha de coração">
          ❤️
        </span>
      </div>
    );
  }
  const quem = m.de_mim ? (m.por_ia ? "Agente de IA" : m.autor_nome ?? null) : null;
  const link = m.midia_url && ["share", "ig_reel", "reel", "story_mention", "file", "fallback"].includes(m.tipo);
  return (
    <div className={`group flex items-center gap-1 ${m.de_mim ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[85%] sm:max-w-[75%]">
        <div
          className={`rounded-xl px-3 py-2 text-sm text-aura-graphite ${
            m.de_mim
              ? m.por_ia
                ? "rounded-br-sm border border-dashed border-aura-petrol-500/35 bg-aura-petrol-500/10"
                : "rounded-br-sm border border-aura-petrol-500/20 bg-aura-petrol-500/12"
              : "rounded-bl-sm border border-aura-mist bg-aura-sunken"
          }`}
        >
          {quem &&
            (m.por_ia ? (
              <Selo tom="marca" className="mb-1">
                <Bot size={11} />
                {quem}
              </Selo>
            ) : (
              <p className="mb-0.5 text-[11px] font-medium text-aura-petrol-600">{quem}</p>
            ))}
          {m.midia_url && m.tipo === "image" && (
            <a href={m.midia_url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.midia_url} alt="Foto" className="mb-1 max-h-64 rounded-lg" />
            </a>
          )}
          {m.midia_url && m.tipo === "video" && <video src={m.midia_url} controls className="mb-1 max-h-64 max-w-full rounded-lg" />}
          {m.midia_url && m.tipo === "audio" && <audio src={m.midia_url} controls className="mb-1 w-56 max-w-full" />}
          {link && (
            <a
              href={m.midia_url!}
              target="_blank"
              rel="noreferrer"
              className="mb-1 inline-flex items-center gap-1 text-aura-petrol-600 underline underline-offset-2"
            >
              <ExternalLink size={12} />
              {m.tipo === "story_mention" ? "Marcou a loja num story" : "Abrir o que foi compartilhado"}
            </a>
          )}
          {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
          <p className={`mt-0.5 text-[11px] tabular-nums text-aura-graphite-soft ${m.de_mim ? "text-right" : ""}`}>{hora(m.criado_em)}</p>
        </div>
        {(m.de_mim ? m.reacao_cliente : m.reacao) && (
          <span
            className={`absolute -bottom-2 ${m.de_mim ? "left-1" : "right-1"} rounded-full border border-aura-mist bg-aura-surface px-1 text-xs shadow-sm`}
          >
            {m.de_mim ? m.reacao_cliente : m.reacao}
          </span>
        )}
      </div>
      {!m.de_mim && m.mid && podeReagir && (
        <button
          type="button"
          onClick={onResponder}
          className="rounded-md p-1.5 text-aura-graphite-soft opacity-0 transition hover:bg-aura-sunken hover:text-aura-petrol-600 group-hover:opacity-100 focus:opacity-100"
          aria-label="Responder esta mensagem"
          title="Responder"
        >
          <Reply size={15} />
        </button>
      )}
      {!m.de_mim && m.mid && podeReagir && (
        <button
          type="button"
          onClick={onReagir}
          className={`rounded-md p-1.5 transition hover:bg-aura-sunken ${m.reacao ? "text-aura-danger" : "text-aura-graphite-soft opacity-0 hover:text-aura-danger group-hover:opacity-100 focus:opacity-100"}`}
          aria-label={m.reacao ? "Tirar o coração" : "Reagir com coração"}
          title={m.reacao ? "Tirar o coração" : "Reagir com ❤️"}
        >
          <Heart size={15} fill={m.reacao ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

function ComentarioItem({
  comentario,
  onAcao,
}: {
  comentario: Comentario;
  onAcao: (corpo: Record<string, unknown>, falha: string) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<"publico" | "privado" | null>(null);
  const [resposta, setResposta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const c = comentario;

  async function enviar() {
    const t = resposta.trim();
    if (!t || !modo) return;
    setOcupado(true);
    const ok = await onAcao(
      { acao: modo === "publico" ? "responder_comentario" : "privado_comentario", comentario: c.comentario_id, texto: t },
      "Não consegui responder.",
    );
    setOcupado(false);
    if (ok) {
      setResposta("");
      setModo(null);
    }
  }

  async function apagar() {
    if (!window.confirm("Apagar este comentário do Instagram? Não tem como desfazer.")) return;
    setOcupado(true);
    await onAcao({ acao: "apagar_comentario", comentario: c.comentario_id }, "Não consegui apagar.");
    setOcupado(false);
  }

  const botao = classeBotao("secundario", "sm");

  return (
    <li className={`p-4 transition hover:bg-aura-sunken/40 ${c.oculto ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-aura-graphite">
            {c.autor_usuario ? `@${c.autor_usuario}` : "Alguém"}
            <span className="text-xs font-normal tabular-nums text-aura-graphite-soft">
              {new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            {c.respondido && <Selo tom="sucesso">respondido{c.respondido_por_ia ? " pelo agente" : ""}</Selo>}
            {c.resposta_privada && <Selo tom="marca">no privado</Selo>}
            {c.oculto && <Selo tom="neutro">oculto</Selo>}
          </p>
          <p className="mt-1 break-words text-sm text-aura-graphite-soft">{c.texto}</p>
          {c.post_url && (
            <a href={c.post_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-aura-petrol-600 hover:underline">
              <ExternalLink size={11} /> Ver a publicação
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setModo(modo === "publico" ? null : "publico")} className={botao}>
            <MessageSquare size={12} /> Responder
          </button>
          {!c.resposta_privada && (
            <button type="button" onClick={() => setModo(modo === "privado" ? null : "privado")} className={botao} title="Manda uma mensagem no direct de quem comentou">
              <Lock size={12} /> No privado
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void onAcao({ acao: "ocultar_comentario", comentario: c.comentario_id, oculto: !c.oculto }, "Não consegui ocultar.")}
            className={botao}
            title={c.oculto ? "Voltar a mostrar para todos" : "Esconder de todos, menos de quem comentou"}
          >
            {c.oculto ? <Eye size={12} /> : <EyeOff size={12} />} {c.oculto ? "Mostrar" : "Ocultar"}
          </button>
          <button type="button" disabled={ocupado} onClick={() => void apagar()} className={`${botao} hover:text-aura-danger`} aria-label="Apagar comentário">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {modo && (
        <div className="mt-3 rounded-lg border border-aura-mist bg-aura-sunken p-3">
          <p className="mb-2 text-[11px] text-aura-graphite-soft">
            {modo === "publico"
              ? "Resposta pública, embaixo do comentário."
              : "Vai para o direct de quem comentou. A Meta deixa uma por comentário, em até 7 dias."}
          </p>
          <div className="flex gap-2">
            <input
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void enviar();
              }}
              placeholder={modo === "publico" ? `Responder @${c.autor_usuario ?? ""}` : "Mensagem no direct"}
              className="aura-input min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={ocupado || !resposta.trim()}
              onClick={() => void enviar()}
              className={classeBotao("primario", "md", "shrink-0")}
            >
              {ocupado && <Loader2 size={14} className="animate-spin" />}
              Enviar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
