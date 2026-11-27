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
 *
 * REVISOR DO APRENDIZADO (agente, pedido do Elton em 25/11 e 27/11): ele
 * aprova ou recusa sozinho, com o motivo de cada decisão (na dúvida, recusa),
 * e deixa aqui só política comercial que o material não responde. Tudo que
 * ele decide aparece com o selo do agente e o motivo, e o gestor desfaz com
 * um clique (o item volta a esperar revisão).
 */
import { useEffect, useState, useCallback } from "react";
import { Check, X, Pencil, GraduationCap, Loader2, Undo2, BadgeCheck } from "lucide-react";
import { Alerta, Card, CardHeader, EstadoVazio, Segmentado, Selo, classeBotao } from "@/components/ui";

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
  /** Preenchidos quando quem decidiu foi um agente (migração 110). */
  revisado_por_agente?: string | null;
  revisao_motivo?: string | null;
  revisao_confianca?: number | null;
}

/** Linha "Revisor …: motivo" embaixo do item. */
function MotivoDoAgente({ item, verbo }: { item: Item; verbo: string }) {
  if (!item.revisado_por_agente || !item.revisao_motivo) return null;
  const confianca =
    item.revisao_confianca != null ? ` · confiança ${Math.round(Number(item.revisao_confianca) * 100)}%` : "";
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-aura-graphite-soft">
      <BadgeCheck size={13} className="mt-px shrink-0 text-aura-petrol-600" />
      <span>
        <span className="font-medium text-aura-graphite">Revisor {verbo}:</span> {item.revisao_motivo}
        {confianca}
      </span>
    </p>
  );
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
  const [recusadosAgente, setRecusadosAgente] = useState<Item[]>([]);
  const [verRecusados, setVerRecusados] = useState(false);
  const [sugestoes, setSugestoes] = useState<ResumoSugestoes | null>(null);
  // Todo gestor escolhe a loja; aprovar e recusar só na própria (ou mestre).
  const [loja, setLoja] = useState<string | null>(null);
  const [podeDecidir, setPodeDecidir] = useState(true);
  const [lojas, setLojas] = useState<{ nome: string; esperando: number }[] | null>(null);
  // O que o Revisor ainda vai decidir sozinho (não aparece na lista).
  const [naFila, setNaFila] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/gestor/aprendizado${loja ? `?loja=${encodeURIComponent(loja)}` : ""}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível carregar.");
      setSugeridos(d.sugeridos ?? []);
      setAprovados(d.aprovados ?? []);
      setRecusadosAgente(d.recusadosPeloAgente ?? []);
      setSugestoes(d.sugestoes ?? null);
      setLojas(d.lojas ?? null);
      setPodeDecidir(d.podeDecidir !== false);
      setNaFila(Number(d.naFilaDoRevisor) || 0);
      if (!loja && d.loja) setLoja(d.loja);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [loja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(item: Item, acao: "aprovar" | "recusar" | "desfazer") {
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
      if (acao === "desfazer") {
        // Volta a esperar revisão, sem a marca do agente.
        const limpo: Item = {
          ...item,
          status: "sugerido",
          aprovado_auto: false,
          revisado_por_agente: null,
          revisao_motivo: null,
          revisao_confianca: null,
        };
        setAprovados((atual) => atual.filter((i) => i.id !== item.id));
        setRecusadosAgente((atual) => atual.filter((i) => i.id !== item.id));
        setSugeridos((atual) => [limpo, ...atual.filter((i) => i.id !== item.id)]);
        return;
      }
      setSugeridos((atual) => atual.filter((i) => i.id !== item.id));
      setRecusadosAgente((atual) => atual.filter((i) => i.id !== item.id));
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
    <Card>
      <CardHeader
        titulo="O que a AURA aprendeu"
        descricao="Tirado dos negócios fechados e perdidos e das conversas. O Revisor do Aprendizado (agente) estuda os materiais da loja e as conversas dos vendedores e decide sozinho: aprova ou recusa, com o motivo. Aqui fica só política da loja (preço, desconto, prazo, garantia, pagamento) que o material não responde. Você pode desfazer qualquer decisão dele."
        icone={GraduationCap}
        acoes={
          sugeridos.length > 0 ? (
            <Selo tom="ouro">{sugeridos.length} para revisar</Selo>
          ) : undefined
        }
      />

      {lojas && (
        <Segmentado
          rotulo="Loja"
          opcoes={lojas.map((l) => ({
            valor: l.nome,
            rotulo: l.nome,
            contagem: l.esperando > 0 ? l.esperando : undefined,
          }))}
          valor={loja ?? ""}
          aoMudar={(v) => setLoja(v)}
        />
      )}

      {erro && <Alerta tom="perigo" titulo={erro} className="mt-4" />}

      {naFila > 0 && (
        <p className="mt-3 text-xs text-aura-graphite-soft">
          {naFila} {naFila === 1 ? "sugestão está" : "sugestões estão"} na fila do Revisor: ele estuda e decide sozinho nas próximas rodadas.
        </p>
      )}

      {carregando ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : sugeridos.length === 0 ? (
        <EstadoVazio
          className="mt-5"
          icone={GraduationCap}
          titulo="Nada esperando a sua decisão."
          descricao="O Revisor decide sozinho o que a AURA aprende; aqui aparece só política da loja que o material não responde."
        />
      ) : (
        <ul className="mt-5 space-y-3">
          {sugeridos.map((item) => {
            const emEdicao = editando === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-aura-mist p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Selo tom="marca">{ROTULO[item.tipo] ?? item.tipo}</Selo>
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
                      className="aura-input"
                    />
                    <textarea
                      value={rascunho.resposta}
                      onChange={(e) =>
                        setRascunho((r) => ({ ...r, resposta: e.target.value }))
                      }
                      rows={3}
                      placeholder="A resposta que a AURA deve usar"
                      className="aura-input"
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
                    <MotivoDoAgente item={item} verbo="deixou para você" />
                  </div>
                )}

                {!podeDecidir ? (
                  <p className="mt-3 text-xs text-aura-graphite-soft">Quem aprova é o gestor desta loja.</p>
                ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado === item.id}
                    onClick={() => void decidir(item, "aprovar")}
                    className={classeBotao("primario", "sm")}
                  >
                    {ocupado === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Check size={13} />
                    )}
                    {emEdicao ? "Salvar e aprovar" : "Aprovar"}
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === item.id}
                    onClick={() => void decidir(item, "recusar")}
                    className={classeBotao("perigo-suave", "sm")}
                  >
                    <X size={13} /> Recusar
                  </button>
                  {!emEdicao && (
                    <button
                      type="button"
                      onClick={() => abrirEdicao(item)}
                      className={classeBotao("fantasma", "sm")}
                    >
                      <Pencil size={13} /> Ajustar o texto
                    </button>
                  )}
                </div>
                )}
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
            <ul className="mt-3 divide-y divide-aura-mist">
              {aprovados.map((item) => (
                <li key={item.id} className="py-3 text-sm text-aura-graphite-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-aura-graphite">{ROTULO[item.tipo] ?? item.tipo}</span>
                    {item.revisado_por_agente ? (
                      <Selo tom="marca">aprovado pelo Revisor</Selo>
                    ) : (
                      item.aprovado_auto && <Selo tom="ouro">entrou sozinho</Selo>
                    )}
                    <span className="text-xs">{placar(item)}</span>
                    {podeDecidir && <button
                      type="button"
                      disabled={ocupado === item.id}
                      onClick={() => {
                        if (confirm("Tirar este aprendizado de uso? Ele não volta a ser sugerido.")) void decidir(item, "recusar");
                      }}
                      className={classeBotao("perigo-suave", "sm", "ml-auto")}
                    >
                      <X size={12} /> Tirar de uso
                    </button>}
                    {podeDecidir && item.revisado_por_agente && (
                      <button
                        type="button"
                        disabled={ocupado === item.id}
                        onClick={() => void decidir(item, "desfazer")}
                        className={classeBotao("fantasma", "sm")}
                        title="Volta para a lista de revisão"
                      >
                        <Undo2 size={12} /> Desfazer
                      </button>
                    )}
                  </div>
                  <p className="mt-1">
                    &ldquo;{item.gatilho}&rdquo; → {item.resposta}
                  </p>
                  <MotivoDoAgente item={item} verbo="aprovou" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recusadosAgente.length > 0 && (
        <div className="mt-6 border-t border-aura-mist pt-4">
          <button
            type="button"
            onClick={() => setVerRecusados((v) => !v)}
            className="text-sm font-medium text-aura-petrol-600 hover:underline"
          >
            {verRecusados ? "Esconder" : "Ver"} os {recusadosAgente.length} recusados pelo Revisor
          </button>
          {verRecusados && (
            <ul className="mt-3 divide-y divide-aura-mist">
              {recusadosAgente.map((item) => (
                <li key={item.id} className="py-3 text-sm text-aura-graphite-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-aura-graphite">{ROTULO[item.tipo] ?? item.tipo}</span>
                    <Selo tom="perigo">recusado pelo Revisor</Selo>
                    {podeDecidir && (
                      <button
                        type="button"
                        disabled={ocupado === item.id}
                        onClick={() => void decidir(item, "desfazer")}
                        className={classeBotao("fantasma", "sm", "ml-auto")}
                        title="Volta para a lista de revisão"
                      >
                        <Undo2 size={12} /> Desfazer
                      </button>
                    )}
                  </div>
                  <p className="mt-1">
                    &ldquo;{item.gatilho}&rdquo; → {item.resposta}
                  </p>
                  <MotivoDoAgente item={item} verbo="recusou" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sugestoes && sugestoes.total > 0 && (
        <div className="mt-6 border-t border-aura-mist pt-4">
          <p className="text-sm font-semibold text-aura-graphite">
            Sugestões de resposta da AURA · últimos {sugestoes.dias} dias
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Usadas como estavam", sugestoes.usou],
              ["Adaptadas", sugestoes.adaptou],
              ["Ignoradas", sugestoes.ignorou],
              ["Automáticas", sugestoes.automatica],
            ].map(([rotulo, n]) => (
              <div key={rotulo as string} className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3 py-2.5">
                <p className="aura-rotulo truncate">{rotulo as string}</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums text-aura-graphite">{n as number}</p>
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

      <p className="mt-5 border-t border-aura-mist pt-4 text-xs text-aura-graphite-soft">
        Em conflito com o manual de vendas, o manual manda — isto entra como
        complemento, nunca por cima da regra da casa.
      </p>
    </Card>
  );
}
