"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Trash2, Plus, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  concluida: boolean;
  prioridade: "alta" | "media" | "baixa";
  criada_em: string;
}

export function TarefasInteligentes() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCarregando(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }

      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("vendedor_id", user.id)
        .order("criada_em", { ascending: false });

      if (error) throw error;
      if (data) {
        setTarefas(data);
      }
    } catch (erro) {
      console.error("Erro ao carregar tarefas:", erro);
    }

    setCarregando(false);
  }

  async function adicionarTarefa() {
    if (!novaTarefa.trim()) {
      inputRef.current?.focus();
      return;
    }

    setAdicionando(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAdicionando(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAdicionando(false);
        return;
      }

      const { error } = await supabase.from("tarefas").insert([
        {
          vendedor_id: user.id,
          titulo: novaTarefa,
          descricao: "",
          concluida: false,
          prioridade: "media",
        },
      ]);

      if (!error) {
        setNovaTarefa("");
        await carregar();
      } else {
        console.error("Erro ao inserir tarefa:", error);
        window.alert("Não foi possível salvar a tarefa. Execute a migration 012 no Supabase.");
      }
    } catch (erro) {
      console.error("Erro ao adicionar tarefa:", erro);
    }

    setAdicionando(false);
  }

  async function toggleTarefa(id: string, concluida: boolean) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await supabase
        .from("tarefas")
        .update({ concluida: !concluida })
        .eq("id", id);

      await carregar();
    } catch (erro) {
      console.error("Erro ao atualizar tarefa:", erro);
    }
  }

  async function deletarTarefa(id: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await supabase.from("tarefas").delete().eq("id", id);
      await carregar();
    } catch (erro) {
      console.error("Erro ao deletar tarefa:", erro);
    }
  }

  const tarefasAtivas = tarefas.filter((t) => !t.concluida);
  const tarefasConcluidas = tarefas.filter((t) => t.concluida);

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <p className="font-medium text-aura-graphite mb-4">Tarefas Inteligentes</p>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Adicionar Nova */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && adicionarTarefa()}
              placeholder="Adicionar nova tarefa..."
              className="flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
            />
            <button
              type="button"
              onClick={adicionarTarefa}
              disabled={adicionando}
              className="rounded-lg bg-aura-petrol-600 p-2 text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
            >
              {adicionando ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>

          {/* Tarefas Ativas */}
          {tarefasAtivas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-aura-graphite-soft">
                PENDENTES ({tarefasAtivas.length})
              </p>
              {tarefasAtivas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center gap-3 rounded-lg bg-aura-bg p-3 transition hover:bg-opacity-70"
                >
                  <button
                    onClick={() => toggleTarefa(tarefa.id, tarefa.concluida)}
                    className="text-aura-petrol-600 transition hover:text-aura-petrol-700"
                  >
                    <Circle size={18} />
                  </button>
                  <span className="flex-1 text-sm text-aura-graphite">
                    {tarefa.titulo}
                  </span>
                  <button
                    onClick={() => deletarTarefa(tarefa.id)}
                    className="text-aura-graphite-soft transition hover:text-aura-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tarefas Concluídas */}
          {tarefasConcluidas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-aura-graphite-soft">
                CONCLUÍDAS ({tarefasConcluidas.length})
              </p>
              {tarefasConcluidas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center gap-3 rounded-lg bg-green-50 p-3 opacity-60"
                >
                  <button
                    onClick={() => toggleTarefa(tarefa.id, tarefa.concluida)}
                    className="text-green-600 transition hover:text-green-700"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <span className="flex-1 text-sm text-aura-graphite line-through">
                    {tarefa.titulo}
                  </span>
                  <button
                    onClick={() => deletarTarefa(tarefa.id)}
                    className="text-aura-graphite-soft transition hover:text-aura-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tarefas.length === 0 && (
            <p className="text-center text-sm text-aura-graphite-soft py-4">
              Nenhuma tarefa. Adicione uma para começar!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
