"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  telefone: string;
  nome_cliente: string | null;
  avatar_url: string | null;
  phone_number_id: string;
  nao_lidas: number;
  arquivada: boolean;
  fixada: boolean;
  silenciada: boolean;
  status: string;
  ultima_mensagem_preview: string | null;
  ultima_mensagem_em: string | null;
};
type Contact = {
  id: string;
  telefone: string;
  nome: string | null;
  avatar_url: string | null;
  tipo: string;
};
type Message = {
  id: string;
  conversa_id: string;
  phone_number_id: string;
  whatsapp_message_id: string | null;
  reacao: string | null;
  texto: string;
  remetente: string;
  lida: boolean;
  created_at: string;
};
type Status = {
  conectado: boolean;
  numero: string | null;
  qr_code: string | null;
  ultimo_erro?: string | null;
  atualizado_em: string | null;
};

function time(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function phone(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppInbox() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [connected, setConnected] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "closed" | "archived">(
    "all",
  );
  const [composer, setComposer] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newConversation, setNewConversation] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState("");
  const autoConnectStarted = useRef(false);

  const loadStatus = useCallback(async () => {
    if (!supabase) return;
    const { data, error: statusError } = await supabase
      .from("whatsapp_status")
      .select("conectado, numero, qr_code, ultimo_erro, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    if (statusError) {
      setError(statusError.message);
      return null;
    }
    const status = (data || {
      conectado: false,
      numero: null,
      qr_code: null,
      atualizado_em: null,
    }) as Status;
    const nextLine = status.conectado ? status.numero : null;
    setConnected(Boolean(status.conectado));
    setLine(nextLine);
    setQr(status.qr_code || "");
    if (status.ultimo_erro) setError(status.ultimo_erro);
    if (!status.conectado) {
      setConversations([]);
      setSelected(null);
      setMessages([]);
    }
    return nextLine;
  }, [supabase]);

  const loadContacts = useCallback(async () => {
    if (!connected) {
      setContacts([]);
      return;
    }
    setLoadingContacts(true);
    try {
      const response = await fetch("/api/whatsapp/contacts", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.erro || "Erro ao carregar contactos.");
      setContacts((result?.contactos || []) as Contact[]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Erro ao carregar contactos.",
      );
    } finally {
      setLoadingContacts(false);
    }
  }, [connected]);

  const loadConversations = useCallback(
    async (lineOverride?: string | null) => {
      const currentLine = lineOverride === undefined ? line : lineOverride;
      if (!currentLine || !connected) {
        setConversations([]);
        setSelected(null);
        setMessages([]);
        return [];
      }
      setLoadingConversations(true);
      if (!supabase) {
        setLoadingConversations(false);
        return [];
      }
      const { data, error: queryError } = await supabase
        .from("whatsapp_conversas")
        .select(
          "id, telefone, nome_cliente, avatar_url, phone_number_id, status, nao_lidas, arquivada, fixada, silenciada, ultima_mensagem_preview, ultima_mensagem_em",
        )
        .eq("phone_number_id", currentLine)
        .order("ultima_mensagem_em", { ascending: false });
      setLoadingConversations(false);
      if (queryError) {
        setError(`Erro ao carregar conversas: ${queryError.message}`);
        return [];
      }
      const rows = (data || []) as Conversation[];
      setConversations(rows);
      setSelected((current) => {
        if (current && rows.some((row) => row.id === current.id))
          return rows.find((row) => row.id === current.id) || current;
        if (rows.length > 0) {
          setNewConversation(false);
          return rows[0];
        }
        return null;
      });
      return rows;
    },
    [connected, line, supabase],
  );

  const loadMessages = useCallback(
    async (conversationId: string, lineOverride?: string | null) => {
      const currentLine = lineOverride === undefined ? line : lineOverride;
      if (!currentLine || !conversationId || !connected) {
        setMessages([]);
        return;
      }
      setLoadingMessages(true);
      if (!supabase) {
        setLoadingMessages(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from("whatsapp_mensagens")
        .select(
          "id, conversa_id, phone_number_id, whatsapp_message_id, reacao, texto, remetente, lida, created_at",
        )
        .eq("conversa_id", conversationId)
        .eq("phone_number_id", currentLine)
        .order("created_at", { ascending: true });
      setLoadingMessages(false);
      if (queryError) {
        setError(`Erro ao carregar histórico: ${queryError.message}`);
        setMessages([]);
        return;
      }
      setMessages((data || []) as Message[]);
    },
    [connected, line, supabase],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const currentLine = await loadStatus();
      if (!cancelled && currentLine) {
        await loadConversations(currentLine);
        return;
      }
      if (!cancelled && !autoConnectStarted.current) {
        autoConnectStarted.current = true;
        try {
          await fetch("/api/whatsapp/connect", { method: "POST" });
          await new Promise((resolve) => window.setTimeout(resolve, 800));
          await loadStatus();
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível iniciar o WhatsApp.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConversations, loadStatus]);

  useEffect(() => {
    if (contactsOpen) void loadContacts();
  }, [contactsOpen, loadContacts]);

  useEffect(() => {
    if (!connected || selected || newConversation || conversations.length === 0)
      return;
    setSelected(conversations[0]);
  }, [connected, conversations, newConversation, selected]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void (async () => {
        const currentLine = await loadStatus();
        await loadConversations(currentLine);
      })();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadConversations, loadStatus]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("aura-whatsapp-clean")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_status",
          filter: "id=eq.1",
        },
        (payload: any) => {
          const status = payload.new as Status | undefined;
          if (!status) return;
          const nextLine = status.conectado ? status.numero : null;
          setConnected(Boolean(status.conectado));
          setLine(nextLine);
          setQr(status.qr_code || "");
          if (!status.conectado) {
            setConversations([]);
            setSelected(null);
            setMessages([]);
          } else if (nextLine) void loadConversations(nextLine);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        (payload: any) => {
          const row = (payload.new || payload.old) as Conversation | undefined;
          if (row?.phone_number_id === line) void loadConversations(line);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_mensagens" },
        (payload: any) => {
          const row = (payload.new || payload.old) as Message | undefined;
          if (row?.phone_number_id === line) {
            void loadConversations(line);
            if (selected?.id === row.conversa_id)
              void loadMessages(row.conversa_id, line);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [line, loadConversations, loadMessages, selected?.id, supabase]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...conversations]
      .sort((left, right) => Number(right.fixada) - Number(left.fixada))
      .filter((conversation) => {
        if (filter === "new" && conversation.status !== "aguardando_aceite")
          return false;
        if (filter === "closed" && conversation.status !== "encerrada")
          return false;
        if (filter === "archived" && !conversation.arquivada) return false;
        if (filter !== "archived" && conversation.arquivada) return false;
        return (
          !term ||
          `${conversation.telefone} ${conversation.nome_cliente || ""} ${conversation.ultima_mensagem_preview || ""}`
            .toLowerCase()
            .includes(term)
        );
      });
  }, [conversations, filter, search]);

  useEffect(() => {
    if (connected && !selected && !newConversation && visible[0]) {
      setSelected(visible[0]);
      void loadMessages(visible[0].id, line);
    }
  }, [connected, line, loadMessages, newConversation, selected, visible]);

  function selectConversation(conversation: Conversation) {
    if (!line || conversation.phone_number_id !== line) return;
    setSelected(conversation);
    setNewConversation(false);
    setError("");
    void loadMessages(conversation.id, line);
    if (!supabase) return;
    void supabase
      .from("whatsapp_mensagens")
      .update({ lida: true })
      .eq("conversa_id", conversation.id)
      .eq("phone_number_id", line)
      .eq("remetente", "cliente");
  }

  async function action(url: string) {
    setLoadingAction(true);
    setError("");
    try {
      const response = await fetch(url, { method: "POST" });
      const result = await response.json();
      if (!response.ok || result?.sucesso === false)
        throw new Error(result?.erro || "Operação não concluída.");
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const currentLine = await loadStatus();
      await loadConversations(currentLine);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro na operação.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function createConversation() {
    const number = phone(newNumber);
    if (!line) {
      setError("Conecte o WhatsApp antes de criar uma conversa.");
      return;
    }
    if (!/^\d{10,15}$/.test(number)) {
      setError("Use o número com código do país, por exemplo 5511999999999.");
      return;
    }
    setLoadingAction(true);
    setError("");
    try {
      const response = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: number }),
      });
      const result = await response.json();
      if (!response.ok || !result?.conversa)
        throw new Error(result?.erro || "Não foi possível criar a conversa.");
      setNewNumber("");
      setNewConversation(false);
      await loadConversations(line);
      selectConversation(result.conversa as Conversation);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Erro ao criar conversa.",
      );
    } finally {
      setLoadingAction(false);
    }
  }

  async function reactTo(message: Message, reaction: string) {
    if (!selected || !message.whatsapp_message_id || !line) return;
    try {
      const response = await fetch("/api/whatsapp/message-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId: selected.id,
          whatsappMessageId: message.whatsapp_message_id,
          reaction,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.sucesso)
        throw new Error(result?.erro || "Não foi possível reagir.");
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, reacao: reaction || null } : item,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao reagir.");
    }
  }

  async function send() {
    if (!selected || !composer.trim()) return;
    setLoadingAction(true);
    setError("");
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: selected.telefone,
          texto: composer.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || result?.sucesso === false)
        throw new Error(result?.erro || "Não foi possível enviar.");
      setComposer("");
      await loadMessages(selected.id, line);
      await loadConversations(line);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Erro ao enviar mensagem.",
      );
    } finally {
      setLoadingAction(false);
    }
  }

  const countNew = conversations.filter(
    (conversation) => conversation.status === "aguardando_aceite",
  ).length;

  return (
    <div className="space-y-5 pb-16">
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        {!connected && !qr && !error ? (
          <p className="mb-4 rounded-xl bg-amber-400/15 px-4 py-2 text-sm text-amber-100">
            A preparar a conexão do WhatsApp… se o QR não aparecer, clique em
            Conectar.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              Central de atendimento
            </p>
            <h1 className="mt-2 text-3xl font-bold">WhatsApp</h1>
            <p className="mt-1 text-sm text-slate-300">
              Conversas e histórico da sessão actualmente conectada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-4 py-2 text-sm ${connected ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-300"}`}
            >
              {connected ? (
                <Wifi className="mr-2 inline h-4 w-4" />
              ) : (
                <WifiOff className="mr-2 inline h-4 w-4" />
              )}
              {connected
                ? `Conectado${line ? ` • ${line}` : ""}`
                : "Desconectado"}
            </span>
            <button
              className="rounded-full bg-white/10 p-2"
              onClick={() => void loadStatus()}
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              onClick={() =>
                void action(
                  connected
                    ? "/api/whatsapp/disconnect"
                    : "/api/whatsapp/connect",
                )
              }
              disabled={loadingAction}
            >
              {loadingAction ? (
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              ) : null}
              {connected ? "Desconectar" : "Conectar"}
            </button>
          </div>
        </div>
      </div>

      {!connected && qr && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm">
          <QrCode className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
          <p className="mb-4 font-semibold">Leia o QR Code no WhatsApp</p>
          <img
            src={qr}
            alt="QR Code para conectar o WhatsApp"
            className="mx-auto w-72 rounded-xl border p-2"
          />
          <button
            className="mt-4 rounded-lg border px-4 py-2 text-sm"
            onClick={() => void action("/api/whatsapp/reset")}
            disabled={loadingAction}
          >
            Gerar novo QR
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="float-right" onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid h-[calc(100vh-250px)] min-h-[620px] max-h-[820px] min-w-0 grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-white shadow-sm">
        <aside className="flex min-h-0 min-w-0 flex-col border-r bg-slate-50">
          <div className="border-b p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">
                <Inbox className="mr-2 inline h-4 w-4" />
                Conversas{" "}
                <span className="ml-1 text-xs text-slate-500">
                  {connected ? conversations.length : 0}
                </span>
              </h2>
              <button
                className="rounded-lg bg-slate-900 p-2 text-white disabled:opacity-40"
                onClick={() => {
                  setSelected(null);
                  setMessages([]);
                  setNewConversation(true);
                }}
                disabled={!connected}
                title="Nova conversa"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
                placeholder="Pesquisar conversas"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-1 text-xs">
              <button
                className={`rounded-lg px-3 py-2 ${filter === "all" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}
                onClick={() => setFilter("all")}
              >
                Todas
              </button>
              <button
                className={`rounded-lg px-3 py-2 ${filter === "new" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}
                onClick={() => setFilter("new")}
              >
                Novas {countNew || ""}
              </button>
              <button
                className={`rounded-lg px-3 py-2 ${filter === "closed" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}
                onClick={() => setFilter("closed")}
              >
                Encerradas
              </button>
              <button
                className={`rounded-lg px-3 py-2 ${filter === "archived" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}
                onClick={() => setFilter("archived")}
              >
                Arquivadas
              </button>
            </div>
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
              onClick={() => setContactsOpen((current) => !current)}
              disabled={!connected}
            >
              <UserRound className="h-3.5 w-3.5" />
              {contactsOpen ? "Fechar contactos" : "Buscar contactos guardados"}
            </button>
          </div>
          {contactsOpen && connected ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <strong className="text-sm">Contactos guardados</strong>
                <button
                  className="text-xs text-emerald-700"
                  onClick={() => void loadContacts()}
                >
                  Actualizar
                </button>
              </div>
              {loadingContacts ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />A
                  carregar contactos…
                </div>
              ) : contacts.filter((contact) =>
                  `${contact.nome || ""} ${contact.telefone}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ).length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Nenhum contacto guardado.
                </div>
              ) : (
                contacts
                  .filter((contact) =>
                    `${contact.nome || ""} ${contact.telefone}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((contact) => (
                    <button
                      key={contact.id}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white"
                      onClick={() => {
                        setNewNumber(contact.telefone);
                        setNewConversation(true);
                        setContactsOpen(false);
                      }}
                    >
                      {contact.avatar_url ? (
                        <img
                          src={contact.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                          {(contact.nome || contact.telefone).slice(-2)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">
                          {contact.nome || contact.telefone}
                        </strong>
                        <small className="text-slate-500">
                          {contact.nome
                            ? contact.telefone
                            : "Contacto WhatsApp"}
                        </small>
                      </span>
                    </button>
                  ))
              )}
            </div>
          ) : !connected ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <WifiOff className="mx-auto mb-2 h-6 w-6" />
              Conecte o WhatsApp para ver as conversas.
            </div>
          ) : loadingConversations && conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />A
              sincronizar conversas…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <MessageCircle className="mx-auto mb-2 h-6 w-6" />
              Nenhuma conversa nesta sessão.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visible.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`flex w-full items-center gap-3 border-b p-4 text-left hover:bg-white ${selected?.id === conversation.id ? "bg-white" : ""}`}
                  onClick={() => selectConversation(conversation)}
                >
                  {conversation.avatar_url ? (
                    <img
                      src={conversation.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                      {(
                        conversation.nome_cliente || conversation.telefone
                      ).slice(-2)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">
                        {conversation.nome_cliente || conversation.telefone}
                      </strong>
                      <small className="text-slate-400">
                        {time(conversation.ultima_mensagem_em)}
                      </small>
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {conversation.ultima_mensagem_preview ||
                        "Conversa importada"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          {selected && !newConversation ? (
            <>
              <header className="flex items-center gap-3 border-b p-5">
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 font-bold text-white">
                    {(selected.nome_cliente || selected.telefone).slice(-2)}
                  </span>
                )}
                <div>
                  <h2 className="font-bold">
                    {selected.nome_cliente || "Contacto WhatsApp"}
                  </h2>
                  <p className="text-sm text-slate-500">{selected.telefone}</p>
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-100 p-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />A carregar
                    histórico…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Sem mensagens guardadas para esta conversa.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.remetente === "vendedor" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${message.remetente === "vendedor" ? "rounded-br-sm bg-emerald-600 text-white" : "rounded-bl-sm bg-white text-slate-800"}`}
                      >
                        <p className="whitespace-pre-wrap">{message.texto}</p>
                        {message.reacao ? (
                          <span className="mt-1 inline-block rounded-full bg-white/80 px-1.5 py-0.5 text-xs text-slate-700">
                            {message.reacao}
                          </span>
                        ) : null}
                        <small
                          className={`mt-1 block text-right text-[10px] ${message.remetente === "vendedor" ? "text-emerald-100" : "text-slate-400"}`}
                        >
                          {time(message.created_at)}{" "}
                          {message.remetente === "vendedor" ? (
                            message.lida ? (
                              <CheckCheck className="ml-1 inline h-3 w-3" />
                            ) : (
                              <Check className="ml-1 inline h-3 w-3" />
                            )
                          ) : null}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 border-t bg-white p-4">
                <input
                  className="flex-1 rounded-xl border px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Digite uma mensagem"
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  disabled={!connected}
                />
                <button
                  className="rounded-xl bg-emerald-600 px-4 text-white disabled:opacity-50"
                  onClick={() => void send()}
                  disabled={loadingAction || !composer.trim()}
                >
                  Enviar
                </button>
              </div>
            </>
          ) : newConversation ? (
            <div className="m-auto w-full max-w-md p-8">
              <MessageSquarePlus className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
              <h2 className="text-center text-xl font-bold">Nova conversa</h2>
              <p className="mt-1 text-center text-sm text-slate-500">
                Digite o número com código do país.
              </p>
              <input
                autoFocus
                className="mt-5 w-full rounded-xl border px-4 py-3"
                placeholder="5511999999999"
                value={newNumber}
                onChange={(event) => setNewNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createConversation();
                }}
              />
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-xl border px-4 py-3"
                  onClick={() => setNewConversation(false)}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
                  onClick={() => void createConversation()}
                  disabled={loadingAction}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : !selected ? (
            <div className="m-auto p-8 text-center text-slate-500">
              <UserRound className="mx-auto mb-3 h-10 w-10" />
              <p>
                {connected
                  ? "Seleccione uma conversa para ver o histórico."
                  : "WhatsApp desconectado."}
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b p-5">
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 font-bold text-white">
                    {(selected.nome_cliente || selected.telefone).slice(-2)}
                  </span>
                )}
                <div>
                  <h2 className="font-bold">
                    {selected.nome_cliente || "Contacto WhatsApp"}
                  </h2>
                  <p className="text-sm text-slate-500">{selected.telefone}</p>
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-100 p-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />A carregar
                    histórico…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Sem mensagens guardadas para esta conversa.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.remetente === "vendedor" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${message.remetente === "vendedor" ? "rounded-br-sm bg-emerald-600 text-white" : "rounded-bl-sm bg-white text-slate-800"}`}
                      >
                        <p className="whitespace-pre-wrap">{message.texto}</p>
                        {message.reacao ? (
                          <span className="mt-1 inline-block rounded-full bg-white/80 px-1.5 py-0.5 text-xs text-slate-700">
                            {message.reacao}
                          </span>
                        ) : null}
                        <div className="mt-1 flex items-center justify-end gap-1 opacity-70">
                          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(
                            (reaction) => (
                              <button
                                key={reaction}
                                type="button"
                                className="text-xs hover:scale-125"
                                onClick={() => void reactTo(message, reaction)}
                                title={`Reagir com ${reaction}`}
                              >
                                {reaction}
                              </button>
                            ),
                          )}
                        </div>
                        <small
                          className={`mt-1 block text-right text-[10px] ${message.remetente === "vendedor" ? "text-emerald-100" : "text-slate-400"}`}
                        >
                          {time(message.created_at)}{" "}
                          {message.remetente === "vendedor" ? (
                            message.lida ? (
                              <CheckCheck className="ml-1 inline h-3 w-3" />
                            ) : (
                              <Check className="ml-1 inline h-3 w-3" />
                            )
                          ) : null}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 border-t bg-white p-4">
                <input
                  className="flex-1 rounded-xl border px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Digite uma mensagem"
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  disabled={!connected}
                />
                <button
                  className="rounded-xl bg-emerald-600 px-4 text-white disabled:opacity-50"
                  onClick={() => void send()}
                  disabled={loadingAction || !composer.trim()}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
