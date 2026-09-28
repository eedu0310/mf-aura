"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";

interface LeadIndicador {
  indicador: string;
  semana1: number;
  semana2: number;
  semana3: number;
  semana4: number;
  semana5: number;
  tipo: "Total";
}

/**
 * As linhas que toda loja preenche. O gestor acrescenta as dele em
 * `planilha_linhas`, e elas entram depois destas, na ordem que ele definiu.
 */
const LINHAS_PADRAO = [
  "Leads novos Recebidos Loja",
  "Leads novos Recebidos MF",
  "Leads novos Rec. Marketing",
  "Faturamento Leads Recebidos Loja",
  "Vendas Totais Leads Recebidos Loja",
  "Faturamento de Leads Recebidos MF",
  "Vendas Totais Leads Recebidos MF",
  "Faturamento Leads Rec. Marketing",
  "Vendas Totais Leads Rec. Marketing",
];

function linhaVazia(indicador: string): LeadIndicador {
  return {
    indicador,
    semana1: 0,
    semana2: 0,
    semana3: 0,
    semana4: 0,
    semana5: 0,
    tipo: "Total",
  };
}

export function MinhaPlanilhaIndicadores() {
  const { profile } = useUserProfile();
  const [indicadores, setIndicadores] = useState<LeadIndicador[]>(
    LINHAS_PADRAO.map(linhaVazia),
  );

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const supabase = getSupabaseBrowserClient();

  // Data atual
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Carregar dados do mês atual
  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    if (!supabase) return;

    setCarregando(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const [{ data, error }, { data: extras }] = await Promise.all([
        supabase
          .from("planilha_leads_indicadores")
          .select("*")
          .eq("usuario_id", user.user.id)
          .eq("mes", mesAtual)
          .eq("ano", anoAtual),
        supabase
          .from("planilha_linhas")
          .select("titulo, ordem")
          .eq("ativo", true)
          .order("ordem", { ascending: true }),
      ]);

      if (error) throw error;

      // As linhas do gestor entram depois das padrao. Se ele repetiu um nome
      // que ja existe, a linha padrao manda — senao a planilha ficaria com a
      // mesma pergunta duas vezes e o upsert brigaria pela mesma chave.
      const titulosExtras = ((extras ?? []) as { titulo: string }[])
        .map((l) => l.titulo)
        .filter((t) => !LINHAS_PADRAO.includes(t));
      const base = [...LINHAS_PADRAO, ...titulosExtras].map(linhaVazia);

      if (data && data.length > 0) {
        // Mesclar dados existentes
        const dadosExistentes = data.reduce(
          (acc: Record<string, any>, item: any) => {
            acc[item.indicador] = item;
            return acc;
          },
          {}
        );

        const novoIndicadores = base.map((ind) => {
          const existente = dadosExistentes[ind.indicador];
          return existente
            ? {
                ...ind,
                semana1: existente.semana1,
                semana2: existente.semana2,
                semana3: existente.semana3,
                semana4: existente.semana4,
                semana5: existente.semana5 ?? existente.restante ?? 0,
              }
            : ind;
        });

        setIndicadores(novoIndicadores);
      } else {
        setIndicadores(base);
      }
    } catch (erro) {
      console.error("Erro ao carregar dados:", erro);
    } finally {
      setCarregando(false);
    }
  }

  // Salvar dados
  async function salvarIndicadores() {
    if (!supabase) return;

    setSalvando(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Salvar cada indicador
      for (const ind of indicadores) {
        await supabase.from("planilha_leads_indicadores").upsert({
          usuario_id: user.user.id,
          usuario_nome: profile.nome,
          indicador: ind.indicador,
          semana1: ind.semana1,
          semana2: ind.semana2,
          semana3: ind.semana3,
          semana4: ind.semana4,
          semana5: ind.semana5,
          total: ind.semana1 + ind.semana2 + ind.semana3 + ind.semana4 + ind.semana5,
          tipo: "Total",
          mes: mesAtual,
          ano: anoAtual,
          data_atualizacao: new Date().toISOString(),
        });
      }

      alert("Planilha salva. O Marketing vê esses números no painel dele.");
    } catch (erro) {
      console.error("Erro ao salvar:", erro);
      alert("Não consegui salvar a planilha. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  // Atualizar valor
  function atualizarValor(
    index: number,
    semana: "semana1" | "semana2" | "semana3" | "semana4" | "semana5",
    valor: number
  ) {
    const novoIndicadores = [...indicadores];
    novoIndicadores[index][semana] = Math.max(0, valor);
    setIndicadores(novoIndicadores);
  }

  if (carregando) {
    return <div className="text-center py-4">Carregando dados...</div>;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-aura-mist bg-white p-6">
      {/* Titulo */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-aura-graphite">
            📊 Planilha de Indicadores — {hoje.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <p className="text-xs text-aura-graphite-soft">
            Preencha semana a semana. O Marketing acompanha esses números no painel dele.
          </p>
        </div>
        <button
          onClick={salvarIndicadores}
          disabled={salvando}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
        >
          {salvando ? "💾 Salvando..." : "💾 Salvar e Notificar Marketing"}
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          {/* Header */}
          <thead className="bg-aura-bg border-b border-aura-mist sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-aura-graphite min-w-[200px]">
                Indicador
              </th>
              <th className="px-2 py-2 text-center font-semibold text-aura-graphite min-w-[60px]">
                Semana 1
              </th>
              <th className="px-2 py-2 text-center font-semibold text-aura-graphite min-w-[60px]">
                Semana 2
              </th>
              <th className="px-2 py-2 text-center font-semibold text-aura-graphite min-w-[60px]">
                Semana 3
              </th>
              <th className="px-2 py-2 text-center font-semibold text-aura-graphite min-w-[60px]">
                Semana 4
              </th>
              <th className="px-2 py-2 text-center font-semibold text-aura-graphite min-w-[60px]">
                Semana 5 / Restante
              </th>
              <th className="px-3 py-2 text-center font-semibold text-aura-graphite min-w-[40px]">
                Total
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {indicadores.map((ind, idx) => (
              <tr
                key={idx}
                className={`border-b border-aura-mist hover:bg-aura-bg/50 transition ${
                  idx === indicadores.length - 1 ? "border-b-0" : ""
                }`}
              >
                {/* Indicador */}
                <td className="px-3 py-2 font-medium text-aura-graphite">
                  {ind.indicador}
                </td>

                {/* Semana 1 */}
                <td className="px-2 py-2 text-center">
                  <input
                    type="number"
                    value={ind.semana1}
                    onChange={(e) =>
                      atualizarValor(idx, "semana1", Number(e.target.value) || 0)
                    }
                    className="w-14 h-8 rounded border border-aura-mist px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  />
                </td>

                {/* Semana 2 */}
                <td className="px-2 py-2 text-center">
                  <input
                    type="number"
                    value={ind.semana2}
                    onChange={(e) =>
                      atualizarValor(idx, "semana2", Number(e.target.value) || 0)
                    }
                    className="w-14 h-8 rounded border border-aura-mist px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  />
                </td>

                {/* Semana 3 */}
                <td className="px-2 py-2 text-center">
                  <input
                    type="number"
                    value={ind.semana3}
                    onChange={(e) =>
                      atualizarValor(idx, "semana3", Number(e.target.value) || 0)
                    }
                    className="w-14 h-8 rounded border border-aura-mist px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  />
                </td>

                {/* Semana 4 */}
                <td className="px-2 py-2 text-center">
                  <input
                    type="number"
                    value={ind.semana4}
                    onChange={(e) =>
                      atualizarValor(idx, "semana4", Number(e.target.value) || 0)
                    }
                    className="w-14 h-8 rounded border border-aura-mist px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  />
                </td>

                {/* Restante */}
                <td className="px-2 py-2 text-center text-aura-graphite-soft">
                  <input
                    type="number"
                    value={ind.semana5}
                    onChange={(e) => atualizarValor(idx, "semana5", Number(e.target.value) || 0)}
                    className="w-16 h-8 rounded border border-aura-mist px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  />
                </td>

                {/* Tipo */}
                <td className="px-3 py-2 text-center text-xs font-medium text-aura-graphite-soft">
                  {ind.semana1 + ind.semana2 + ind.semana3 + ind.semana4 + ind.semana5}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
