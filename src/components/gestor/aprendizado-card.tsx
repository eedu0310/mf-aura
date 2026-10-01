"use client";

/**
 * O que a AURA aprendeu nas conversas, esperando a palavra do gestor.
 *
 * A IA extrai o padrão de cada negócio fechado ou perdido, mas nada entra em
 * uso sozinho: o item nasce "sugerido" e só passa a ser injetado nos prompts
 * depois que o gestor aprova. É o mesmo princípio que já vale para lead e para
 * venda — a IA propõe, a pessoa decide. Aqui é ainda mais necessário: se a AURA
 * reforçasse sozinha um preço errado que apareceu numa conversa, passaria a
 * repetir esse preço para todos os clientes.
 *
 * O texto é editável antes de aprovar, porque a IA escreve um rascunho e a
 * palavra final da casa é do gestor.
 */
import { useEffect, useState, useCallback } from "react";
import { Check, X, Pencil, GraduationCap, Loader2 } from "lucide-react";

interface Item {
  id: string;
  canal: string;
  tipo: "objecao" | "pergunta" | "abordagem";
  gatilho: string;
  resposta: string;
  vezes_visto: number;
  vezes_fechou: number;
  status: string;
  criado_em: string;
}

const ROTULO: Record<string, string> = {
  objecao: "Objeção",
  pergunta: "Pergunta",
  abordagem: "Abordagem",
};

export function AprendizadoCard() {
  const [sugeridos, setSugeridos] = useState<Item[]>([]);
  const [aprovados, setAprovados] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ gatilho: string; resposta: string }>({
    gatilho: "",
    resposta: "",
  });
  const [verAprovados, setVerAprovados] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/gestor/aprendizado");
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível carregar.");
      setSugeridos(d.sugeridos ?? []);
      setAprovados(d.aprovados ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(item: Item, acao: "aprovar" | "recusar") {
    setOcupado(item.id);
    try {
      const corpo: Record<string, unknown> = { id: item.id, acao };
      if (editando === item.id) {
        corpo.gatilho = rascunho.gatilho;
        corpo.resposta = rascunho.resposta;
      }
      const r = await fetch("/api/gestor/aprendizado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível salvar.");

      // Tira da lista na hora, sem recarregar tudo: o gestor costuma revisar
      // vários seguidos e uma recarga por clique deixaria a tela piscando.
      setSugeridos((atual) => atual.filter((i) => i.id !== item.id));
      if (acao === "aprovar") {
        const texto = editando === item.id ? rascunho : {};
        setAprovados((atual) => [{ ...item, ...texto, status: "aprovado" }, ...atual]);
      }
      setEditando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(null);
    }
  }

  function abrirEdicao(item: Item) {
    setEditando(item.id);
    setRascunho({ gatilho: item.gatilho, resposta: item.resposta });
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <GraduationCap size={20} className="mt-0.5 shrink-0 text-aura-petrol-600" />
          <div>
            <h3 className="font-display text-lg font-semibold text-aura-graphite">
              O que a AURA aprendeu
            </h3>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              Tirado das conversas de negócios fechados e perdidos. Nada disto
              chega à AURA antes de você aprovar.
            </p>
          </div>
        </div>
        {sugeridos.length > 0 && (
          <span className="shrink-0 rounded-full bg-aura-gold/20 px-3 py-1 text-xs font-semibold text-aura-graphite">
            {sugeridos.length} para revisar
          </span>
        )}
      </div>

      {erro && (
        <p className="mt-4 rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : sugeridos.length === 0 ? (
        <p className="mt-6 text-sm text-aura-graphite-soft">
          Nada esperando revisão. Conforme os vendedores fecharem e perderem
          negócios, a AURA vai trazendo o que aprendeu para cá.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {sugeridos.map((item) => {
            const emEdicao = editando === item.id;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-aura-mist bg-aura-bg/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-aura-petrol-700 px-2.5 py-0.5 text-xs font-medium text-white">
                    {ROTULO[item.tipo] ?? item.tipo}
                  </span>
                  <span className="text-xs text-aura-graphite-soft">
                    visto {item.vezes_visto}×
                    {item.vezes_fechou > 0 && ` · fechou ${item.vezes_fechou}×`}
                  </span>
                </div>

                {emEdicao ? (
                  <div className="mt-3 space-y-2">
                    <input
                      value={rascunho.gatilho}
                      onChange={(e) =>
                        setRascunho((r) => ({ ...r, gatilho: e.target.value }))
                      }
                      placeholder="O que o cliente disse"
                      className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
                    />
                    <textarea
                      value={rascunho.resposta}
                      onChange={(e) =>
                        setRascunho((r) => ({ ...r, resposta: e.target.value }))
                      }
                      rows={3}
                      placeholder="A resposta que a AURA deve usar"
                      className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
                    />
                  </div>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-sm text-aura-graphite">
                      <span className="text-aura-graphite-soft">Cliente: </span>
                      &ldquo;{item.gatilho}&rdquo;
                    </p>
                    <p className="text-sm text-aura-graphite">
                      <span className="text-aura-graphite-soft">Resposta: </span>
                      {item.resposta}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado === item.id}
                    onClick={() => void decidir(item, "aprovar")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-aura-success px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {ocupado === item.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    {emEdicao ? "Salvar e aprovar" : "Aprovar"}
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === item.id}
                    onClick={() => void decidir(item, "recusar")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist bg-white px-3 py-1.5 text-sm font-medium text-aura-graphite transition hover:border-aura-danger hover:text-aura-danger disabled:opacity-50"
                  >
                    <X size={14} /> Recusar
                  </button>
                  {!emEdicao && (
                    <button
                      type="button"
                      onClick={() => abrirEdicao(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist bg-white px-3 py-1.5 text-sm font-medium text-aura-graphite transition hover:border-aura-petrol-500"
                    >
                      <Pencil size={14} /> Ajustar o texto
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {aprovados.length > 0 && (
        <div className="mt-6 border-t border-aura-mist pt-4">
          <button
            type="button"
            onClick={() => setVerAprovados((v) => !v)}
            className="text-sm font-medium text-aura-petrol-600 hover:underline"
          >
            {verAprovados ? "Esconder" : "Ver"} os {aprovados.length} em uso pela
            AURA
          </button>
          {verAprovados && (
            <ul className="mt-3 space-y-2">
              {aprovados.map((item) => (
                <li key={item.id} className="text-sm text-aura-graphite-soft">
                  <span className="font-medium text-aura-graphite">
                    {ROTULO[item.tipo] ?? item.tipo}:
                  </span>{" "}
                  &ldquo;{item.gatilho}&rdquo; → {item.resposta}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-5 text-xs text-aura-graphite-soft">
        Em conflito com o manual de vendas, o manual manda — isto entra como
        complemento, nunca por cima da regra da casa.
      </p>
    </div>
  );
}
