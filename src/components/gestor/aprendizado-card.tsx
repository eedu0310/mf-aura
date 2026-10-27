"use client";

/**
 * O que a AURA aprendeu nas conversas, esperando a palavra do gestor.
 *
 * A IA extrai o padrão de cada negócio fechado ou perdido e das conversas do
 * dia. O item nasce "sugerido" e só passa a ser injetado nos prompts depois
 * que o gestor aprova — com uma exceção: o que se repetiu, já fechou venda e
 * não tem número nenhum entra sozinho (selo "entrou sozinho"), e o gestor
 * tira de uso com um clique. É o mesmo princípio que já vale para lead e para
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
  vezes_perdeu?: number;
  aprovado_auto?: boolean;
  status: string;
  criado_em: string;
}

interface ResumoSugestoes {
  dias: number;
  total: number;
  usou: number;
  adaptou: number;
  ignorou: number;
  automatica: number;
  respondeuQuandoUsou: number | null;
  respondeuQuandoIgnorou: number | null;
}

function placar(item: Item): string {
  const partes = [`visto ${item.vezes_visto}×`];
  if (item.vezes_fechou > 0) partes.push(`fechou ${item.vezes_fechou}×`);
  if ((item.vezes_perdeu ?? 0) > 0) partes.push(`perdeu ${item.vezes_perdeu}×`);
  return partes.join(" · ");
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
  const [sugestoes, setSugestoes] = useState<ResumoSugestoes | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/gestor/aprendizado");
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível carregar.");
      setSugeridos(d.sugeridos ?? []);
      setAprovados(d.aprovados ?? []);
      setSugestoes(d.sugestoes ?? null);
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
      if (acao === "recusar") setAprovados((atual) => atual.filter((i) => i.id !== item.id));
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
              Tirado dos negócios fechados e perdidos e das conversas de cada
              dia. Só entra sozinho o que se repetiu, já fechou venda e não tem
              preço, prazo nem número; o resto espera você.
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
          Nada esperando revisão. Toda noite a AURA relê as conversas do dia e
          traz para cá o que aprendeu.
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
                  <span className="text-xs text-aura-graphite-soft">{placar(item)}</span>
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
            <ul className="mt-3 space-y-3">
              {aprovados.map((item) => (
                <li key={item.id} className="text-sm text-aura-graphite-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-aura-graphite">{ROTULO[item.tipo] ?? item.tipo}</span>
                    {item.aprovado_auto && (
                      <span className="rounded-full bg-aura-gold/20 px-2 py-0.5 text-[0.7rem] font-semibold text-aura-graphite">
                        entrou sozinho
                      </span>
                    )}
                    <span className="text-xs">{placar(item)}</span>
                    <button
                      type="button"
                      disabled={ocupado === item.id}
                      onClick={() => {
                        if (confirm("Tirar este aprendizado de uso? Ele não volta a ser sugerido.")) void decidir(item, "recusar");
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-aura-mist bg-white px-2 py-1 text-xs font-medium text-aura-graphite transition hover:border-aura-danger hover:text-aura-danger disabled:opacity-50"
                    >
                      <X size={12} /> Tirar de uso
                    </button>
                  </div>
                  <p className="mt-1">
                    &ldquo;{item.gatilho}&rdquo; → {item.resposta}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sugestoes && sugestoes.total > 0 && (
        <div className="mt-6 border-t border-aura-mist pt-4">
          <p className="text-sm font-medium text-aura-graphite">
            Sugestões de resposta da AURA · últimos {sugestoes.dias} dias
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Usadas como estavam", sugestoes.usou],
              ["Adaptadas", sugestoes.adaptou],
              ["Ignoradas", sugestoes.ignorou],
              ["Automáticas", sugestoes.automatica],
            ].map(([rotulo, n]) => (
              <div key={rotulo as string} className="rounded-xl bg-aura-bg/60 px-3 py-2">
                <p className="text-lg font-semibold text-aura-graphite">{n as number}</p>
                <p className="text-xs text-aura-graphite-soft">{rotulo as string}</p>
              </div>
            ))}
          </div>
          {(sugestoes.respondeuQuandoUsou != null || sugestoes.respondeuQuandoIgnorou != null) && (
            <p className="mt-3 text-xs text-aura-graphite-soft">
              O cliente respondeu
              {sugestoes.respondeuQuandoUsou != null && ` em ${sugestoes.respondeuQuandoUsou}% das vezes em que o vendedor usou a sugestão`}
              {sugestoes.respondeuQuandoUsou != null && sugestoes.respondeuQuandoIgnorou != null && " e"}
              {sugestoes.respondeuQuandoIgnorou != null && ` em ${sugestoes.respondeuQuandoIgnorou}% das vezes em que escreveu outra coisa`}
              . A AURA estuda estes casos toda noite.
            </p>
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
