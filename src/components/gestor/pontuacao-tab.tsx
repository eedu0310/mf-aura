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
    <div className="space-y-5">
      {/* Cabeçalho e mês */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Trophy size={20} className="mt-0.5 shrink-0 text-aura-gold" />
            <div>
              <h3 className="font-display text-lg font-semibold text-aura-graphite">
                Metas, pontuação e prêmios
              </h3>
              <p className="mt-1 text-sm text-aura-graphite-soft">
                A meta é por pessoa e o peso de cada etapa é seu. O placar é
                somado dos registros.
              </p>
            </div>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
          />
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="mt-4 rounded-lg bg-aura-success/10 px-3 py-2 text-sm text-aura-success">
            {aviso}
          </p>
        )}
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : !d ? null : (
        <>
          {/* Metas por vendedor */}
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <p className="flex items-center gap-2 font-display text-base font-semibold text-aura-graphite">
              <Target size={17} className="text-aura-petrol-600" />
              Meta de prospecção do mês
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              Lead, ligação e visita somados. Comece menor e vá ajustando até
              chegar no número — 200 para alguns, 400 para quem já roda mais.
            </p>

            {d.vendedores.length === 0 ? (
              <p className="mt-4 text-sm text-aura-graphite-soft">
                Nenhum vendedor nesta loja.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {d.vendedores.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-aura-mist p-3"
                  >
                    <span className="min-w-[140px] flex-1 text-sm font-medium text-aura-graphite">
                      {v.nome}
                    </span>
                    <span className="text-sm text-aura-graphite-soft">
                      {v.prospeccoes} feitas
                      {v.percentual !== null && ` · ${v.percentual}% da meta`}
                      {v.falta !== null && v.falta > 0 && ` · faltam ${v.falta}`}
                    </span>
                    <span className="rounded-full bg-aura-navy-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {v.pontos} pts
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={metas[v.id] ?? ""}
                      onChange={(e) => setMetas((m) => ({ ...m, [v.id]: e.target.value }))}
                      placeholder="meta"
                      className="w-24 rounded-lg border border-aura-mist px-2.5 py-1.5 text-sm outline-none focus:border-aura-petrol-500"
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-aura-petrol-700 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {salvando === `meta-${v.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Salvar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pontos */}
          {(["atividade", "etapa"] as const).map((tipo) => (
            <div key={tipo} className="rounded-2xl border border-aura-mist bg-white p-5">
              <p className="font-display text-base font-semibold text-aura-graphite">
                {tipo === "atividade"
                  ? "Quanto vale cada atividade"
                  : "Quanto vale alcançar cada etapa"}
              </p>
              <p className="mt-1 text-sm text-aura-graphite-soft">
                Vale para {mes}. Sem valor próprio no mês, usa o padrão.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {regrasPorTipo(tipo).map((g) => {
                  const k = `${g.tipo}:${g.chave}`;
                  return (
                    <div
                      key={k}
                      className="flex items-center gap-2 rounded-lg border border-aura-mist px-3 py-2"
                    >
                      <span className="flex-1 text-sm text-aura-graphite">{g.chave}</span>
                      {g.mes !== mes && (
                        <span className="text-xs text-aura-graphite-soft">padrão</span>
                      )}
                      <input
                        type="number"
                        min={0}
                        value={pontos[k] ?? ""}
                        onChange={(e) => setPontos((p) => ({ ...p, [k]: e.target.value }))}
                        className="w-20 rounded-lg border border-aura-mist px-2 py-1 text-sm outline-none focus:border-aura-petrol-500"
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
                        className="rounded-lg bg-aura-petrol-700 px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {salvando === k ? "…" : "ok"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Acumulado do ano */}
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <p className="flex items-center gap-2 font-display text-base font-semibold text-aura-graphite">
              <Award size={17} className="text-aura-gold" />
              Acumulado de {d.ano}
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              É este placar que decide o prêmio maior do fim do ano.
            </p>
            {d.anual.length === 0 ? (
              <p className="mt-4 text-sm text-aura-graphite-soft">Sem pontos no ano ainda.</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {d.anual.map((a, i) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-aura-mist px-3 py-2"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-aura-gold text-aura-graphite"
                          : "bg-aura-mist text-aura-graphite-soft"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-aura-graphite">{a.nome}</span>
                    <span className="text-sm text-aura-graphite-soft">
                      {a.atividades} atividades · {a.meses}{" "}
                      {a.meses === 1 ? "mês" : "meses"}
                    </span>
                    <span className="font-display text-base font-bold text-aura-graphite">
                      {a.pontos} pts
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Prêmios */}
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <p className="font-display text-base font-semibold text-aura-graphite">Prêmios</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-aura-graphite">
                  Brinde de {mes}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    value={premioMes}
                    onChange={(e) => setPremioMes(e.target.value)}
                    placeholder="Jantar para dois, hospedagem…"
                    className="min-w-[200px] flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
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
                    className="rounded-lg bg-aura-gold px-4 py-2 text-sm font-medium text-aura-graphite transition hover:opacity-90 disabled:opacity-50"
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
                <label className="block text-sm font-medium text-aura-graphite">
                  Prêmio de {d.ano}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    value={premioAno}
                    onChange={(e) => setPremioAno(e.target.value)}
                    placeholder="A definir com o gestor de equipes"
                    className="min-w-[200px] flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
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
                    className="rounded-lg bg-aura-gold px-4 py-2 text-sm font-medium text-aura-graphite transition hover:opacity-90 disabled:opacity-50"
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
          </div>
        </>
      )}
    </div>
  );
}
