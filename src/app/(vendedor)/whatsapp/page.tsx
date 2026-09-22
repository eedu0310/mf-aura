"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Users,
  X,
} from "lucide-react";

type WaStatus = "disconnected" | "connecting" | "qr" | "connected";

interface WaChat {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
}

interface WaMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

interface WaState {
  status: WaStatus;
  qrCode: string | null;
  phone: string | null;
  name: string | null;
  error: string | null;
  chats: WaChat[];
}

const API = "/api/whatsapp/live";

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return phone;
}

function formatTime(ts: number) {
  if (!ts) return "";
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function WhatsAppPage() {
  const [state, setState] = useState<WaState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newText, setNewText] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const status: WaStatus = state?.status ?? "disconnected";
  const connected = status === "connected";
  const chats = state?.chats ?? [];
  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

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
      if (res.ok) setMessages(data.messages ?? []);
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }, []);

  // Estado da conexão: mais rápido enquanto espera o QR/conexão.
  useEffect(() => {
    loadState();
    const ms = status === "connected" ? 3000 : 1500;
    const t = setInterval(loadState, ms);
    return () => clearInterval(t);
  }, [loadState, status]);

  // Mensagens da conversa aberta.
  useEffect(() => {
    if (!selectedChatId || !connected) {
      setMessages([]);
      return;
    }
    loadMessages(selectedChatId);
    const t = setInterval(() => loadMessages(selectedChatId), 2000);
    return () => clearInterval(t);
  }, [selectedChatId, connected, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
    return data;
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      const data = await post({ action: "connect" });
      if (data?.status) setState(data);
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao conectar.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await post({ action: "logout" });
      setSelectedChatId(null);
      await loadState();
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao desconectar.");
    } finally {
      setBusy(false);
    }
  };

  const openChat = (chat: WaChat) => {
    setSelectedChatId(chat.id);
    setSendError(null);
    if (chat.unread > 0) post({ action: "read", chat: chat.id }).catch(() => {});
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !selectedChatId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await post({ action: "send", to: selectedChatId, text });
      setMessageText("");
      await loadMessages(selectedChatId);
      loadState();
    } catch (e: any) {
      setSendError(e?.message ?? "Erro ao enviar.");
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = async () => {
    if (!newNumber.trim() || !newText.trim()) {
      setNewError("Preencha o número e a mensagem.");
      return;
    }
    setSending(true);
    setNewError(null);
    try {
      const data = await post({ action: "send", to: newNumber, text: newText });
      await loadState();
      setSelectedChatId(data.chatId);
      setShowNew(false);
      setNewNumber("");
      setNewText("");
    } catch (e: any) {
      setNewError(e?.message ?? "Erro ao enviar.");
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(
    (c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.phone.includes(searchText.replace(/\D/g, "") || searchText)
  );
  const unreadTotal = chats.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 to-green-700 px-6 pb-8 pt-8 sm:px-8">
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">WhatsApp Business</h1>
              <p className="text-sm text-green-100">
                {connected
                  ? `Conectado${state?.phone ? ` · ${formatPhone(state.phone)}` : ""}`
                  : "Conecte seu WhatsApp para atender pelo AURA"}
              </p>
            </div>
          </div>
          {connected && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/25 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Desconectar
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="px-6 sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
        </div>
      )}

      {!state && !loadError && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      )}

      {/* Tela de conexão */}
      {state && !connected && (
        <div className="px-6 sm:px-8">
          <div className="mx-auto grid max-w-4xl gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 md:p-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Conectar seu WhatsApp</h2>
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">1</span>
                  Clique em <strong>Conectar WhatsApp</strong> para gerar o QR code.
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">2</span>
                  No celular, abra o WhatsApp → <strong>Mais opções (⋮)</strong> → <strong>Dispositivos conectados</strong> → <strong>Conectar um dispositivo</strong>.
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">3</span>
                  Aponte a câmera para o QR code ao lado. Pronto — suas conversas aparecem aqui.
                </li>
              </ol>
              {state.error && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {state.error}
                </div>
              )}
              {status === "disconnected" && (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  Conectar WhatsApp
                </button>
              )}
            </div>

            <div className="flex min-h-[320px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
              {status === "qr" && state.qrCode ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.qrCode} alt="QR code do WhatsApp" className="mx-auto h-72 w-72 rounded-lg bg-white p-2" />
                  <p className="mt-3 text-xs text-slate-500">O código se renova sozinho a cada ~20 segundos.</p>
                </div>
              ) : status === "connecting" || busy ? (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                  <p className="text-sm">Preparando a conexão…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <QrCode className="h-16 w-16" />
                  <p className="text-sm">O QR code aparece aqui</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conectado */}
      {state && connected && (
        <>
          <div className="px-6 sm:px-8">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { label: "Status", value: "Conectado", icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
                { label: "Conversas", value: chats.length, icon: <Users className="h-5 w-5 text-slate-500" /> },
                { label: "Não lidas", value: unreadTotal, icon: <MessageCircle className="h-5 w-5 text-amber-500" /> },
                { label: "Número", value: state.phone ? formatPhone(state.phone) : "—", icon: <Smartphone className="h-5 w-5 text-blue-500" /> },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{stat.label}</p>
                  <div className="mt-3 flex items-center gap-3">
                    {stat.icon}
                    <p className="truncate text-xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 sm:px-8">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Lista de conversas */}
              <div className="space-y-4 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadState}
                      title="Atualizar"
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNew(true);
                        setNewError(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                      Nova
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar conversa..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>

                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {filteredChats.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                      {chats.length === 0
                        ? "Nenhuma conversa ainda. As mensagens que chegarem aparecem aqui — ou clique em Nova para iniciar uma."
                        : "Nenhuma conversa encontrada."}
                    </div>
                  )}
                  {filteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => openChat(chat)}
                      className={`w-full rounded-lg border-2 p-4 text-left transition ${
                        selectedChatId === chat.id
                          ? "border-green-500 bg-green-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{chat.name}</p>
                          <p className="truncate text-xs text-slate-500">{formatPhone(chat.phone)}</p>
                          <p className="mt-1 truncate text-sm text-slate-600">{chat.lastMessage}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-slate-400">{formatTime(chat.timestamp)}</span>
                          {chat.unread > 0 && (
                            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                              {chat.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Janela do chat */}
              <div className="flex min-h-[560px] flex-col rounded-lg border-2 border-slate-200 bg-white lg:col-span-2">
                {selectedChat ? (
                  <>
                    <div className="flex items-center gap-3 border-b-2 border-slate-200 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{selectedChat.name}</p>
                        <p className="text-xs text-slate-500">{formatPhone(selectedChat.phone)}</p>
                      </div>
                    </div>

                    <div className="max-h-[480px] flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
                      {messages.length === 0 && (
                        <p className="py-10 text-center text-sm text-slate-400">Sem mensagens carregadas nesta conversa.</p>
                      )}
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] whitespace-pre-wrap break-words rounded-lg px-4 py-2 ${
                              msg.fromMe ? "bg-green-500 text-white" : "bg-white text-slate-900 shadow-sm"
                            }`}
                          >
                            <p className="text-sm">{msg.text}</p>
                            <p className={`mt-1 text-right text-xs ${msg.fromMe ? "text-green-100" : "text-slate-400"}`}>
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t-2 border-slate-200 p-4">
                      {sendError && <p className="mb-2 text-sm text-red-600">{sendError}</p>}
                      <div className="flex items-end gap-3">
                        <input
                          type="text"
                          placeholder="Escrever mensagem..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          className="flex-1 rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-green-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={sending || !messageText.trim()}
                          className="rounded-lg bg-green-600 p-2.5 text-white transition hover:bg-green-700 disabled:bg-slate-300"
                        >
                          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
                    <MessageCircle className="h-10 w-10 text-slate-300" />
                    <p>Selecione uma conversa para começar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: nova conversa */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Nova conversa</h3>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Número (com DDD)
                <input
                  type="tel"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="54 99999-1234"
                  className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mensagem
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={4}
                  placeholder="Olá! Aqui é da LF Lareiras…"
                  className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
              {newError && <p className="text-sm text-red-600">{newError}</p>}
              <button
                type="button"
                onClick={handleNewConversation}
                disabled={sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
