"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { descricaoAcao } from "@/lib/approval-system";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AcaoPendente {
  id: string;
  tipo_acao: string;
  descricao: string;
  parametros: Record<string, unknown>;
  status: string;
  criado_em: string;
}

export default function AprovacoesPendentesPage() {
  const [acoesPendentes, setAcoesPendentes] = useState<AcaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    carregarAcoes();
    
    // Subscribe to changes
    const subscription = supabase
      .from("acoes_pendentes_aprovacao")
      .on("*", (payload) => {
        console.log("Mudança detectada:", payload);
        carregarAcoes();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function carregarAcoes() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("acoes_pendentes_aprovacao")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pendente")
        .order("criado_em", { ascending: false });

      if (!error && data) {
        setAcoesPendentes(data);
      }
    } catch (err) {
      console.error("Erro ao carregar ações:", err);
    } finally {
      setLoading(false);
    }
  }

  async function aprovarAcao(acaoId: string, parametros: Record<string, unknown>) {
    try {
      // Atualizar status
      const { error: updateError } = await supabase
        .from("acoes_pendentes_aprovacao")
        .update({ status: "aprovado" })
        .eq("id", acaoId);

      if (updateError) throw updateError;

      // TODO: Executar a ação aqui usando a função apropriada
      console.log("Ação aprovada:", acaoId, parametros);

      // Recarregar lista
      carregarAcoes();
    } catch (err) {
      console.error("Erro ao aprovar:", err);
      alert("Erro ao aprovar ação");
    }
  }

  async function rejeitarAcao(acaoId: string) {
    const motivo = prompt("Motivo da rejeição:");
    if (!motivo) return;

    try {
      const { error } = await supabase
        .from("acoes_pendentes_aprovacao")
        .update({
          status: "rejeitado",
          motivo_rejeicao: motivo,
        })
        .eq("id", acaoId);

      if (error) throw error;

      carregarAcoes();
    } catch (err) {
      console.error("Erro ao rejeitar:", err);
      alert("Erro ao rejeitar ação");
    }
  }

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Carregando ações pendentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Ações Pendentes de Aprovação</h1>
        <p className="text-gray-600 mb-6">
          {acoesPendentes.length === 0
            ? "Nenhuma ação pendente"
            : `${acoesPendentes.length} ação(ões) aguardando sua aprovação`}
        </p>

        <div className="space-y-4">
          {acoesPendentes.map((acao) => (
            <div
              key={acao.id}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">
                    {acao.descricao}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Tipo: <span className="font-mono">{acao.tipo_acao}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(acao.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  Pendente
                </span>
              </div>

              <button
                onClick={() => toggleExpanded(acao.id)}
                className="text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium"
              >
                {expandedIds.has(acao.id) ? "Ocultar" : "Mostrar"} parâmetros
              </button>

              {expandedIds.has(acao.id) && (
                <div className="bg-gray-100 p-4 rounded mb-4 overflow-auto max-h-48">
                  <pre className="text-xs font-mono text-gray-800">
                    {JSON.stringify(acao.parametros, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => aprovarAcao(acao.id, acao.parametros)}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-medium transition"
                >
                  ✓ Aprovar
                </button>
                <button
                  onClick={() => rejeitarAcao(acao.id)}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 font-medium transition"
                >
                  ✕ Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>

        {acoesPendentes.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <p className="text-green-800 font-medium">
              ✓ Nenhuma ação aguardando aprovação!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
