"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Trash2, Plus, Loader2, Lock, ListTodo } from "lucide-react";
import { CardHeader, classeBotao } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravarExigindoLinha } from "@/lib/supabase/gravar";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  concluida: boolean;
  prioridade: "alta" | "media" | "baixa";
  criada_em: string;
  /** vendedor = criada pela pessoa. aura/gestor = obrigatória, só concluir. */
  origem?: "vendedor" | "aura" | "gestor";
}

/**
 * Tarefa que a AURA ou o gestor mandou é obrigação, não sugestão.
 *
 * Antes o vendedor podia apagar qualquer uma com a lixeira, inclusive as
 * que existiam justamente para cobrar dele. O botão agora só aparece nas
 * que ele mesmo criou — o banco recusa as outras de qualquer forma.
 */
function ehObrigatoria(t: Tarefa) {
  return (t.origem ?? "vendedor") !== "vendedor";
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
        window.alert(`Não consegui salvar a tarefa: ${error.message}`);
      }
    } catch (erro) {
      console.error("Erro ao adicionar tarefa:", erro);
      window.alert(erro instanceof Error ? erro.message : "Não consegui salvar a tarefa.");
    }

    setAdicionando(false);
  }

  /*
   * Marcar e apagar passam a conferir que o banco mexeu em alguma linha. O
   * Supabase não lança erro quando a RLS bloqueia: devolve zero linhas e a
   * tela recarregava com a tarefa igual, sem dizer por quê.
   */
  async function toggleTarefa(id: string, concluida: boolean) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await gravarExigindoLinha(
        supabase.from("tarefas").update({ concluida: !concluida }, { count: "exact" }).eq("id", id),
        "a tarefa",
      );
      await carregar();
    } catch (erro) {
      console.error("Erro ao atualizar tarefa:", erro);
      window.alert(erro instanceof Error ? erro.message : "Não consegui atualizar a tarefa.");
    }
  }

  async function deletarTarefa(id: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await gravarExigindoLinha(
        supabase.from("tarefas").delete({ count: "exact" }).eq("id", id),
        "a tarefa",
      );
      await carregar();
    } catch (erro) {
      console.error("Erro ao deletar tarefa:", erro);
      window.alert(erro instanceof Error ? erro.message : "Não consegui apagar a tarefa.");
    }
  }

  const tarefasAtivas = tarefas.filter((t) => !t.concluida);
  const tarefasConcluidas = tarefas.filter((t) => t.concluida);

  return (
    // O cartão vem de fora (Meu Dia): aqui só o conteúdo, sem cartão dentro de cartão.
    <div>
      <CardHeader icone={ListTodo} titulo="Tarefas Inteligentes" />

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-aura-graphite-soft" />
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
              className="aura-input flex-1"
            />
            <button
              type="button"
              onClick={adicionarTarefa}
              disabled={adicionando}
              aria-label="Adicionar tarefa"
              className={classeBotao("primario", "md", "w-[2.375rem] shrink-0 !px-0")}
            >
              {adicionando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>

          {/* Tarefas Ativas */}
          {tarefasAtivas.length > 0 && (
            <div>
              <p className="aura-rotulo mb-1.5">
                Pendentes ({tarefasAtivas.length})
              </p>
              <div className="divide-y divide-aura-mist overflow-hidden rounded-lg border border-aura-mist">
              {tarefasAtivas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-aura-sunken"
                >
                  <button
                    onClick={() => toggleTarefa(tarefa.id, tarefa.concluida)}
                    className="text-aura-graphite-soft transition hover:text-aura-petrol-600"
                  >
                    <Circle size={17} />
                  </button>
                  <span className="flex-1 text-sm text-aura-graphite">
                    {tarefa.titulo}
                    {ehObrigatoria(tarefa) && (
                      <span className="aura-selo aura-selo-ouro ml-2 align-middle">
                        Obrigatória
                      </span>
                    )}
                  </span>
                  {ehObrigatoria(tarefa) ? (
                    <span
                      title="Tarefa da AURA: conclua, não dá para descartar"
                      className="shrink-0 text-aura-graphite-soft/50"
                    >
                      <Lock size={14} />
                    </span>
                  ) : (
                    <button
                      onClick={() => deletarTarefa(tarefa.id)}
                      className="text-aura-graphite-soft/70 transition hover:text-aura-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Tarefas Concluídas */}
          {tarefasConcluidas.length > 0 && (
            <div>
              <p className="aura-rotulo mb-1.5">
                Concluídas ({tarefasConcluidas.length})
              </p>
              <div className="divide-y divide-aura-mist overflow-hidden rounded-lg border border-aura-mist">
              {tarefasConcluidas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <button
                    onClick={() => toggleTarefa(tarefa.id, tarefa.concluida)}
                    className="text-aura-success transition hover:opacity-80"
                  >
                    <CheckCircle2 size={17} />
                  </button>
                  <span className="flex-1 text-sm text-aura-graphite-soft line-through">
                    {tarefa.titulo}
                  </span>
                  <button
                    onClick={() => deletarTarefa(tarefa.id)}
                    className="text-aura-graphite-soft/70 transition hover:text-aura-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              </div>
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
