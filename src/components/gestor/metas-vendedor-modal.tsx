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
import { classeBotao } from "@/components/ui";

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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-aura-graphite">
            <Target size={18} className="text-aura-petrol-600" />
            Metas de {membro.nome}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
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
              <label className="aura-label">
                Meta financeira do mês (R$)
              </label>
              <input
                type="number"
                min={0}
                value={metaFinanceira}
                onChange={(e) => setMetaFinanceira(e.target.value)}
                placeholder="Ex.: 50000"
                className="aura-input"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-aura-graphite">
                Metas de visita por categoria
              </p>
              <div className="overflow-x-auto rounded-lg border border-aura-mist">
                <table className="aura-tabela min-w-[420px]">
                  <thead>
                    <tr className="text-left">
                      <th>Categoria</th>
                      <th>Por semana</th>
                      <th>Por mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIAS.map((cat) => (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasSemanal[cat] ?? ""}
                            onChange={(e) =>
                              setMetasSemanal((prev) => ({ ...prev, [cat]: e.target.value }))
                            }
                            placeholder="0"
                            className="aura-input h-8 w-20 px-2"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasMensal[cat] ?? ""}
                            onChange={(e) =>
                              setMetasMensal((prev) => ({ ...prev, [cat]: e.target.value }))
                            }
                            placeholder="0"
                            className="aura-input h-8 w-20 px-2"
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
              <div className="overflow-x-auto rounded-lg border border-aura-mist">
                <table className="aura-tabela min-w-[380px]">
                  <thead>
                    <tr className="text-left">
                      <th>Métrica</th>
                      <th>Meta mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICAS.map((m) => (
                      <tr key={m.chave}>
                        <td className="text-xs">{m.label}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={metasIndicadores[m.chave] ?? ""}
                            onChange={(e) =>
                              setMetasIndicadores((prev) => ({ ...prev, [m.chave]: e.target.value }))
                            }
                            placeholder="0"
                            className="aura-input h-8 w-24 px-2"
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
              className={classeBotao("primario", "lg", "w-full")}
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
