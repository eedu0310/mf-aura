"use client";

/**
 * Metas de prospecção, pontuação e prêmios.
 *
 * A meta é por pessoa: 200 para um representante, 400 para outro, ajustada mês
 * a mês até chegar no número. A pontuação de cada etapa e de cada tipo de
 * atividade também é editável por mês — quem decide quanto vale uma visita é o
 * gestor, não o sistema.
 *
 * O placar não é editável. Ele é somado dos registros, porque uma premiação
 * cujo número pode ser digitado à mão perde a graça no primeiro mês.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Trophy, Target, Save, Award } from "lucide-react";
import { Alerta, Card, CardHeader, EstadoVazio, Selo, classeBotao } from "@/components/ui";

interface Vendedor {
  id: string;
  nome: string;
  meta: number | null;
  prospeccoes: number;
  falta: number | null;
  percentual: number | null;
  pontos: number;
  pontosAtividades: number;
  pontosEtapas: number;
}

interface Regra {
  id: string;
  mes: string;
  tipo: "atividade" | "etapa";
  chave: string;
  pontos: number;
}

interface Premio {
  id: string;
  escopo: string;
  periodo: string;
  descricao: string;
  vencedor: string | null;
  pontos_na_apuracao: number | null;
  entregue: boolean;
}

interface Resposta {
  loja: string;
  mes: string;
  ano: string;
  regras: Regra[];
  vendedores: Vendedor[];
  anual: { id: string; nome: string; pontos: number; atividades: number; meses: number }[];
  premios: Premio[];
}

export function PontuacaoTab() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [metas, setMetas] = useState<Record<string, string>>({});
  const [pontos, setPontos] = useState<Record<string, string>>({});
  const [premioMes, setPremioMes] = useState("");
  const [premioAno, setPremioAno] = useState("");

  const carregar = useCallback(async (m: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/gestor/pontuacao?mes=${m}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não foi possível carregar.");
      setD(j);
      setMetas(
        Object.fromEntries(
          (j.vendedores as Vendedor[]).map((v) => [v.id, v.meta != null ? String(v.meta) : ""]),
        ),
      );
      setPontos(
        Object.fromEntries(
          (j.regras as Regra[]).map((g) => [`${g.tipo}:${g.chave}`, String(g.pontos)]),
        ),
      );
      const pm = (j.premios as Premio[]).find((p) => p.escopo === "mensal" && p.periodo === m);
      setPremioMes(pm?.descricao ?? "");
      const pa = (j.premios as Premio[]).find((p) => p.escopo === "anual" && p.periodo === j.ano);
      setPremioAno(pa?.descricao ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(mes);
  }, [carregar, mes]);

  async function enviar(corpo: Record<string, unknown>, marca: string, msg: string) {
    setSalvando(marca);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch("/api/gestor/pontuacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não foi possível salvar.");
      setAviso(msg);
      await carregar(mes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  }

  const regrasPorTipo = (tipo: "atividade" | "etapa") => {
    const vistos = new Set<string>();
    return (d?.regras ?? [])
      .filter((g) => g.tipo === tipo)
      // A regra do mês ganha da padrão quando as duas existem para a mesma chave.
      .sort((a, b) => (a.mes === mes ? -1 : 1) - (b.mes === mes ? -1 : 1))
      .filter((g) => (vistos.has(g.chave) ? false : (vistos.add(g.chave), true)))
      .sort((a, b) => b.pontos - a.pontos);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho e mês */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-aura-graphite-soft">
          A meta é por pessoa e o peso de cada etapa é seu. O placar é
          somado dos registros.
        </p>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="aura-input w-auto"
        />
      </div>

      {erro && <Alerta tom="perigo" titulo={erro} />}
      {aviso && <Alerta tom="sucesso" titulo={aviso} />}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : !d ? null : (
        <>
          {/* Metas por vendedor */}
          <Card>
            <CardHeader
              titulo="Meta de prospecção do mês"
              descricao="Lead, ligação e visita somados. Comece menor e vá ajustando até chegar no número — 200 para alguns, 400 para quem já roda mais."
              icone={Target}
            />

            {d.vendedores.length === 0 ? (
              <EstadoVazio titulo="Nenhum vendedor nesta loja." />
            ) : (
              <ul className="divide-y divide-aura-mist rounded-lg border border-aura-mist">
                {d.vendedores.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                  >
                    <span className="min-w-[140px] flex-1 text-sm font-medium text-aura-graphite">
                      {v.nome}
                    </span>
                    <span className="text-xs tabular-nums text-aura-graphite-soft">
                      {v.prospeccoes} feitas
                      {v.percentual !== null && ` · ${v.percentual}% da meta`}
                      {v.falta !== null && v.falta > 0 && ` · faltam ${v.falta}`}
                    </span>
                    <Selo tom="marca" className="tabular-nums">
                      {v.pontos} pts
                    </Selo>
                    <input
                      type="number"
                      min={0}
                      value={metas[v.id] ?? ""}
                      onChange={(e) => setMetas((m) => ({ ...m, [v.id]: e.target.value }))}
                      placeholder="meta"
                      className="aura-input h-8 w-24 px-2.5"
                    />
                    <button
                      type="button"
                      disabled={salvando === `meta-${v.id}` || metas[v.id] === ""}
                      onClick={() =>
                        void enviar(
                          { acao: "meta", vendedorId: v.id, mes, meta: Number(metas[v.id]) },
                          `meta-${v.id}`,
                          `Meta de ${v.nome} salva.`,
                        )
                      }
                      className={classeBotao("secundario", "sm")}
                    >
                      {salvando === `meta-${v.id}` ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      Salvar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Pontos */}
          <div className="grid gap-6 lg:grid-cols-2">
            {(["atividade", "etapa"] as const).map((tipo) => (
              <Card key={tipo}>
                <CardHeader
                  titulo={
                    tipo === "atividade"
                      ? "Quanto vale cada atividade"
                      : "Quanto vale alcançar cada etapa"
                  }
                  descricao={`Vale para ${mes}. Sem valor próprio no mês, usa o padrão.`}
                />
                <div className="flex flex-col gap-1.5">
                  {regrasPorTipo(tipo).map((g) => {
                    const k = `${g.tipo}:${g.chave}`;
                    return (
                      <div
                        key={k}
                        className="flex items-center gap-2 rounded-lg border border-aura-mist px-3 py-1.5"
                      >
                        <span className="flex-1 text-sm text-aura-graphite">{g.chave}</span>
                        {g.mes !== mes && <Selo tom="neutro">padrão</Selo>}
                        <input
                          type="number"
                          min={0}
                          value={pontos[k] ?? ""}
                          onChange={(e) => setPontos((p) => ({ ...p, [k]: e.target.value }))}
                          className="aura-input h-8 w-20 px-2 text-right tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={salvando === k}
                          onClick={() =>
                            void enviar(
                              {
                                acao: "regra",
                                mes,
                                tipo: g.tipo,
                                chave: g.chave,
                                pontos: Number(pontos[k]),
                              },
                              k,
                              `${g.chave}: ${pontos[k]} pontos em ${mes}.`,
                            )
                          }
                          className={classeBotao("secundario", "sm", "w-10")}
                        >
                          {salvando === k ? "…" : "ok"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* Acumulado do ano */}
          <Card>
            <CardHeader
              titulo={`Acumulado de ${d.ano}`}
              descricao="É este placar que decide o prêmio maior do fim do ano."
              icone={Award}
              corIcone="text-aura-gold-700"
            />
            {d.anual.length === 0 ? (
              <EstadoVazio titulo="Sem pontos no ano ainda." />
            ) : (
              <ol className="divide-y divide-aura-mist rounded-lg border border-aura-mist">
                {d.anual.map((a, i) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                        i === 0
                          ? "bg-aura-gold/20 text-aura-gold-700"
                          : "bg-aura-sunken text-aura-graphite-soft"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-aura-graphite">{a.nome}</span>
                    <span className="text-xs text-aura-graphite-soft">
                      {a.atividades} atividades · {a.meses}{" "}
                      {a.meses === 1 ? "mês" : "meses"}
                    </span>
                    <span className="font-display text-sm font-semibold tabular-nums text-aura-graphite">
                      {a.pontos} pts
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Prêmios */}
          <Card>
            <CardHeader titulo="Prêmios" icone={Trophy} corIcone="text-aura-gold-700" />
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="aura-label">
                  Brinde de {mes}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={premioMes}
                    onChange={(e) => setPremioMes(e.target.value)}
                    placeholder="Jantar para dois, hospedagem…"
                    className="aura-input min-w-[200px] flex-1"
                  />
                  <button
                    type="button"
                    disabled={salvando === "premio-mes" || !premioMes.trim()}
                    onClick={() =>
                      void enviar(
                        {
                          acao: "premio",
                          escopo: "mensal",
                          mes,
                          descricao: premioMes,
                          // Quem está na frente no mês leva; fica registrado
                          // com o placar congelado da apuração.
                          vencedorId: d.vendedores[0]?.id ?? null,
                        },
                        "premio-mes",
                        "Brinde do mês salvo.",
                      )
                    }
                    className={classeBotao("primario")}
                  >
                    {salvando === "premio-mes" ? "…" : "Salvar"}
                  </button>
                </div>
                {d.vendedores[0] && (
                  <p className="mt-1.5 text-xs text-aura-graphite-soft">
                    Na frente agora: {d.vendedores[0].nome} com{" "}
                    {d.vendedores[0].pontos} pontos.
                  </p>
                )}
              </div>

              <div>
                <label className="aura-label">
                  Prêmio de {d.ano}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={premioAno}
                    onChange={(e) => setPremioAno(e.target.value)}
                    placeholder="A definir com o gestor de equipes"
                    className="aura-input min-w-[200px] flex-1"
                  />
                  <button
                    type="button"
                    disabled={salvando === "premio-ano" || !premioAno.trim()}
                    onClick={() =>
                      void enviar(
                        {
                          acao: "premio",
                          escopo: "anual",
                          ano: Number(d.ano),
                          descricao: premioAno,
                          vencedorId: d.anual[0]?.id ?? null,
                        },
                        "premio-ano",
                        "Prêmio do ano salvo.",
                      )
                    }
                    className={classeBotao("primario")}
                  >
                    {salvando === "premio-ano" ? "…" : "Salvar"}
                  </button>
                </div>
                {d.anual[0] && (
                  <p className="mt-1.5 text-xs text-aura-graphite-soft">
                    Liderando o ano: {d.anual[0].nome} com {d.anual[0].pontos} pontos.
                  </p>
                )}
              </div>
            </div>

            {d.premios.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-aura-mist pt-4">
                {d.premios.map((p) => (
                  <li key={p.id} className="text-sm text-aura-graphite-soft">
                    <span className="font-medium text-aura-graphite">
                      {p.escopo === "mensal" ? "Mês" : "Ano"} {p.periodo}:
                    </span>{" "}
                    {p.descricao}
                    {p.vencedor && ` — ${p.vencedor}`}
                    {p.pontos_na_apuracao != null && ` (${p.pontos_na_apuracao} pts na apuração)`}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
