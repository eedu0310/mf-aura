'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, QrCode, Plus, Send, Phone, Search, Settings } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface WhatsAppSession {
  id: string;
  vendor_id: string;
  phone_number: string;
  session_name: string;
  is_connected: boolean;
  created_at: string;
  last_activity: string;
}

interface WhatsAppMessage {
  id: string;
  session_id: string;
  contact_number: string;
  message: string;
  direction: 'in' | 'out';
  timestamp: string;
  read: boolean;
}

interface WhatsAppChat {
  id: string;
  session_id: string;
  contact_number: string;
  contact_name?: string;
  last_message?: string;
  last_timestamp?: string;
  unread_count: number;
  lead_id?: string;
}

export default function WhatsAppComponent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<WhatsAppSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    const subscription = supabase
      .channel('whatsapp_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_sessoes' },
        (payload) => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchChats(selectedSession.id);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedChat && selectedSession) {
      fetchMessages(selectedSession.id, selectedChat.contact_number);
    }
  }, [selectedChat]);

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_sessoes')
        .select('*')
        .eq('vendor_id', user.id);

      if (error) throw error;

      setSessions(data || []);
      const active = (data || []).filter(s => s.is_connected);
      setActiveSessions(active);

      if (active.length > 0 && !selectedSession) {
        setSelectedSession(active[0]);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchChats = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversas')
        .select(
          `*,
           whatsapp_mensagens(count)`
        )
        .eq('session_id', sessionId)
        .order('last_timestamp', { ascending: false });

      if (error) throw error;
      setChats(data || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchMessages = async (sessionId: string, contactNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('*')
        .eq('session_id', sessionId)
        .eq('contact_number', contactNumber)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const initializeSession = async () => {
    try {
      setIsConnecting(true);
      setShowQRModal(true);

      const response = await fetch('/api/whatsapp/init-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch (error) {
      console.error('Error initializing session:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !selectedSession) return;

    try {
      setLoading(true);

      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSession.id,
          contact_number: selectedChat.contact_number,
          message: newMessage,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedSession.id, selectedChat.contact_number);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await fetch(`/api/whatsapp/logout-session/${sessionId}`, {
        method: 'POST',
      });
      fetchSessions();
    } catch (error) {
      console.error('Error logging out session:', error);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-500 rounded-lg">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">WhatsApp Business</h2>
            <p className="text-sm text-gray-600">
              {activeSessions.length} sessão{activeSessions.length !== 1 ? 's' : ''} ativa{activeSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={initializeSession}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition"
        >
          <Plus className="w-4 h-4" />
          Nova Sessão
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 h-full">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-green-100 border-b">
            <h3 className="font-semibold text-gray-800">Sessões</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`w-full text-left p-4 border-b hover:bg-green-50 transition ${
                  selectedSession?.id === session.id ? 'bg-green-100 border-l-4 border-green-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{session.session_name}</p>
                    <p className="text-sm text-gray-600">{session.phone_number}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${session.is_connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-green-100 border-b">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2 top-3" />
              <input
                type="text"
                placeholder="Pesquisar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {chats
              .filter(
                (chat) =>
                  chat.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  chat.contact_number.includes(searchQuery)
              )
              .map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full text-left p-4 border-b hover:bg-green-50 transition ${
                    selectedChat?.id === chat.id ? 'bg-green-100 border-l-4 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{chat.contact_name || chat.contact_number}</p>
                      <p className="text-sm text-gray-600 truncate">{chat.last_message}</p>
                    </div>
                    {chat.unread_count > 0 && (
                      <span className="bg-green-500 text-white text-xs font-bold rounded-full px-2 py-1 ml-2">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          {selectedChat ? (
            <>
              <div className="p-4 bg-green-100 border-b flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{selectedChat.contact_name || selectedChat.contact_number}</p>
                  <p className="text-xs text-gray-600">WhatsApp</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-green-200 rounded-lg transition">
                    <Phone className="w-4 h-4 text-gray-700" />
                  </button>
                  <button className="p-2 hover:bg-green-200 rounded-lg transition">
                    <Settings className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-green-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.direction === 'out'
                          ? 'bg-green-500 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.direction === 'out' ? 'text-green-100' : 'text-gray-600'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white border-t flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !newMessage.trim()}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>

      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md">
            <h3 className="text-xl font-bold mb-4 text-center">Conectar WhatsApp</h3>
            {qrCode ? (
              <div className="mb-6">
                <img src={qrCode} alt="QR Code" className="w-full border-2 border-green-500 rounded-lg" />
                <p className="text-center text-sm text-gray-600 mt-4">
                  Abra o WhatsApp no seu celular, vá para Mais opções → Dispositivos vinculados → Vincular um dispositivo e escaneie o código acima
                </p>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <div className="animate-spin">
                  <QrCode className="w-16 h-16 text-green-500" />
                </div>
              </div>
            )}
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
