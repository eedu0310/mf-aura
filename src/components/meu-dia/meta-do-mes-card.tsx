"use client";

import { useState } from "react";

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
  const moeda = (numero: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(numero);
  async function salvarMeta() {
    if (!onDefinir) return;
    const texto = entrada.trim().replace(/\s/g, "");
    const numero = texto.includes(",") || texto.includes(".")
      ? Number(texto.replace(/\./g, "").replace(",", "."))
      : Number(texto);
    if (!Number.isFinite(numero) || numero <= 0) {
      setErro("Informe um valor de meta maior que zero.");
      return;
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
      <div className="rounded-lg border border-aura-mist bg-white p-4">
        <p className="text-sm text-aura-graphite-soft">Meta não definida para este mês.</p>
        {onDefinir && !editando && <button type="button" onClick={() => setEditando(true)} className="mt-3 rounded-lg bg-aura-petrol-700 px-3 py-2 text-xs font-medium text-white hover:bg-aura-petrol-600">Definir meta</button>}
        {editando && <div className="mt-3 space-y-2">
          <input autoFocus inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void salvarMeta()} placeholder="Ex.: 50000" className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm" />
          {erro && <p className="text-xs text-aura-danger">{erro}</p>}
          <div className="flex gap-2"><button type="button" disabled={salvando} onClick={() => void salvarMeta()} className="rounded-lg bg-aura-petrol-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar meta"}</button><button type="button" onClick={() => { setEditando(false); setErro(""); }} className="rounded-lg border border-aura-mist px-3 py-2 text-xs">Cancelar</button></div>
        </div>}
      </div>
    );
  }

  const percentual = Math.round((atingido / valor) * 100);
  const restante = Math.max(0, valor - atingido);

  return (
    <div className="rounded-lg border border-aura-mist bg-white p-4">
      <h3 className="text-sm font-semibold text-aura-graphite mb-3">
        📈 Meta do Mês
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-aura-graphite-soft">Progresso</span>
          <span className="font-bold text-aura-graphite">{percentual}%</span>
        </div>
        <div className="w-full h-2 bg-aura-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percentual >= 100
                ? "bg-green-600"
                : percentual >= 75
                ? "bg-yellow-600"
                : percentual >= 50
                ? "bg-blue-600"
                : "bg-red-600"
            }`}
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs pt-2">
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
