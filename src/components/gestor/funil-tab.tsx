"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import { Alerta, Selo, classeBotao } from "@/components/ui";

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
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-aura-graphite-soft">
        O nome é seu; o papel é do sistema. Renomeie à vontade — quem decide se a venda entra
        no mês é a etapa marcada como <strong className="font-medium text-aura-graphite">fechamento</strong>, não o nome dela.{" "}
        <strong className="font-medium text-aura-graphite">Renomear move os negócios junto</strong>, então nenhum card fica para trás.
      </p>

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}
      {erro && <Alerta tom="perigo" titulo={erro} />}
      {recado && <Alerta tom="sucesso" titulo={recado} />}

      {!carregando && (
        <>
          <div className="flex flex-col gap-3">
            {etapas.map((e, i) => {
              const original = e.id ? nomesOriginais[e.id] : null;
              const vaiRenomear = !!original && original !== e.nome;
              const negocios = original ? (quantos[original] ?? 0) : 0;

              return (
                <div
                  key={e.id ?? `nova-${i}`}
                  className={
                    e.ativa
                      ? "aura-card p-4"
                      : "rounded-xl border border-dashed border-aura-mist bg-aura-sunken p-4"
                  }
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite disabled:opacity-30"
                        aria-label="Subir"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(i, 1)}
                        disabled={i === etapas.length - 1}
                        className="rounded p-0.5 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite disabled:opacity-30"
                        aria-label="Descer"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <input
                      type="color"
                      value={e.cor}
                      onChange={(ev) => mudar(i, { cor: ev.target.value })}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-aura-mist bg-aura-surface p-0.5"
                      title="Cor da etapa no quadro"
                    />

                    <input
                      type="text"
                      value={e.nome}
                      onChange={(ev) => mudar(i, { nome: ev.target.value })}
                      placeholder="Nome da etapa"
                      className="aura-input min-w-0 flex-1 basis-48 font-medium"
                    />

                    <select
                      value={e.tipo}
                      onChange={(ev) => mudar(i, { tipo: ev.target.value })}
                      className="aura-input w-auto"
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
                      className="aura-input w-auto"
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
                        className="rounded border-aura-mist accent-aura-petrol-600"
                      />
                      Conta no pipeline (entra no valor em aberto)
                    </label>
                    <label className="flex items-center gap-2 text-aura-graphite-soft">
                      <input
                        type="checkbox"
                        checked={e.ativa}
                        onChange={(ev) => mudar(i, { ativa: ev.target.checked })}
                        className="rounded border-aura-mist accent-aura-petrol-600"
                      />
                      Em uso
                    </label>
                    {negocios > 0 && (
                      <Selo tom="neutro">
                        {negocios} negócio(s) aqui hoje
                      </Selo>
                    )}
                    {!e.chave && e.id && (
                      <Selo tom="atencao">
                        Sem papel conhecido: só o vendedor move cards para cá
                      </Selo>
                    )}
                  </div>

                  {vaiRenomear && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 text-xs text-aura-graphite">
                      <AlertTriangle size={13} className="mt-px shrink-0 text-aura-warning" />
                      <span>
                        Ao salvar, “{original}” vira “{e.nome}”
                        {negocios > 0 ? ` e os ${negocios} negócio(s) vão junto` : ""}.
                      </span>
                    </p>
                  )}
                  {!e.ativa && negocios > 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-aura-danger/30 bg-aura-danger/5 px-3 py-2 text-xs text-aura-graphite">
                      <AlertCircle size={13} className="mt-px shrink-0 text-aura-danger" />
                      <span>
                        Esta etapa tem {negocios} negócio(s). Desligada, ela some do quadro e esses
                        cards ficam sem coluna — mova-os antes.
                      </span>
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
              className={classeBotao("secundario")}
            >
              <Plus className="h-4 w-4" /> Nova etapa
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className={classeBotao("primario")}
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
