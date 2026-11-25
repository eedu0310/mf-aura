"use client";

/**
 * Comandos do gestor mestre sobre um agente: ligar/desligar, mudar o teto de
 * gasto do mês e mandar rodar agora. O servidor confere de novo se a pessoa é
 * mestre — esconder o botão é só para não oferecer o que vai ser recusado.
 */
import { useState } from "react";
import { Check, Loader2, Pencil, Play, X } from "lucide-react";
import type { MesaAgente } from "@/lib/agentes/tipos";
import { Botao } from "@/components/ui";
import { comandos, cx, dolar } from "./comum";

/** Chave liga/desliga. Desabilitada enquanto a equipe não foi ativada. */
export function ChaveAtivo({
  mesa,
  habilitado,
  aoMudar,
}: {
  mesa: MesaAgente;
  habilitado: boolean;
  aoMudar: () => void | Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [otimista, setOtimista] = useState<boolean | null>(null);
  const ligado = otimista ?? mesa.ativo;

  async function alternar() {
    setSalvando(true);
    setErro(null);
    setOtimista(!ligado);
    try {
      await comandos.alterar(mesa.id, { ativo: !ligado });
      await aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para mudar.");
    } finally {
      setOtimista(null);
      setSalvando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={ligado ? `Desligar ${mesa.nome}` : `Ligar ${mesa.nome}`}
        disabled={!habilitado || salvando}
        onClick={alternar}
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          ligado ? "border-aura-petrol-600 bg-aura-petrol-600" : "border-aura-mist bg-aura-sunken",
        )}
      >
        <span
          className={cx(
            "inline-block h-3.5 w-3.5 rounded-full bg-aura-surface shadow-sm transition-transform",
            ligado ? "translate-x-[1.1rem]" : "translate-x-0.5",
          )}
        />
      </button>
      {salvando && <Loader2 size={13} className="animate-spin text-aura-graphite-soft" aria-hidden />}
      {erro && <span className="text-xs text-aura-danger">{erro}</span>}
    </span>
  );
}

/** Teto de gasto do mês: mostra o valor; o mestre clica no lápis e edita. */
export function EditorOrcamento({
  mesa,
  podeEditar,
  aoMudar,
}: {
  mesa: MesaAgente;
  podeEditar: boolean;
  aoMudar: () => void | Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setValor(String(mesa.orcamentoMensalUsd).replace(".", ","));
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    const n = Number(valor.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      setErro("Use um valor entre 0 e 1.000 dólares.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await comandos.alterar(mesa.id, { orcamentoMensalUsd: Math.round(n * 100) / 100 });
      await aoMudar();
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="tabular-nums">{dolar(mesa.orcamentoMensalUsd)}</span>
        {podeEditar && (
          <button
            type="button"
            onClick={abrir}
            className="rounded p-1 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            aria-label={`Editar orçamento de ${mesa.nome}`}
          >
            <Pencil size={12} />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-aura-graphite-soft">US$</span>
        <input
          autoFocus
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") setEditando(false);
          }}
          className="aura-input !h-7 w-24 !pl-9 text-xs tabular-nums"
          aria-label="Orçamento mensal em dólar"
        />
      </span>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="aura-btn aura-btn-secundario aura-btn-sm !px-1.5"
        aria-label="Salvar orçamento"
      >
        {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="aura-btn aura-btn-fantasma aura-btn-sm !px-1.5"
        aria-label="Cancelar"
      >
        <X size={13} />
      </button>
      {erro && <span className="w-full text-xs text-aura-danger">{erro}</span>}
    </span>
  );
}

/** "Rodar agora": dispara uma rodada fora da agenda. */
export function BotaoRodar({
  mesa,
  habilitado,
  aoMudar,
  tamanho = "sm",
}: {
  mesa: MesaAgente;
  habilitado: boolean;
  aoMudar: () => void | Promise<void>;
  tamanho?: "sm" | "md";
}) {
  const [rodando, setRodando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);

  async function rodar() {
    setRodando(true);
    setRetorno(null);
    try {
      await comandos.rodar(mesa.id);
      setRetorno({ ok: true, texto: "Rodada pedida. O resultado aparece no escritório em instantes." });
      await aoMudar();
    } catch (e) {
      setRetorno({ ok: false, texto: e instanceof Error ? e.message : "Não deu para rodar agora." });
    } finally {
      setRodando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Botao
        tamanho={tamanho}
        variante="secundario"
        icone={rodando ? Loader2 : Play}
        onClick={rodar}
        disabled={!habilitado || rodando || mesa.estado === "trabalhando"}
        className={rodando ? "[&>svg]:animate-spin" : undefined}
      >
        {mesa.estado === "trabalhando" ? "Já está rodando" : rodando ? "Rodando…" : "Rodar agora"}
      </Botao>
      {retorno && (
        <span className={cx("text-xs", retorno.ok ? "text-aura-success" : "text-aura-danger")}>{retorno.texto}</span>
      )}
    </span>
  );
}
