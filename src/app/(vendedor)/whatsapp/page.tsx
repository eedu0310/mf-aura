"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Users, Plus, Search, Settings, AlertCircle, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import SuggestionsPanel from "@/components/whatsapp/SuggestionsPanel";

interface WhatsAppConversation {
  id: string;
  nome_cliente: string;
  telefone: string;
  ultima_mensagem?: string;
  timestamp?: string;
  nao_lidas?: number;
  status: "aguardando_aceite" | "ativa" | "encerrada";
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface WhatsAppMessage {
  id: string;
  texto: string;
  remetente: "cliente" | "ia";
  timestamp: string;
  status?: "enviando" | "enviado" | "erro";
}

const MOCK_CONVERSATIONS: WhatsAppConversation[] = [
  {
    id: "1",
    nome_cliente: "João Silva",
    telefone: "(54) 99999-1234",
    ultima_mensagem: "Ótimo! Vou conferir os valores",
    timestamp: "14:30",
    nao_lidas: 2,
    status: "ativa",
  },
  {
    id: "2",
    nome_cliente: "Maria Santos",
    telefone: "(54) 99999-5678",
    ultima_mensagem: "Quando posso agendar uma visita?",
    timestamp: "13:15",
    nao_lidas: 0,
    status: "ativa",
  },
  {
    id: "3",
    nome_cliente: "Pedro Oliveira",
    telefone: "(54) 99999-9012",
    ultima_mensagem: "Preciso de mais informações",
    timestamp: "12:45",
    nao_lidas: 1,
    status: "aguardando_aceite",
  },
  {
    id: "4",
    nome_cliente: "Ana Costa",
    telefone: "(54) 99999-3456",
    ultima_mensagem: "Obrigada pela ajuda!",
    timestamp: "11:20",
    nao_lidas: 0,
    status: "encerrada",
  },
];

const MOCK_MESSAGES: WhatsAppMessage[] = [
  {
    id: "1",
    texto: "Olá! Gostaria de saber mais sobre os produtos",
    remetente: "cliente",
    timestamp: "14:25",
    status: "enviado",
  },
  {
    id: "2",
    texto: "Ótimo! Temos várias opções que podem te interessar. Qual é o seu orçamento?",
    remetente: "ia",
    timestamp: "14:26",
    status: "enviado",
  },
  {
    id: "3",
    texto: "Algo em torno de R$ 5.000",
    remetente: "cliente",
    timestamp: "14:27",
    status: "enviado",
  },
  {
    id: "4",
    texto: "Perfeito! Temos 3 opções que se encaixam nesse orçamento. Deixa eu te enviar os detalhes...",
    remetente: "ia",
    timestamp: "14:28",
    status: "enviado",
  },
  {
    id: "5",
    texto: "Ótimo! Vou conferir os valores",
    remetente: "cliente",
    timestamp: "14:30",
    status: "enviado",
  },
];

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>(MOCK_CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(
    MOCK_CONVERSATIONS[0]
  );
  const [messages, setMessages] = useState<WhatsAppMessage[]>(MOCK_MESSAGES);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [respostaRate, setRespostaRate] = useState(82);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseBrowserClient();

  // Fix hydration issue: generate random value only on client
  useEffect(() => {
    setRespostaRate(Math.round(Math.random() * 30 + 75));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const newMessage: WhatsAppMessage = {
      id: String(messages.length + 1),
      texto: messageText,
      remetente: "ia",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status: "enviando",
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageText("");
    setIsLoading(true);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === newMessage.id ? { ...msg, status: "enviado" } : msg))
      );
      setIsLoading(false);
    }, 1000);
  }, [messageText, selectedConversation, messages.length]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.nome_cliente.toLowerCase().includes(searchText.toLowerCase()) ||
      conv.telefone.includes(searchText)
  );

  const stats = {
    ativas: conversations.filter((c) => c.status === "ativa").length,
    aguardando: conversations.filter((c) => c.status === "aguardando_aceite").length,
    encerradas: conversations.filter((c) => c.status === "encerrada").length,
    respostaRate: respostaRate, // Now using state value instead of Math.random()
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 to-green-700 px-6 pb-8 pt-8 sm:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">WhatsApp Business</h1>
              <p className="text-sm text-green-100">Gerenciar conversas e automações</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {[
              { label: "Conversas Ativas", value: stats.ativas, color: "bg-green-500" },
              { label: "Aguardando Aceite", value: stats.aguardando, color: "bg-yellow-500" },
              { label: "Encerradas", value: stats.encerradas, color: "bg-slate-400" },
              { label: "Taxa de Resposta", value: `${stats.respostaRate}%`, color: "bg-blue-500" },
            ].map((stat, idx) => (
              <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{stat.label}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${stat.color} opacity-10`} />
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Conversations List */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
                <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nova</span>
                </button>
              </div>

              {/* Search */}
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

              {/* Conversations */}
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition ${
                      selectedConversation?.id === conv.id
                        ? "border-green-500 bg-green-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{conv.nome_cliente}</p>
                        <p className="truncate text-xs text-slate-500">{conv.telefone}</p>
                        {conv.ultima_mensagem && (
                          <p className="mt-1 truncate text-sm text-slate-600">{conv.ultima_mensagem}</p>
                        )}
                      </div>
                      {conv.nao_lidas && conv.nao_lidas > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white">
                          {conv.nao_lidas}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{conv.timestamp}</span>
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                          conv.status === "ativa"
                            ? "bg-green-100 text-green-700"
                            : conv.status === "aguardando_aceite"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {conv.status === "ativa"
                          ? "Ativa"
                          : conv.status === "aguardando_aceite"
                          ? "Aguardando"
                          : "Encerrada"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Window */}
            <div className="flex flex-col rounded-lg border-2 border-slate-200 bg-white lg:col-span-2">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{selectedConversation.nome_cliente}</p>
                        <p className="text-xs text-slate-500">{selectedConversation.telefone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg p-2 hover:bg-slate-100 transition">
                        <Settings className="h-5 w-5 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.remetente === "ia" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs rounded-lg px-4 py-2 ${
                            msg.remetente === "ia"
                              ? "bg-green-500 text-white"
                              : "bg-slate-200 text-slate-900"
                          }`}
                        >
                          <p className="text-sm">{msg.texto}</p>
                          <p
                            className={`mt-1 text-xs ${
                              msg.remetente === "ia" ? "text-green-100" : "text-slate-500"
                            }`}
                          >
                            {msg.timestamp}
                            {msg.status === "enviando" && " ⏱️"}
                            {msg.status === "enviado" && " ✓✓"}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="border-t-2 border-slate-200 p-4">
                    <div className="flex items-end gap-3">
                      <input
                        type="text"
                        placeholder="Escrever mensagem..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        disabled={isLoading}
                        className="flex-1 rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-green-500 focus:outline-none disabled:bg-slate-50"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !messageText.trim()}
                        className="rounded-lg bg-green-600 p-2 text-white hover:bg-green-700 disabled:bg-slate-300 transition"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-slate-500">
                  <p>Selecione uma conversa para começar</p>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions Panel */}
          <div className="mt-6">
            <SuggestionsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
