"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Clock, Loader2, MessageSquare, Send, ShieldOff } from "lucide-react";
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
}

interface Mensagem {
  id: string;
  de_mim: boolean;
  texto: string | null;
  tipo: string;
  midia_url: string | null;
  criado_em: string;
}

interface Comentario {
  id: string;
  comentario_id: string;
  autor_usuario: string | null;
  texto: string;
  respondido: boolean;
  post_url: string | null;
  criado_em: string;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

export default function InstagramPage() {
  const [aba, setAba] = useState<"mensagens" | "comentarios">("mensagens");
  const [conectada, setConectada] = useState(false);
  const [usuario, setUsuario] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/meta/live", { cache: "no-store" });
      const d = await res.json();
      if (res.status === 403) {
        setSemAcesso(true);
        return;
      }
      if (!res.ok) throw new Error(d.erro ?? "Não consegui carregar.");
      setConectada(Boolean(d.conectada));
      setUsuario(d.usuario ?? null);
      setConversas(d.conversas ?? []);
      setComentarios(d.comentarios ?? []);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 15000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (!selecionada) return;
    let vivo = true;
    async function puxar() {
      const res = await fetch(`/api/meta/live?conversa=${encodeURIComponent(selecionada!)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (vivo && res.ok) setMensagens(d.mensagens ?? []);
    }
    void puxar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void puxar();
    }, 8000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [selecionada]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const atual = conversas.find((c) => c.id === selecionada) ?? null;

  async function responder() {
    const t = texto.trim();
    if (!t || !selecionada || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/meta/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "responder", conversa: selecionada, texto: t }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro ?? "Não consegui enviar.");
      setTexto("");
      void carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function responderComentario(comentarioId: string, resposta: string) {
    const res = await fetch("/api/meta/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "responder_comentario", comentario: comentarioId, texto: resposta }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErro(d.erro ?? "Não consegui responder.");
    void carregar();
  }

  if (semAcesso) {
    return (
      <PageContainer largura="estreita">
        <EstadoVazio
          icone={ShieldOff}
          titulo="Instagram não liberado"
          className="mt-10"
          descricao="Em cada loja quem responde o Instagram é o vendedor interno. Se for para ser você, peça ao gestor para ligar seu acesso em Painel do Gestor → Instagram."
        />
      </PageContainer>
    );
  }

  if (carregando)
    return (
      <PageContainer>
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-aura-graphite-soft">
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
        descricao={conectada ? `Conta ${usuario ? `@${usuario}` : "da loja"} conectada.` : "A conta desta loja ainda não foi conectada pelo gestor."}
        acoes={
          <Segmentado<"mensagens" | "comentarios">
            rotulo="Seção do Instagram"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "mensagens", rotulo: "Mensagens", contagem: conversas.length },
              { valor: "comentarios", rotulo: "Comentários", contagem: comentarios.length },
            ]}
          />
        }
      />

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
          <div className="aura-card overflow-hidden">
            {conversas.length === 0 ? (
              <p className="p-6 text-center text-sm text-aura-graphite-soft">
                Nenhuma conversa ainda. No Instagram é sempre o cliente que escreve primeiro.
              </p>
            ) : (
              <ul className="divide-y divide-aura-mist">
                {conversas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionada(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-aura-sunken/60 ${
                        selecionada === c.id ? "bg-aura-sunken" : ""
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-500/10 text-sm font-semibold text-aura-petrol-600">
                        {(c.cliente_nome ?? c.cliente_usuario ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-aura-graphite">
                            {c.cliente_nome ?? (c.cliente_usuario ? `@${c.cliente_usuario}` : "Cliente")}
                          </span>
                          <span className="shrink-0 text-xs text-aura-graphite-soft">{hora(c.ultima_em)}</span>
                        </span>
                        <span className="truncate text-xs text-aura-graphite-soft">{c.ultima_mensagem}</span>
                        {c.prazo ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-aura-warning">
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
                        <span className="ml-1 shrink-0 rounded-full bg-aura-petrol-600 px-1.5 py-px text-[0.65rem] font-semibold tabular-nums text-white">
                          {c.nao_lidas}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="aura-card flex min-h-[420px] flex-col overflow-hidden">
            {!atual ? (
              <p className="m-auto text-sm text-aura-graphite-soft">Escolha uma conversa ao lado.</p>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {mensagens.map((m) => (
                    <div key={m.id} className={`flex ${m.de_mim ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          m.de_mim ? "bg-aura-petrol-600 text-white" : "bg-aura-sunken text-aura-graphite"
                        }`}
                      >
                        {m.midia_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.midia_url} alt="" className="mb-1 max-h-64 rounded-lg" />
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                        <p className={`mt-0.5 text-[11px] ${m.de_mim ? "text-white/70" : "text-aura-graphite-soft"}`}>
                          {hora(m.criado_em)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={fimRef} />
                </div>

                {atual.podeResponder ? (
                  <div className="flex items-end gap-2 border-t border-aura-mist p-3">
                    <textarea
                      rows={1}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void responder();
                        }
                      }}
                      placeholder="Responder…"
                      className="aura-input max-h-32 flex-1 resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => void responder()}
                      disabled={enviando || !texto.trim()}
                      aria-label="Enviar"
                      className={classeBotao("primario", "md", "w-10 shrink-0 px-0")}
                    >
                      {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                ) : (
                  <p className="border-t border-aura-mist p-4 text-center text-sm text-aura-graphite-soft">
                    O prazo de 24 horas para responder terminou. O Instagram só libera de novo quando
                    esta pessoa escrever outra vez.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="aura-card overflow-hidden">
          {comentarios.length === 0 ? (
            <p className="p-6 text-center text-sm text-aura-graphite-soft">
              Nenhum comentário ainda. Eles aparecem aqui assim que alguém comentar numa publicação da loja.
            </p>
          ) : (
            <ul className="divide-y divide-aura-mist">
              {comentarios.map((c) => (
                <ComentarioItem key={c.id} comentario={c} onResponder={responderComentario} />
              ))}
            </ul>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function ComentarioItem({
  comentario,
  onResponder,
}: {
  comentario: Comentario;
  onResponder: (id: string, texto: string) => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState("");

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-aura-graphite">
            {comentario.autor_usuario ? `@${comentario.autor_usuario}` : "Alguém"}
            {comentario.respondido && (
              <Selo tom="sucesso" className="ml-2">
                respondido
              </Selo>
            )}
          </p>
          <p className="mt-0.5 text-sm text-aura-graphite-soft">{comentario.texto}</p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className={classeBotao("secundario", "sm", "shrink-0")}
        >
          <MessageSquare size={12} />
          Responder
        </button>
      </div>
      {aberto && (
        <div className="mt-3 flex gap-2">
          <input
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Sua resposta pública no comentário"
            className="aura-input flex-1"
          />
          <button
            type="button"
            onClick={() => {
              if (!resposta.trim()) return;
              void onResponder(comentario.comentario_id, resposta.trim());
              setResposta("");
              setAberto(false);
            }}
            className={classeBotao("primario")}
          >
            Enviar
          </button>
        </div>
      )}
    </li>
  );
}
