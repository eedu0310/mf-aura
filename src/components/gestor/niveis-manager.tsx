"use client";

import { useEffect, useState } from "react";
import { Medal, Plus, Trash2 } from "lucide-react";
import { listarNiveis, criarNivel, apagarNivel, type NivelPerformance } from "@/lib/supabase/niveis";
import { useUserProfile } from "@/lib/user-profile-context";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function NiveisManager() {
  const { profile } = useUserProfile();
  const [niveis, setNiveis] = useState<NivelPerformance[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [metaValor, setMetaValor] = useState("");
  const [premio, setPremio] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const lista = await listarNiveis();
    if (lista) setNiveis(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valorNumerico = Number(metaValor.replace(/\D/g, ""));
    if (!nome.trim() || !valorNumerico) return;
    setSalvando(true);
    await criarNivel({
      empresa: profile.empresa,
      ordem: niveis.length,
      nome: nome.trim(),
      metaValor: valorNumerico,
      premio: premio.trim() || undefined,
    });
    setNome("");
    setMetaValor("");
    setPremio("");
    setMostrarForm(false);
    setSalvando(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover este nível?")) return;
    setNiveis((prev) => prev.filter((n) => n.id !== id));
    await apagarNivel(id);
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Medal size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Níveis de Performance</p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-aura-mist px-3 py-1.5 text-xs font-medium text-aura-graphite hover:bg-aura-bg"
        >
          <Plus size={13} />
          Novo nível
        </button>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Defina os valores de faturamento acumulado (desde sempre) que cada nível exige, e o
        prêmio de cada um. Fica visível pro vendedor em Meu Dia.
      </p>

      {mostrarForm && (
        <form onSubmit={salvar} className="mt-4 flex flex-col gap-3 rounded-xl border border-aura-mist bg-aura-bg p-4">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do nível (ex.: Bronze, Prata, Ouro)"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <input
            type="text"
            inputMode="numeric"
            value={metaValor}
            onChange={(e) => setMetaValor(e.target.value)}
            placeholder="Faturamento acumulado necessário (R$)"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <input
            type="text"
            value={premio}
            onChange={(e) => setPremio(e.target.value)}
            placeholder="Prêmio (ex.: R$ 5.000, Viagem, opcional)"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <button
            type="submit"
            disabled={salvando || !nome.trim() || !metaValor.trim()}
            className="rounded-xl bg-aura-petrol-700 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Adicionar nível"}
          </button>
        </form>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
        {niveis.length === 0 ? (
          <p className="py-4 text-center text-xs text-aura-graphite-soft">Nenhum nível cadastrado ainda.</p>
        ) : (
          niveis.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-aura-graphite">{n.nome}</p>
                <p className="text-xs text-aura-graphite-soft">
                  {formatarMoeda(n.metaValor)}
                  {n.premio ? ` · Prêmio: ${n.premio}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => excluir(n.id)}
                aria-label="Excluir nível"
                className="shrink-0 text-aura-graphite-soft hover:text-aura-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
