"use client";

import { useState, useEffect } from "react";
import { X, Check, AlertCircle, Loader2 } from "lucide-react";
import { obterTarefasInteligentes } from "@/lib/gerenciador-tarefas-inteligentes";
import { useUserProfile } from "@/lib/user-profile-context";

interface TarefaDiaria {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "urgente" | "alta" | "média" | "baixa";
  icone: string;
  relacionamentoId?: string;
  estimativaMinutos?: number;
}

interface DailyTasksPopupProps {
  onClose: () => void;
  aberto?: boolean;
}

export function DailyTasksPopup({ onClose, aberto = true }: DailyTasksPopupProps) {
  const { profile } = useUserProfile();
  const [isOpen, setIsOpen] = useState(aberto);
  const [tarefas, setTarefas] = useState<TarefaDiaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tarefasConcluidas, setTarefasConcluidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsOpen(aberto);
    if (aberto) {
      carregarTarefas();
    }
  }, [aberto]);

  async function carregarTarefas() {
    setCarregando(true);
    setErro(null);
    try {
      
      const usuarioId = (profile as any)?.usuario_id || (profile as any)?.id || "";
      
      if (!usuarioId) {
        console.error("ID do usuário não encontrado");
        setErro("Erro ao carregar usuário");
        setCarregando(false);
        return;
      }

      const resultado = await obterTarefasInteligentes(usuarioId, profile.cargo);
      
      setTarefas(resultado.tarefas);
      
      if (resultado.synced) {
      } else {
        setErro("Não foi possível gerar tarefas com dados reais agora.");
      }
    } catch (erro) {
      console.error("❌ Erro ao carregar tarefas:", erro);
      setErro("Erro ao carregar tarefas");
    } finally {
      setCarregando(false);
    }
  }

  if (!isOpen) return null;

  const handleToggleTarefa = (id: string) => {
    setTarefasConcluidas((prev) => {
      const novas = new Set(prev);
      if (novas.has(id)) {
        novas.delete(id);
      } else {
        novas.add(id);
      }
      return novas;
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const tarefasUrgentes = tarefas.filter((t) => t.prioridade === "urgente");
  const tarefasAlta = tarefas.filter((t) => t.prioridade === "alta");
  const tarefasMedia = tarefas.filter((t) => t.prioridade === "média");
  const tarefasBaixa = tarefas.filter((t) => t.prioridade === "baixa");

  const percentualConcluido = tarefas.length > 0 
    ? Math.round((tarefasConcluidas.size / tarefas.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white p-8 shadow-2xl overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition"
        >
          <X size={20} className="text-gray-600" />
        </button>

        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">📋 Tarefas de Hoje</h2>
          <p className="text-gray-600">Organize sua jornada e conquiste tudo!</p>
          {erro && <p className="text-yellow-600 text-sm mt-2">⚠️ {erro}</p>}
        </div>

        {carregando && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Carregando tarefas inteligentes...</span>
          </div>
        )}

        {!carregando && tarefas.length > 0 && (
          <>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Progresso do dia</span>
                <span className="text-sm font-bold text-blue-600">{percentualConcluido}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${percentualConcluido}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {tarefasUrgentes.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                    <AlertCircle size={16} /> Urgente
                  </h3>
                  <div className="space-y-2 ml-4">
                    {tarefasUrgentes.map((tarefa) => (
                      <TarefaItem
                        key={tarefa.id}
                        tarefa={tarefa}
                        concluida={tarefasConcluidas.has(tarefa.id)}
                        onToggle={() => handleToggleTarefa(tarefa.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tarefasAlta.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-orange-600 mb-3">⚠️ Alta Prioridade</h3>
                  <div className="space-y-2 ml-4">
                    {tarefasAlta.map((tarefa) => (
                      <TarefaItem
                        key={tarefa.id}
                        tarefa={tarefa}
                        concluida={tarefasConcluidas.has(tarefa.id)}
                        onToggle={() => handleToggleTarefa(tarefa.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tarefasMedia.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-yellow-600 mb-3">⚙️ Prioridade Média</h3>
                  <div className="space-y-2 ml-4">
                    {tarefasMedia.map((tarefa) => (
                      <TarefaItem
                        key={tarefa.id}
                        tarefa={tarefa}
                        concluida={tarefasConcluidas.has(tarefa.id)}
                        onToggle={() => handleToggleTarefa(tarefa.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tarefasBaixa.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-600 mb-3">✅ Prioridade Baixa</h3>
                  <div className="space-y-2 ml-4">
                    {tarefasBaixa.map((tarefa) => (
                      <TarefaItem
                        key={tarefa.id}
                        tarefa={tarefa}
                        concluida={tarefasConcluidas.has(tarefa.id)}
                        onToggle={() => handleToggleTarefa(tarefa.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!carregando && tarefas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Nenhuma tarefa para hoje! 🎉</p>
            <p className="text-gray-400 text-sm mt-2">Você está em dia com tudo!</p>
          </div>
        )}

        {!carregando && (
          <button
            onClick={handleClose}
            className="w-full mt-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 font-bold hover:shadow-lg transition duration-300 text-lg"
          >
            Vamos Lá! 🚀
          </button>
        )}
      </div>
    </div>
  );
}

function TarefaItem({
  tarefa,
  concluida,
  onToggle,
}: {
  tarefa: TarefaDiaria;
  concluida: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
        concluida
          ? "bg-green-100 border-l-4 border-green-500"
          : "bg-gray-100 hover:bg-gray-150 border-l-4 border-gray-300"
      }`}
    >
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-2 mt-0.5 transition-all ${
          concluida
            ? "bg-green-500 border-green-500"
            : "border-gray-400 hover:border-gray-600"
        }`}
      >
        {concluida && <Check size={16} className="text-white" />}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`font-semibold text-sm ${
            concluida ? "text-gray-500 line-through" : "text-gray-800"
          }`}
        >
          {tarefa.icone && <span className="mr-2">{tarefa.icone}</span>}
          {tarefa.titulo}
        </p>
        {tarefa.descricao && (
          <p className={`text-xs mt-1 ${concluida ? "text-gray-400" : "text-gray-600"}`}>
            {tarefa.descricao}
          </p>
        )}
        {tarefa.estimativaMinutos && (
          <p className="text-xs text-blue-600 mt-1">⏱️ ~{tarefa.estimativaMinutos} min</p>
        )}
      </div>
    </div>
  );
}
