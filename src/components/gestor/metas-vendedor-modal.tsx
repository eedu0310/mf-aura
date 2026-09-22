"use client";

import { useEffect, useState } from "react";
import { X, Target, Check } from "lucide-react";
import { buscarMetaDeVendedor, definirMetaDeVendedor } from "@/lib/supabase/metas";
import {
  listarMetasAtividade,
  definirMetaAtividade,
  type CategoriaMeta,
  type PeriodoMeta,
} from "@/lib/supabase/metas-atividade";
import {
  METRICAS,
  listarMetasIndicadoresDoMes,
  definirMetaIndicador,
} from "@/lib/supabase/indicadores-semanais";
import type { MembroEquipe } from "@/lib/supabase/team";

const CATEGORIAS: CategoriaMeta[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Obra",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
];

export function MetasVendedorModal({
  membro,
  onClose,
}: {
  membro: MembroEquipe;
  onClose: () => void;
}) {
  const [metaFinanceira, setMetaFinanceira] = useState("");
  const [metasSemanal, setMetasSemanal] = useState<Record<string, string>>({});
  const [metasMensal, setMetasMensal] = useState<Record<string, string>>({});
  const [metasIndicadores, setMetasIndicadores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const mesAtual = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    async function carregar() {
      const [valorAtual, todasMetas, metasInd] = await Promise.all([
        buscarMetaDeVendedor(membro.id),
        listarMetasAtividade(),
        listarMetasIndicadoresDoMes(mesAtual, membro.id),
      ]);
      const metasDoMembro = todasMetas.filter((m) => m.vendedorId === membro.id);

      const semanal: Record<string, string> = {};
      const mensal: Record<string, string> = {};
      for (const m of metasDoMembro) {
        if (m.periodo === "semanal") semanal[m.categoria] = String(m.quantidade);
        else mensal[m.categoria] = String(m.quantidade);
      }
      setMetasSemanal(semanal);
      setMetasMensal(mensal);
      if (valorAtual) setMetaFinanceira(String(valorAtual));

      const indicadores: Record<string, string> = {};
      for (const m of METRICAS) {
        const valor = metasInd.get(`${membro.id}:${m.chave}`);
        if (valor) indicadores[m.chave] = String(valor);
      }
      setMetasIndicadores(indicadores);

      setCarregando(false);
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membro]);

  async function salvar() {
    setSalvando(true);

    const promessas: Promise<unknown>[] = [];

    if (metaFinanceira.trim() && Number(metaFinanceira) > 0) {
      promessas.push(definirMetaDeVendedor(membro.id, Number(metaFinanceira)));
    }

    for (const cat of CATEGORIAS) {
      const semanal = metasSemanal[cat];
      if (semanal !== undefined && semanal.trim() !== "") {
        promessas.push(
          definirMetaAtividade(membro.id, membro.empresa, cat, "semanal", Number(semanal))
        );
      }
      const mensal = metasMensal[cat];
      if (mensal !== undefined && mensal.trim() !== "") {
        promessas.push(
          definirMetaAtividade(membro.id, membro.empresa, cat, "mensal", Number(mensal))
        );
      }
    }

    for (const m of METRICAS) {
      const valor = metasIndicadores[m.chave];
      if (valor !== undefined && valor.trim() !== "") {
        promessas.push(
          definirMetaIndicador(membro.id, membro.empresa, mesAtual, m.chave, Number(valor))
        );
      }
    }

    await Promise.all(promessas);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-aura-graphite">
            <Target size={18} className="text-aura-petrol-600" />
            Metas de {membro.nome}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-aura-graphite-soft hover:text-aura-graphite"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-xs text-aura-graphite-soft">{membro.empresa}</p>

        {carregando ? (
          <p className="py-8 text-center text-sm text-aura-graphite-soft">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Meta financeira do mês (R$)
              </label>
              <input
                type="number"
                min={0}
                value={metaFinanceira}
                onChange={(e) => setMetaFinanceira(e.target.value)}
                placeholder="Ex.: 50000"
                className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-aura-graphite">
                Metas de visita por categoria
              </p>
              <div className="overflow-x-auto rounded-xl border border-aura-mist">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-aura-mist bg-aura-bg text-left text-xs text-aura-graphite-soft">
                      <th className="px-3 py-2 font-medium">Categoria</th>
                      <th className="px-3 py-2 font-medium">Por semana</th>
                      <th className="px-3 py-2 font-medium">Por mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIAS.map((cat) => (
                      <tr key={cat} className="border-b border-aura-mist last:border-0">
                        <td className="px-3 py-2 text-aura-graphite">{cat}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasSemanal[cat] ?? ""}
                            onChange={(e) =>
                              setMetasSemanal((prev) => ({ ...prev, [cat]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-20 rounded-lg border border-aura-mist bg-white px-2 py-1.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasMensal[cat] ?? ""}
                            onChange={(e) =>
                              setMetasMensal((prev) => ({ ...prev, [cat]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-20 rounded-lg border border-aura-mist bg-white px-2 py-1.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-aura-graphite">
                Metas da Planilha de Indicadores ({mesAtual})
              </p>
              <div className="overflow-x-auto rounded-xl border border-aura-mist">
                <table className="w-full min-w-[380px] text-sm">
                  <thead>
                    <tr className="border-b border-aura-mist bg-aura-bg text-left text-xs text-aura-graphite-soft">
                      <th className="px-3 py-2 font-medium">Métrica</th>
                      <th className="px-3 py-2 font-medium">Meta mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICAS.map((m) => (
                      <tr key={m.chave} className="border-b border-aura-mist last:border-0">
                        <td className="px-3 py-2 text-xs text-aura-graphite">{m.label}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasIndicadores[m.chave] ?? ""}
                            onChange={(e) =>
                              setMetasIndicadores((prev) => ({ ...prev, [m.chave]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-24 rounded-lg border border-aura-mist bg-white px-2 py-1.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white hover:bg-aura-petrol-600 disabled:opacity-60"
            >
              <Check size={15} />
              {salvando ? "Salvando..." : salvo ? "Salvo!" : "Salvar metas"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
