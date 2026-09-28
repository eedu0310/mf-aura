"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2, Trophy } from "lucide-react";

interface Criterio {
  id: string;
  medida: string;
  titulo: string;
  descricao: string | null;
  peso: number;
  meta_mes: number;
  categoria_alvo: string | null;
  ativo: boolean;
  ordem: number;
}

interface Medida {
  valor: string;
  rotulo: string;
  ajuda: string;
}

interface Config {
  bonus_crm_minimo: number;
  bonus_descricao: string | null;
  mf_no_ranking_do_grupo: boolean;
}

const vazio = {
  medida: "prospeccao",
  titulo: "",
  descricao: "",
  peso: "1",
  metaMes: "5",
  categoriaAlvo: "",
};

/** Onde o gestor decide o que conta no ranking, quanto pesa e onde fica o bônus. */
export function RankingConfigTab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(vazio);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/gestor/ranking-config", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui carregar.");
      setConfig(json.config);
      setCriterios(json.criterios ?? []);
      setMedidas(json.medidas ?? []);
      setCategorias(json.categorias ?? []);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function avisarSalvo(o: string) {
    setSalvo(o);
    window.setTimeout(() => setSalvo(""), 1800);
  }

  async function ajustarConfig(patch: Record<string, unknown>) {
    await fetch("/api/gestor/ranking-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    avisarSalvo("config");
    await carregar();
  }

  async function editarCriterio(id: string, patch: Record<string, unknown>) {
    await fetch("/api/gestor/ranking-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    avisarSalvo(id);
    await carregar();
  }

  async function criarCriterio() {
    if (!novo.titulo.trim()) {
      setErro("Dê um nome ao critério.");
      return;
    }
    setCriando(true);
    setErro("");
    const res = await fetch("/api/gestor/ranking-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setErro(json.erro ?? "Não consegui criar.");
    else {
      setNovo(vazio);
      await carregar();
    }
    setCriando(false);
  }

  async function removerCriterio(id: string) {
    await fetch(`/api/gestor/ranking-config?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
      </div>
    );
  }

  const ativos = criterios.filter((c) => c.ativo);
  const somaPesos = ativos.reduce((s, c) => s + Number(c.peso), 0);
  const desbalanceado = ativos.length > 0 && Math.abs(somaPesos - 10) > 0.05;

  return (
    <div className="space-y-5">
      <p className="text-sm text-aura-graphite-soft">
        A nota de cada vendedor no mês vai de 0 a 10. Cada critério vale um peso, e o vendedor
        leva o peso inteiro quando cumpre a meta — metade da meta, metade do peso.
      </p>

      {desbalanceado && (
        <p className="flex items-start gap-2 rounded-xl border border-aura-warning/40 bg-aura-warning/5 px-4 py-3 text-sm text-aura-graphite">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-aura-warning" />
          <span>
            Os pesos somam <strong>{somaPesos.toFixed(1)}</strong>, não 10. O sistema ajusta a
            escala sozinho, então a nota continua indo até 10 — mas fica mais fácil de explicar
            para a equipe quando a soma bate.
          </span>
        </p>
      )}

      {/* Critérios */}
      <section className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-aura-graphite">
          <Trophy size={15} className="text-aura-gold" />
          O que conta no ranking
        </h3>
        <p className="mb-4 text-xs text-aura-graphite-soft">
          Desligue o que não quiser usar em vez de apagar — assim o histórico do mês não se perde.
        </p>

        <ul className="divide-y divide-aura-mist">
          {criterios.map((c) => (
            <li key={c.id} className={`py-4 ${c.ativo ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-40 flex-1 text-xs text-aura-graphite-soft">
                  Nome
                  <input
                    defaultValue={c.titulo}
                    onBlur={(e) =>
                      e.target.value !== c.titulo && void editarCriterio(c.id, { titulo: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm text-aura-graphite focus:border-aura-petrol-500 focus:outline-none"
                  />
                </label>

                <label className="w-24 text-xs text-aura-graphite-soft">
                  Peso
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    defaultValue={Number(c.peso)}
                    onBlur={(e) =>
                      Number(e.target.value) !== Number(c.peso) &&
                      void editarCriterio(c.id, { peso: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm tabular-nums focus:border-aura-petrol-500 focus:outline-none"
                  />
                </label>

                <label className="w-28 text-xs text-aura-graphite-soft">
                  Meta no mês
                  <input
                    type="number"
                    step="1"
                    min="1"
                    defaultValue={Number(c.meta_mes)}
                    onBlur={(e) =>
                      Number(e.target.value) !== Number(c.meta_mes) &&
                      void editarCriterio(c.id, { metaMes: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm tabular-nums focus:border-aura-petrol-500 focus:outline-none"
                  />
                </label>

                <label className="flex items-center gap-1.5 pb-2 text-xs text-aura-graphite">
                  <input
                    type="checkbox"
                    checked={c.ativo}
                    onChange={(e) => void editarCriterio(c.id, { ativo: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Ativo
                </label>

                <button
                  type="button"
                  onClick={() => void removerCriterio(c.id)}
                  aria-label={`Remover ${c.titulo}`}
                  className="mb-1 rounded-lg p-2 text-aura-graphite-soft hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <p className="mt-1.5 text-xs text-aura-graphite-soft">
                {medidas.find((m) => m.valor === c.medida)?.ajuda ?? c.medida}
                {c.categoria_alvo ? ` · categoria: ${c.categoria_alvo}` : ""}
                {salvo === c.id && (
                  <span className="ml-2 inline-flex items-center gap-1 text-aura-success">
                    <Check size={11} /> salvo
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>

        {/* Novo critério */}
        <div className="mt-4 rounded-xl border border-dashed border-aura-mist p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
            Acrescentar critério
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-44 flex-1 text-xs text-aura-graphite-soft">
              O que mede
              <select
                value={novo.medida}
                onChange={(e) => setNovo({ ...novo, medida: e.target.value })}
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm text-aura-graphite focus:border-aura-petrol-500 focus:outline-none"
              >
                {medidas.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </label>

            {novo.medida === "prospeccao" && (
              <label className="min-w-40 text-xs text-aura-graphite-soft">
                Categoria
                <select
                  value={novo.categoriaAlvo}
                  onChange={(e) => setNovo({ ...novo, categoriaAlvo: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="min-w-40 flex-1 text-xs text-aura-graphite-soft">
              Nome que a equipe vê
              <input
                value={novo.titulo}
                onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
                placeholder="Ex.: Prospecção de arquitetos"
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>

            <label className="w-24 text-xs text-aura-graphite-soft">
              Peso
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={novo.peso}
                onChange={(e) => setNovo({ ...novo, peso: e.target.value })}
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm tabular-nums focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>

            <label className="w-28 text-xs text-aura-graphite-soft">
              Meta no mês
              <input
                type="number"
                step="1"
                min="1"
                value={novo.metaMes}
                onChange={(e) => setNovo({ ...novo, metaMes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm tabular-nums focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => void criarCriterio()}
              disabled={criando}
              className="mb-0.5 flex items-center gap-1.5 rounded-lg bg-aura-navy-950 px-4 py-2 text-sm font-medium text-aura-gold disabled:opacity-60"
            >
              {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Acrescentar
            </button>
          </div>
          <p className="mt-2 text-xs text-aura-graphite-soft">
            {medidas.find((m) => m.valor === novo.medida)?.ajuda}
          </p>
        </div>
      </section>

      {/* Bônus e MF */}
      <section className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-aura-graphite">Bônus e participação</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-aura-graphite">
            Bônus só sai com o CRM preenchido em
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                defaultValue={config?.bonus_crm_minimo ?? 80}
                onBlur={(e) =>
                  Number(e.target.value) !== config?.bonus_crm_minimo &&
                  void ajustarConfig({ bonusCrmMinimo: e.target.value })
                }
                className="w-24 rounded-lg border border-aura-mist px-3 py-2 text-sm tabular-nums focus:border-aura-petrol-500 focus:outline-none"
              />
              <span className="text-sm text-aura-graphite-soft">%</span>
            </div>
            <span className="mt-1 block text-xs text-aura-graphite-soft">
              A AURA mede: próximo contato marcado, categoria do cliente e último contato
              registrado.
            </span>
          </label>

          <label className="text-sm text-aura-graphite">
            Nome do bônus
            <input
              defaultValue={config?.bonus_descricao ?? ""}
              onBlur={(e) =>
                e.target.value !== config?.bonus_descricao &&
                void ajustarConfig({ bonusDescricao: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-aura-mist bg-aura-bg/50 p-3">
          <input
            type="checkbox"
            checked={config?.mf_no_ranking_do_grupo ?? false}
            onChange={(e) => void ajustarConfig({ mfNoRanking: e.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-aura-graphite">
            Mostrar a MF International no ranking das lojas
            <span className="mt-0.5 block text-xs text-aura-graphite-soft">
              A MF é fábrica e vende para revendedor, não para cliente final — disputar com as
              lojas distorce os dois lados. Desligado, a equipe da MF continua vendo o próprio
              ranking normalmente; ela só não aparece para as lojas.
            </span>
          </span>
        </label>

        {salvo === "config" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-aura-success">
            <Check size={12} /> salvo
          </p>
        )}
      </section>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
