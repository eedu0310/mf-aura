"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  GitBranch,
  Loader2,
  Plus,
} from "lucide-react";

interface Etapa {
  id?: string | null;
  nome: string;
  ordem: number;
  tipo: string;
  conta_no_pipeline: boolean;
  probabilidade: string;
  cor: string;
  ativa: boolean;
  chave: string | null;
}

const ROTULO_TIPO: Record<string, string> = {
  aberta: "Em andamento",
  ganho: "Fechamento (registra a venda)",
  perda: "Perdidos (encerra sem venda)",
  posvenda: "Pós-venda",
};

export function FunilTab() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [quantos, setQuantos] = useState<Record<string, number>>({});
  const [nomesOriginais, setNomesOriginais] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/gestor/funil", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não consegui carregar o funil.");
      const lista = (j.etapas ?? []) as Etapa[];
      setEtapas(lista);
      setQuantos(j.quantos ?? {});
      setNomesOriginais(
        Object.fromEntries(lista.filter((e) => e.id).map((e) => [e.id as string, e.nome])),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar o funil.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function mudar(i: number, patch: Partial<Etapa>) {
    setEtapas((a) => a.map((e, k) => (k === i ? { ...e, ...patch } : e)));
    setRecado(null);
  }

  function mover(i: number, direcao: -1 | 1) {
    setEtapas((a) => {
      const j = i + direcao;
      if (j < 0 || j >= a.length) return a;
      const copia = [...a];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia.map((e, k) => ({ ...e, ordem: k + 1 }));
    });
    setRecado(null);
  }

  function adicionar() {
    setEtapas((a) => [
      ...a,
      {
        id: null,
        nome: "",
        ordem: a.length + 1,
        tipo: "aberta",
        conta_no_pipeline: false,
        probabilidade: "Baixa",
        cor: "#8696a0",
        ativa: true,
        // Etapa nova nasce sem papel definido: a IA não move card para uma
        // etapa cujo significado ela não conhece. Quem move é o vendedor.
        chave: null,
      },
    ]);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setRecado(null);
    try {
      const r = await fetch("/api/gestor/funil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapas: etapas.map((e, i) => ({
            id: e.id,
            nome: e.nome,
            ordem: i + 1,
            tipo: e.tipo,
            contaNoPipeline: e.conta_no_pipeline,
            probabilidade: e.probabilidade,
            cor: e.cor,
            ativa: e.ativa,
            chave: e.chave,
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não consegui salvar.");

      const movidos = (j.renomeadas ?? []) as { de: string; para: string; negocios: number }[];
      setRecado(
        movidos.length
          ? `Salvo. ${movidos
              .map((m) => `${m.negocios} negócio(s) de “${m.de}” passaram para “${m.para}”`)
              .join("; ")}.`
          : "Salvo. O funil novo já vale para toda a equipe.",
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-start gap-3">
          <GitBranch size={20} className="mt-0.5 shrink-0 text-aura-petrol-600" />
          <div>
            <h3 className="font-display text-lg font-semibold text-aura-graphite">
              Etapas do funil
            </h3>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              O nome é seu; o papel é do sistema. Renomeie à vontade — quem decide se a venda entra
              no mês é a etapa marcada como <strong>fechamento</strong>, não o nome dela.{" "}
              <strong>Renomear move os negócios junto</strong>, então nenhum card fica para trás.
            </p>
          </div>
        </div>

        {carregando && (
          <p className="mt-4 flex items-center gap-2 text-sm text-aura-graphite-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        )}
        {erro && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </p>
        )}
        {recado && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{recado}</p>
        )}
      </div>

      {!carregando && (
        <>
          <div className="space-y-3">
            {etapas.map((e, i) => {
              const original = e.id ? nomesOriginais[e.id] : null;
              const vaiRenomear = !!original && original !== e.nome;
              const negocios = original ? (quantos[original] ?? 0) : 0;

              return (
                <div
                  key={e.id ?? `nova-${i}`}
                  className={`rounded-2xl border p-4 ${
                    e.ativa ? "border-aura-mist bg-white" : "border-dashed border-aura-mist bg-aura-bg"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-aura-graphite-soft hover:bg-aura-bg disabled:opacity-30"
                        aria-label="Subir"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(i, 1)}
                        disabled={i === etapas.length - 1}
                        className="rounded p-0.5 text-aura-graphite-soft hover:bg-aura-bg disabled:opacity-30"
                        aria-label="Descer"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <input
                      type="color"
                      value={e.cor}
                      onChange={(ev) => mudar(i, { cor: ev.target.value })}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-aura-mist bg-white p-0.5"
                      title="Cor da etapa no quadro"
                    />

                    <input
                      type="text"
                      value={e.nome}
                      onChange={(ev) => mudar(i, { nome: ev.target.value })}
                      placeholder="Nome da etapa"
                      className="min-w-0 flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm font-medium"
                    />

                    <select
                      value={e.tipo}
                      onChange={(ev) => mudar(i, { tipo: ev.target.value })}
                      className="rounded-lg border border-aura-mist px-2 py-2 text-sm"
                    >
                      {Object.entries(ROTULO_TIPO).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>

                    <select
                      value={e.probabilidade}
                      onChange={(ev) => mudar(i, { probabilidade: ev.target.value })}
                      className="rounded-lg border border-aura-mist px-2 py-2 text-sm"
                      title="Chance de fechar, usada na previsão"
                    >
                      {["Baixa", "Média", "Alta"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 text-aura-graphite-soft">
                      <input
                        type="checkbox"
                        checked={e.conta_no_pipeline}
                        onChange={(ev) => mudar(i, { conta_no_pipeline: ev.target.checked })}
                        className="rounded border-aura-mist"
                      />
                      Conta no pipeline (entra no valor em aberto)
                    </label>
                    <label className="flex items-center gap-2 text-aura-graphite-soft">
                      <input
                        type="checkbox"
                        checked={e.ativa}
                        onChange={(ev) => mudar(i, { ativa: ev.target.checked })}
                        className="rounded border-aura-mist"
                      />
                      Em uso
                    </label>
                    {negocios > 0 && (
                      <span className="text-aura-graphite-soft">
                        {negocios} negócio(s) aqui hoje
                      </span>
                    )}
                    {!e.chave && e.id && (
                      <span className="text-amber-700">
                        Sem papel conhecido: só o vendedor move cards para cá
                      </span>
                    )}
                  </div>

                  {vaiRenomear && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                      Ao salvar, “{original}” vira “{e.nome}”
                      {negocios > 0 ? ` e os ${negocios} negócio(s) vão junto` : ""}.
                    </p>
                  )}
                  {!e.ativa && negocios > 0 && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                      Esta etapa tem {negocios} negócio(s). Desligada, ela some do quadro e esses
                      cards ficam sem coluna — mova-os antes.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={adicionar}
              className="flex items-center gap-2 rounded-full border border-aura-mist bg-white px-4 py-2 text-sm text-aura-graphite hover:bg-aura-bg"
            >
              <Plus className="h-4 w-4" /> Nova etapa
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-5 py-2 text-sm font-medium text-aura-gold hover:bg-aura-navy-900 disabled:opacity-60"
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar funil
            </button>
          </div>
        </>
      )}
    </div>
  );
}
