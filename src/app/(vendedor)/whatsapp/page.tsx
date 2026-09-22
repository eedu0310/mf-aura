"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCheck,
  Loader2,
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  QrCode,
  Search,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { Avatar } from "@/components/whatsapp-web/avatar";
import { Composer } from "@/components/whatsapp-web/composer";
import { MessageBubble } from "@/components/whatsapp-web/message-bubble";
import { SupervisorPanel } from "@/components/whatsapp-web/supervisor-panel";
import {
  API,
  COR_ETAPA,
  formatDayLabel,
  formatListTime,
  formatPhone,
  postJson,
  type Alerta,
  type LeadInfo,
  type WaChat,
  type WaMessage,
  type WaState,
} from "@/components/whatsapp-web/types";

type Filtro = "tudo" | "nao_lidas" | "leads" | "alertas";

// Fundo "doodle" do WhatsApp Web, desenhado em CSS (sem imagem externa).
const FUNDO_CHAT: React.CSSProperties = {
  backgroundColor: "#efeae2",
  backgroundImage:
    "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)",
  backgroundSize: "22px 22px, 34px 34px",
  backgroundPosition: "0 0, 11px 17px",
};

export default function WhatsAppPage() {
  const [state, setState] = useState<WaState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [alertasChat, setAlertasChat] = useState<Alerta[]>([]);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [painelIa, setPainelIa] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [menuAberto, setMenuAberto] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [novoNumero, setNovoNumero] = useState("");
  const [novoTexto, setNovoTexto] = useState("");
  const [novoErro, setNovoErro] = useState<string | null>(null);
  const [novoEnviando, setNovoEnviando] = useState(false);
  const [arrastado, setArrastado] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colarNoFim = useRef(true);

  const status = state?.status ?? "disconnected";
  const connected = status === "connected";
  const chats = useMemo(() => state?.chats ?? [], [state]);
  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  // ------------------------------------------------------------ dados
  const loadState = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setState(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Não foi possível falar com o servidor.");
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API}?chat=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages ?? []);
        setAlertasChat(data.alertas ?? []);
      }
    } catch {
      /* próximo ciclo */
    }
  }, []);

  const loadLead = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API}?lead=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setLead(data);
    } catch {
      /* próximo ciclo */
    }
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 1280) setPainelIa(true);
  }, []);

  useEffect(() => {
    loadState();
    const t = setInterval(loadState, status === "connected" ? 3000 : 1500);
    return () => clearInterval(t);
  }, [loadState, status]);

  useEffect(() => {
    setMessages([]);
    setLead(null);
    setAlertasChat([]);
    colarNoFim.current = true;
    if (!selectedChatId || !connected) return;
    loadMessages(selectedChatId);
    loadLead(selectedChatId);
    const t1 = setInterval(() => loadMessages(selectedChatId), 2000);
    const t2 = setInterval(() => loadLead(selectedChatId), 5000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [selectedChatId, connected, loadMessages, loadLead]);

  // Mantém a rolagem no fim quando chega mensagem (se o usuário já estava no fim).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && colarNoFim.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ------------------------------------------------------------ ações
  async function conectar() {
    setBusy(true);
    try {
      const data = await postJson({ action: "connect" });
      if (data?.status) setState((s) => (s ? { ...s, ...data } : s));
      loadState();
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function desconectar() {
    setMenuAberto(false);
    if (!window.confirm("Desconectar o WhatsApp deste computador?")) return;
    setBusy(true);
    try {
      await postJson({ action: "logout" });
      setSelectedChatId(null);
      await loadState();
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  function abrirChat(chat: WaChat) {
    setSelectedChatId(chat.id);
    if (chat.unread > 0) {
      postJson({ action: "read", chat: chat.id }).catch(() => {});
      setState((s) => (s ? { ...s, chats: s.chats.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)) } : s));
    }
  }

  async function iniciarConversa() {
    if (!novoNumero.trim() || !novoTexto.trim()) {
      setNovoErro("Preencha o número e a mensagem.");
      return;
    }
    setNovoEnviando(true);
    setNovoErro(null);
    try {
      const data = await postJson({ action: "send", to: novoNumero, text: novoTexto });
      await loadState();
      setSelectedChatId(data.chatId);
      setNovaAberta(false);
      setNovoNumero("");
      setNovoTexto("");
    } catch (e: any) {
      setNovoErro(e?.message ?? "Erro ao enviar.");
    } finally {
      setNovoEnviando(false);
    }
  }

  // ------------------------------------------------------------ listas
  const alertasPorChat = state?.alertas ?? {};
  const totalAlertas = Object.keys(alertasPorChat).length;
  const semResposta = Object.values(alertasPorChat).filter((a) => a.some((x) => x.tipo === "sem_resposta")).length;

  const chatsFiltrados = chats.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q.replace(/\D/g, "") || q)) return false;
    const info = state?.leads[c.id];
    if (filtro === "nao_lidas") return c.unread > 0;
    if (filtro === "leads") return !!info?.lead && !info.ignorado;
    if (filtro === "alertas") return !!alertasPorChat[c.id];
    return true;
  });

  const mensagensComDias = useMemo(() => {
    const out: ({ tipo: "dia"; label: string; key: string } | { tipo: "msg"; msg: WaMessage; primeira: boolean })[] = [];
    let diaAnterior = "";
    messages.forEach((m, i) => {
      const dia = new Date(m.timestamp).toDateString();
      if (dia !== diaAnterior) {
        out.push({ tipo: "dia", label: formatDayLabel(m.timestamp), key: `d-${dia}` });
        diaAnterior = dia;
      }
      const ant = messages[i - 1];
      const primeira = !ant || ant.fromMe !== m.fromMe || new Date(ant.timestamp).toDateString() !== dia;
      out.push({ tipo: "msg", msg: m, primeira });
    });
    return out;
  }, [messages]);

  // ------------------------------------------------------------ telas
  if (!state) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] items-center justify-center bg-[#f0f2f5]">
        {loadError ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {loadError}
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
        )}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-[#f0f2f5] p-4">
        <div className="w-full max-w-4xl overflow-hidden rounded-md bg-white shadow-sm">
          <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-14">
            <div>
              <h1 className="text-[28px] font-light text-[#41525d]">Use o WhatsApp no AURA</h1>
              <ol className="mt-8 space-y-5 text-[17px] text-[#3b4a54]">
                <li className="flex gap-3"><span>1.</span> Abra o WhatsApp no seu celular.</li>
                <li className="flex gap-3">
                  <span>2.</span>
                  <span>Toque em <strong>Mais opções ⋮</strong> no Android ou em <strong>Configurações</strong> no iPhone.</span>
                </li>
                <li className="flex gap-3"><span>3.</span> <span>Toque em <strong>Dispositivos conectados</strong> e, em seguida, em <strong>Conectar dispositivo</strong>.</span></li>
                <li className="flex gap-3"><span>4.</span> Aponte seu celular para esta tela para escanear o QR code.</li>
              </ol>
              {state.error && (
                <div className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
                </div>
              )}
              {loadError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
                </div>
              )}
              <div className="mt-8 flex items-start gap-3 rounded-lg bg-[#f0f2f5] px-4 py-3 text-sm text-[#54656f]">
                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[#00a884]" />
                Depois de conectar, o Supervisor AURA acompanha suas conversas, cadastra os leads no CRM e move cada um no pipeline automaticamente.
              </div>
            </div>
            <div className="flex h-[280px] w-[280px] items-center justify-center self-center justify-self-center">
              {status === "qr" && state.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.qrCode} alt="QR code do WhatsApp" className="h-[264px] w-[264px]" />
              ) : status === "connecting" || busy ? (
                <div className="flex flex-col items-center gap-3 text-[#667781]">
                  <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                  <p className="text-sm">Gerando QR code…</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={conectar}
                  className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#d1d7db] text-[#54656f] transition hover:border-[#00a884] hover:text-[#008069]"
                >
                  <QrCode className="h-14 w-14" />
                  <span className="rounded-full bg-[#00a884] px-5 py-2 text-sm font-medium text-white">Conectar WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-7.5rem)] min-h-[520px] overflow-hidden border-t border-[#d1d7db] bg-[#f0f2f5] lg:h-[calc(100dvh-6rem)]">
      {/* ======================= Lista de conversas ======================= */}
      <div className={`${selectedChatId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#d1d7db] bg-white md:w-[380px] md:min-w-[320px] lg:w-[30%] lg:max-w-[440px]`}>
        <header className="flex h-[59px] items-center justify-between bg-[#f0f2f5] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar jid={state.myJid} name={state.name ?? "Eu"} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#111b21]">{state.name ?? "Meu WhatsApp"}</p>
              <p className="truncate text-xs text-[#667781]">{state.phone ? formatPhone(state.phone) : ""}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-1 text-[#54656f]">
            <button type="button" onClick={() => { setNovaAberta(true); setNovoErro(null); }} className="rounded-full p-2 hover:bg-black/5" title="Nova conversa">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setMenuAberto((v) => !v)} className="rounded-full p-2 hover:bg-black/5" title="Menu">
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuAberto && (
              <div className="absolute right-0 top-11 z-30 w-52 rounded-md bg-white py-2 shadow-xl">
                <button type="button" onClick={desconectar} className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-[#111b21] hover:bg-[#f5f6f6]">
                  <LogOut className="h-4 w-4" /> Desconectar
                </button>
              </div>
            )}
          </div>
        </header>

        {semResposta > 0 && (
          <button
            type="button"
            onClick={() => setFiltro("alertas")}
            className="flex items-center gap-3 bg-[#fff3c4] px-4 py-3 text-left text-sm text-[#54656f] hover:bg-[#ffeeb0]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffd279]">
              <AlertTriangle className="h-5 w-5 text-white" />
            </span>
            <span>
              <strong className="text-[#111b21]">{semResposta} {semResposta === 1 ? "cliente aguardando" : "clientes aguardando"} resposta</strong>
              <br />Não deixe o lead esfriar — toque para ver.
            </span>
          </button>
        )}

        <div className="border-b border-[#f0f2f5] px-3 py-2">
          <div className="flex items-center gap-3 rounded-lg bg-[#f0f2f5] px-3 py-1.5">
            <Search className="h-4 w-4 text-[#54656f]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
              className="w-full bg-transparent text-sm text-[#111b21] outline-none placeholder:text-[#667781]"
            />
            {busca && (
              <button type="button" onClick={() => setBusca("")} className="text-[#54656f]"><X className="h-4 w-4" /></button>
            )}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {([
              ["tudo", "Tudo"],
              ["nao_lidas", "Não lidas"],
              ["leads", "Leads"],
              ["alertas", `Alertas${totalAlertas ? ` (${totalAlertas})` : ""}`],
            ] as [Filtro, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition ${
                  filtro === id ? "bg-[#d9fdd3] text-[#008069]" : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chatsFiltrados.length === 0 && (
            <p className="px-8 py-12 text-center text-sm text-[#667781]">
              {chats.length === 0
                ? "Suas conversas aparecem aqui assim que chegarem mensagens. Use o ícone de nova conversa para chamar um cliente."
                : "Nenhuma conversa neste filtro."}
            </p>
          )}
          {chatsFiltrados.map((chat) => {
            const info = state.leads[chat.id];
            const alerta = alertasPorChat[chat.id]?.[0];
            const ativo = chat.id === selectedChatId;
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => abrirChat(chat)}
                className={`flex w-full items-center gap-3 px-3 text-left transition ${ativo ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"}`}
              >
                <Avatar jid={chat.id} name={chat.name} />
                <div className="min-w-0 flex-1 border-b border-[#f0f2f5] py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[17px] text-[#111b21]">{chat.name}</p>
                    <span className={`shrink-0 text-xs ${chat.unread ? "text-[#1fa855]" : "text-[#667781]"}`}>{formatListTime(chat.timestamp)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 truncate text-sm text-[#667781]">
                      {chat.lastFromMe && <CheckCheck className="h-4 w-4 shrink-0 text-[#53bdeb]" />}
                      <span className="truncate">{chat.lastMessage}</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {alerta && (
                        <span title={alerta.texto}>
                          <AlertTriangle className={`h-4 w-4 ${alerta.nivel === "critico" ? "text-red-500" : "text-amber-500"}`} />
                        </span>
                      )}
                      {chat.unread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-xs font-medium text-white">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {info?.lead && !info.ignorado && info.etapa && (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_ETAPA[info.etapa]}`}>{info.etapa}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================= Conversa ======================= */}
      {selectedChat ? (
        <div className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setArrastado(f);
          }}
        >
          <header className="z-10 flex h-[59px] items-center gap-3 border-l border-[#d1d7db] bg-[#f0f2f5] px-4">
            <button type="button" onClick={() => setSelectedChatId(null)} className="text-[#54656f] md:hidden" aria-label="Voltar">
              <X className="h-5 w-5" />
            </button>
            <Avatar jid={selectedChat.id} name={selectedChat.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] text-[#111b21]">{selectedChat.name}</p>
              <p className="truncate text-xs text-[#667781]">{formatPhone(selectedChat.phone)}</p>
            </div>
            {lead && !lead.ignorado && (lead.etapaPipeline ?? lead.etapa) && (
              <span className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block ${COR_ETAPA[(lead.etapaPipeline ?? lead.etapa)!]}`}>
                {lead.etapaPipeline ?? lead.etapa}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPainelIa((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${painelIa ? "bg-[#d9fdd3] text-[#008069]" : "text-[#54656f] hover:bg-black/5"}`}
              title="Supervisor AURA"
            >
              <Bot className="h-5 w-5" />
              <span className="hidden sm:inline">Supervisor</span>
              {alertasChat.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
            </button>
          </header>

          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              colarNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex-1 overflow-y-auto pb-3"
            style={FUNDO_CHAT}
          >
            {messages.length === 0 && (
              <div className="mx-auto mt-6 w-fit rounded-lg bg-[#ffeecd] px-4 py-2 text-center text-xs text-[#54656f] shadow-sm">
                O histórico antigo não é carregado. As novas mensagens desta conversa aparecem aqui.
              </div>
            )}
            {mensagensComDias.map((item) =>
              item.tipo === "dia" ? (
                <div key={item.key} className="my-3 flex justify-center">
                  <span className="rounded-lg bg-white px-3 py-1.5 text-xs text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">{item.label}</span>
                </div>
              ) : (
                <MessageBubble key={item.msg.id} msg={item.msg} primeiraDoGrupo={item.primeira} />
              ),
            )}
          </div>

          <Composer
            chatId={selectedChat.id}
            sugestao={lead?.sugestaoResposta ?? null}
            onSent={() => {
              colarNoFim.current = true;
              loadMessages(selectedChat.id);
              loadState();
            }}
            arquivoArrastado={arrastado}
            limparArrastado={() => setArrastado(null)}
          />

          {arrastando && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#00a884]/10 text-lg font-medium text-[#008069] ring-4 ring-inset ring-[#00a884]/40">
              Solte o arquivo para enviar
            </div>
          )}
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center border-b-[6px] border-[#25d366] bg-[#f0f2f5] text-center md:flex">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#d9fdd3]">
            <Smartphone className="h-12 w-12 text-[#00a884]" />
          </div>
          <h2 className="mt-6 text-[32px] font-light text-[#41525d]">WhatsApp no AURA</h2>
          <p className="mt-3 max-w-md text-sm text-[#667781]">
            Envie e receba mensagens, fotos e documentos. O Supervisor AURA acompanha cada conversa, move seus leads no pipeline e avisa quando alguém está esperando resposta.
          </p>
        </div>
      )}

      {/* ======================= Supervisor AURA ======================= */}
      {selectedChat && painelIa && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full shadow-2xl md:w-[360px] xl:static xl:shadow-none">
          <div className="h-full w-full">
            <SupervisorPanel
              chatId={selectedChat.id}
              lead={lead}
              alertas={alertasChat}
              onClose={() => setPainelIa(false)}
              onChanged={() => {
                loadLead(selectedChat.id);
                loadState();
                setTimeout(() => loadLead(selectedChat.id), 2500);
              }}
            />
          </div>
        </div>
      )}

      {/* ======================= Nova conversa ======================= */}
      {novaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNovaAberta(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 bg-[#008069] px-5 py-4 text-white">
              <button type="button" onClick={() => setNovaAberta(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
              <h3 className="text-lg">Nova conversa</h3>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm text-[#008069]">
                Número com DDD
                <input
                  type="tel"
                  value={novoNumero}
                  onChange={(e) => setNovoNumero(e.target.value)}
                  placeholder="54 99999-1234"
                  className="mt-1 w-full border-b-2 border-[#00a884] bg-transparent py-2 text-[15px] text-[#111b21] outline-none"
                  autoFocus
                />
              </label>
              <label className="block text-sm text-[#008069]">
                Mensagem
                <textarea
                  value={novoTexto}
                  onChange={(e) => setNovoTexto(e.target.value)}
                  rows={4}
                  placeholder="Olá! Aqui é da LF Lareiras…"
                  className="mt-1 w-full rounded-md border border-[#d1d7db] px-3 py-2 text-[15px] text-[#111b21] outline-none focus:border-[#00a884]"
                />
              </label>
              {novoErro && <p className="text-sm text-red-600">{novoErro}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={iniciarConversa}
                  disabled={novoEnviando}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-white shadow hover:bg-[#06cf9c] disabled:opacity-60"
                  aria-label="Enviar"
                >
                  {novoEnviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
