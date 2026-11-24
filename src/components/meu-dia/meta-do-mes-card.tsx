"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { classeBotao } from "@/components/ui";
import { CampoMoeda } from "@/components/shared/campo-moeda";
import { digitosParaNumero, formatarReais } from "@/lib/formato/moeda";

interface MetaDoMesCardProps {
  valor: number | null;
  atingido: number;
  onDefinir?: (valor: number) => Promise<boolean | void>;
}

export function MetaDoMesCard({ valor, atingido, onDefinir }: MetaDoMesCardProps) {
  const [editando, setEditando] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const moeda = (numero: number) => formatarReais(numero, true);
  async function salvarMeta() {
    if (!onDefinir) return;
    const numero = digitosParaNumero(entrada);
    if (!Number.isFinite(numero) || numero <= 0) {
      setErro("Informe um valor de meta maior que zero.");
      return;
    }
    /*
     * Confirmação de ordem de grandeza. O banco mostra por que ela é
     * necessária: em outubro entrou uma meta de R$ 2.000.000 (zero a mais) e
     * uma de R$ 300 (três zeros a menos). O campo nunca mostrou a quem digitou
     * o que tinha acabado de escrever.
     */
    if (numero < 1000 || numero >= 1_000_000) {
      const certeza = confirm(
        `Confirmar a meta de ${formatarReais(numero)}?\n\n` +
          (numero < 1000
            ? "Esse valor é menor que mil reais. Se você quis dizer mil, digite 1000; se quis duzentos mil, digite 200000."
            : "Esse valor passa de um milhão de reais. Confira se não sobrou um zero."),
      );
      if (!certeza) return;
    }
    setSalvando(true);
    setErro("");
    try {
      const sucesso = await onDefinir(numero);
      if (sucesso !== false) {
        setEditando(false);
        setEntrada("");
      } else {
        setErro("Não foi possível salvar a meta. Verifique o banco de dados e tente novamente.");
      }
    } catch {
      setErro("Não foi possível salvar a meta. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }
  if (!valor) {
    return (
      <div className="aura-card p-4">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} className="text-aura-petrol-600" />
          <h3 className="aura-rotulo">Meta do Mês</h3>
        </div>
        <p className="mt-2 text-sm text-aura-graphite-soft">Meta não definida para este mês.</p>
        {onDefinir && !editando && <button type="button" onClick={() => setEditando(true)} className={classeBotao("primario", "sm", "mt-3")}>Definir meta</button>}
        {editando && <div className="mt-3 space-y-2">
          <CampoMoeda autoFocus valor={entrada} onChange={setEntrada} placeholder="50.000" />
          {erro && <p className="text-xs text-aura-danger">{erro}</p>}
          <div className="flex gap-2"><button type="button" disabled={salvando} onClick={() => void salvarMeta()} className={classeBotao("primario", "sm")}>{salvando ? "Salvando..." : "Salvar meta"}</button><button type="button" onClick={() => { setEditando(false); setErro(""); }} className={classeBotao("secundario", "sm")}>Cancelar</button></div>
        </div>}
      </div>
    );
  }

  const percentual = Math.round((atingido / valor) * 100);
  const restante = Math.max(0, valor - atingido);

  return (
    <div className="aura-card p-4">
      <div className="flex items-center gap-1.5">
        <TrendingUp size={13} className="text-aura-petrol-600" />
        <h3 className="aura-rotulo">Meta do Mês</h3>
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex items-end justify-between">
          <span className="font-display text-3xl font-semibold tabular-nums text-aura-graphite">{percentual}%</span>
          <span className="pb-1 text-xs text-aura-graphite-soft">Progresso</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-aura-sunken">
          <div
            className={`h-full rounded-full transition-all ${
              percentual >= 100
                ? "bg-aura-success"
                : percentual >= 75
                ? "bg-aura-gold"
                : percentual >= 50
                ? "bg-aura-petrol-500"
                : "bg-aura-danger"
            }`}
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 pt-1 text-xs tabular-nums">
          <span className="text-aura-graphite-soft">
            {moeda(atingido)} de {moeda(valor)}
          </span>
          <span className="text-aura-graphite-soft">
            Restante: {moeda(restante)}
          </span>
        </div>
      </div>
    </div>
  );
}
