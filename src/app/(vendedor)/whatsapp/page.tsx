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
    ultima_mensagem: "Preciso fazer um orçamento",
    timestamp: "11:45",
    nao_lidas: 1,
    status: "aguardando_aceite",
  },
];

const MOCK_MESSAGES: WhatsAppMessage[] = [
  {
    id: "1",
    texto: "Olá João! 👋 Bem-vindo à nossa central de atendimento.",
    remetente: "ia",
    timestamp: "14:20",
    status: "enviado",
  },
  {
    id: "2",
    texto: "Gostaria de informações sobre as lareiras de aquecimento",
    remetente: "cliente",
    timestamp: "14:22",
    status: "enviado",
  },
  {
    id: "3",
    texto: "Claro! Temos várias opções. Qual é o tamanho do seu espaço?",
    remetente: "ia",
    timestamp: "14:25",
    status: "enviado",
  },
  {
    id: "4",
    texto: "Aproximadamente 50m²",
    remetente: "cliente",
    timestamp: "14:28",
    status: "enviado",
  },
  {
    id: "5",
    texto: "Perfeito! Para esse tamanho recomendamos nosso modelo Premium.",
    remetente: "ia",
    timestamp: "14:30",
    status: "enviado",
  },
];

export default function WhatsAppPage() {
  const supabase = getSupabaseBrowserClient();
  
  const [conversations, setConversations] = useState<WhatsAppConversation[]>(MOCK_CONVERSATIONS);
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(MOCK_CONVERSATIONS[0]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(true);

  // Get current vendor from Supabase auth
  useEffect(() => {
    if (!supabase) return;

    const loadVendor = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error("Erro ao buscar usuário:", userError);
          return;
        }

        // Fetch vendor ID for this auth user
        const { data: vendor, error: vendorError } = await supabase
          .from("vendedores")
          .select("id")
          .eq("auth_id", user.id)
          .single();

        if (!vendorError && vendor) {
          setVendorId(vendor.id);
        }
      } catch (err) {
        console.error("Erro ao carregar vendedor:", err);
      } finally {
        setLoadingVendor(false);
      }
    };

    loadVendor();
  }, [supabase]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations from Supabase (future implementation)
  useEffect(() => {
    const loadConversations = async () => {
      if (!supabase) return;
      
      setIsLoading(true);
      try {
        // Implementação futura: carregar de whatsapp_conversas
        // const { data, error: err } = await supabase
        //   .from('whatsapp_conversas')
        //   .select('*')
        //   .order('updated_at', { ascending: false });
        
        // if (err) throw err;
        // if (data) setConversations(data);
      } catch (err) {
        console.error("Erro ao carregar conversas:", err);
        setError("Falha ao carregar conversas");
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [supabase]);

  const getCurrentTime = useCallback(() => {
    const now = new Date();
    return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }, []);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv) return;

    const userMessage = inputText;
    setInputText("");
    setIsSending(true);
    setError(null);

    try {
      // Add user message immediately
      const userMsg: WhatsAppMessage = {
        id: String(Date.now()),
        texto: userMessage,
        remetente: "cliente",
        timestamp: getCurrentTime(),
        status: "enviando",
      };

      setMessages((prev) => [...prev, userMsg]);

      // TODO: Send to API endpoint
      // const response = await fetch('/api/whatsapp/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     phone: selectedConv.telefone,
      //     message: userMessage,
      //     conversationId: selectedConv.id,
      //   }),
      // });

      // Simulate API response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update message status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMsg.id ? { ...msg, status: "enviado" } : msg
        )
      );

      // Simulate AI response
      setTimeout(() => {
        const aiMsg: WhatsAppMessage = {
          id: String(Date.now() + 1),
          texto: "✓ Mensagem recebida com sucesso! Estou analisando sua solicitação...",
          remetente: "ia",
          timestamp: getCurrentTime(),
          status: "enviado",
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 1500);
    } catch (err) {
      setError("Falha ao enviar mensagem");
      console.error("Erro ao enviar mensagem:", err);
      
      // Update message status to error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === String(Date.now())
            ? { ...msg, status: "erro" }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  }, [inputText, selectedConv, getCurrentTime]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.nome_cliente.toLowerCase().includes(searchText.toLowerCase()) ||
      conv.telefone.includes(searchText)
  );

  const stats = {
    ativas: conversations.filter((c) => c.status === "ativa").length,
    aguardando: conversations.filter((c) => c.status === "aguardando_aceite").length,
    encerradas: conversations.filter((c) => c.status === "encerrada").length,
    respostaRate: Math.round(Math.random() * 30 + 75),
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
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-100">Central de Atendimento</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">WhatsApp</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-green-50">Gerenciar conversas e conectar com clientes em tempo real</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-900 font-medium text-sm"
            >
              Descartar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Conversations List */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-1">
            <div className="border-b border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Users className="h-5 w-5" />
                  Conversas ({filteredConversations.length})
                </h2>
                <button
                  className="rounded-lg bg-green-50 p-2 text-green-600 hover:bg-green-100 transition-colors"
                  title="Nova conversa"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="max-h-[600px] divide-y divide-slate-200 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p>Nenhuma conversa encontrada</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full px-4 py-4 text-left transition-colors ${
                      selectedConv?.id === conv.id
                        ? "border-l-4 border-green-500 bg-green-50"
                        : "border-l-4 border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{conv.nome_cliente}</p>
                        <p className="text-xs text-slate-500 mt-1">{conv.telefone}</p>
                        <p className="mt-2 truncate text-sm text-slate-600">
                          {conv.ultima_mensagem || "Sem mensagens"}
                        </p>
                      </div>
                      <div className="ml-2 flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">{conv.timestamp}</span>
                        {conv.nao_lidas && conv.nao_lidas > 0 && (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                            {conv.nao_lidas}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          conv.status === "ativa" ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-xs text-slate-500">
                        {conv.status === "ativa" ? "Ativa" : "Aguardando"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-2 flex flex-col h-[600px]">
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="border-b border-slate-200 bg-gradient-to-r from-green-50 to-green-100 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{selectedConv.nome_cliente}</h3>
                      <p className="text-sm text-slate-600">{selectedConv.telefone}</p>
                    </div>
                    <button className="rounded-lg bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors">
                      <Settings className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.remetente === "cliente" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs rounded-2xl px-4 py-2 ${
                          msg.remetente === "cliente"
                            ? `rounded-br-none ${
                                msg.status === "erro" ? "bg-red-500" : "bg-green-500"
                              } text-white`
                            : "rounded-bl-none bg-slate-100 text-slate-900"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.texto}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span
                            className={`text-xs ${
                              msg.remetente === "cliente" ? "text-green-100" : "text-slate-500"
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                          {msg.remetente === "cliente" && msg.status === "enviando" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Digite uma mensagem..."
                      disabled={isSending}
                      className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isSending}
                      className="rounded-full bg-green-500 p-3 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[48px]"
                      title="Enviar mensagem"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
                <MessageCircle className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Selecione uma conversa para começar</p>
              </div>
            )}
          </div>
        </div>

        
        {/* Suggestions Panel - Show when conversation is selected */}
        {selectedConv && vendorId && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                💡 Sugestões do Agente
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Recomendações inteligentes baseadas na conversa atual
              </p>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <SuggestionsPanel
                vendorId={vendorId}
                conversationId={selectedConv.id}
                onSuggestionApplied={(suggestion) => {
                  console.log("Sugestão aplicada:", suggestion);
                }}
              />
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
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
  );
}
