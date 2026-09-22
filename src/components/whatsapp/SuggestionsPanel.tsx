'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Lightbulb, TrendingUp, MessageSquare, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface AgentSuggestion {
  id: string;
  type: 'opportunity' | 'follow_up' | 'objection_handling' | 'negotiation' | 'upsell' | 'retention';
  title: string;
  description: string;
  suggested_action: string;
  confidence: number;
  status: 'pending' | 'viewed' | 'applied' | 'dismissed';
  created_at: string;
  conversation_id: string;
}

interface SuggestionsPanelProps {
  vendorId: string;
  conversationId?: string;
  onSuggestionApplied?: (suggestion: AgentSuggestion) => void;
}

const getSuggestionIcon = (type: string) => {
  switch (type) {
    case 'opportunity':
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case 'follow_up':
      return <MessageSquare className="w-5 h-5 text-blue-500" />;
    case 'objection_handling':
      return <AlertCircle className="w-5 h-5 text-orange-500" />;
    case 'negotiation':
      return <MessageSquare className="w-5 h-5 text-purple-500" />;
    case 'upsell':
      return <TrendingUp className="w-5 h-5 text-indigo-500" />;
    case 'retention':
      return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    default:
      return <Lightbulb className="w-5 h-5 text-gray-500" />;
  }
};

const getSuggestionLabel = (type: string) => {
  switch (type) {
    case 'opportunity':
      return 'Oportunidade';
    case 'follow_up':
      return 'Acompanhamento';
    case 'objection_handling':
      return 'Objeção';
    case 'negotiation':
      return 'Negociação';
    case 'upsell':
      return 'Venda Adicional';
    case 'retention':
      return 'Retenção';
    default:
      return 'Sugestão';
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.6) return 'text-blue-600';
  if (confidence >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
};

export default function SuggestionsPanel({
  vendorId,
  conversationId,
  onSuggestionApplied,
}: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AgentSuggestion | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Fetch suggestions from database
  const fetchSuggestions = useCallback(async () => {
    if (!supabase || !vendorId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('agent_suggestions')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
        .limit(5);

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Erro ao buscar sugestões:', fetchError);
        setError('Erro ao carregar sugestões');
        return;
      }

      setSuggestions(data as AgentSuggestion[]);
    } catch (err) {
      console.error('Erro ao buscar sugestões:', err);
      setError('Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  }, [supabase, vendorId, conversationId]);

  // Initial fetch and setup realtime subscription
  useEffect(() => {
    fetchSuggestions();

    if (!supabase) return;

    // Subscribe to real-time updates
    const channel = supabase
      .channel('agent_suggestions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_suggestions',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('Sugestão atualizada:', payload);
          fetchSuggestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSuggestions, supabase, vendorId]);

  // Handle suggestion status update
  const handleSuggestionAction = async (
    suggestion: AgentSuggestion,
    newStatus: 'viewed' | 'applied' | 'dismissed'
  ) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('agent_suggestions')
        .update({
          status: newStatus,
          ...(newStatus === 'applied' && { applied_at: new Date().toISOString() }),
          ...(newStatus === 'dismissed' && { dismissed_at: new Date().toISOString() }),
        })
        .eq('id', suggestion.id);

      if (error) {
        console.error('Erro ao atualizar sugestão:', error);
        return;
      }

      if (newStatus === 'applied' && onSuggestionApplied) {
        onSuggestionApplied(suggestion);
      }

      fetchSuggestions();
      setSelectedSuggestion(null);
    } catch (err) {
      console.error('Erro ao atualizar sugestão:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Nenhuma sugestão disponível no momento</p>
        <p className="text-sm mt-2">As sugestões aparecem conforme novas mensagens chegam</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-800">Sugestões do Agente</h3>
        <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {suggestions.length}
        </span>
      </div>

      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setSelectedSuggestion(suggestion)}
        >
          <div className="flex items-start gap-3">
            {getSuggestionIcon(suggestion.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900 truncate">
                  {suggestion.title}
                </h4>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded whitespace-nowrap">
                  {getSuggestionLabel(suggestion.type)}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {suggestion.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Confiança:</span>
                  <span className={`text-xs font-semibold ${getConfidenceColor(suggestion.confidence)}`}>
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSuggestionAction(suggestion, 'applied');
                    }}
                    className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSuggestionAction(suggestion, 'dismissed');
                    }}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
            <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      ))}

      {/* Modal Detail View */}
      {selectedSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getSuggestionIcon(selectedSuggestion.type)}
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {selectedSuggestion.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {getSuggestionLabel(selectedSuggestion.type)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSuggestion(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Descrição</h4>
                  <p className="text-gray-700">{selectedSuggestion.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Ação Sugerida</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-gray-700">{selectedSuggestion.suggested_action}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Nível de Confiança</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          selectedSuggestion.confidence >= 0.8
                            ? 'bg-green-500'
                            : selectedSuggestion.confidence >= 0.6
                            ? 'bg-blue-500'
                            : selectedSuggestion.confidence >= 0.4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.round(selectedSuggestion.confidence * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {Math.round(selectedSuggestion.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSuggestionAction(selectedSuggestion, 'applied')}
                  className="flex-1 bg-green-600 text-white font-medium py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Aplicar Sugestão
                </button>
                <button
                  onClick={() => handleSuggestionAction(selectedSuggestion, 'dismissed')}
                  className="flex-1 bg-gray-200 text-gray-900 font-medium py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
