"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, AlertTriangle, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Quem está vivendo de lead de campanha, e o que fez com eles.
 *
 * É a pergunta que o gestor faz de verdade: os vendedores internos atendem
 * quase só lead de anúncio, os externos quase não recebem. Sem esta quebra, o
 * total da campanha não diz se o problema é o anúncio ou o atendimento.
 */
interface LinhaDoVendedor {
  vendedor_id: string;
  vendedor: string;
  empresa: string;
  campanha: string;
  canal: string;
  leads: number;
  negocios: number;
  vendas_fechadas: number;
  valor_gerado: number;
}

interface Agregado {
  vendedor: string;
  empresa: string;
  leads: number;
  fechadas: number;
  valor: number;
  campanhas: number;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function LeadsPorVendedor() {
  const [linhas, setLinhas] = useState<Agregado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErro("Sem conexão com o banco.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase.from("campanhas_por_vendedor").select("*");
    if (error) {
      // Lista vazia silenciosa já fez gestor acreditar que ninguém tinha lead.
      setErro(`Não consegui carregar: ${error.message}`);
      setLinhas([]);
      setCarregando(false);
      return;
    }
    const porPessoa = new Map<string, Agregado>();
    for (const l of (data ?? []) as LinhaDoVendedor[]) {
      const atual = porPessoa.get(l.vendedor_id) ?? {
        vendedor: l.vendedor,
        empresa: l.empresa,
        leads: 0,
        fechadas: 0,
        valor: 0,
        campanhas: 0,
      };
      atual.leads += Number(l.leads ?? 0);
      atual.fechadas += Number(l.vendas_fechadas ?? 0);
      atual.valor += Number(l.valor_gerado ?? 0);
      atual.campanhas += 1;
      porPessoa.set(l.vendedor_id, atual);
    }
    setLinhas([...porPessoa.values()].sort((a, b) => b.leads - a.leads));
    setErro(null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone size={16} className="text-aura-petrol-600" />
        <p className="font-medium text-aura-graphite">Leads de anúncio por vendedor</p>
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-aura-graphite-soft">
          Nenhum lead de anúncio atribuído ainda. Quem clica em &ldquo;Enviar mensagem&rdquo; nos
          seus anúncios do Facebook e do Instagram passa a aparecer aqui sozinho.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-aura-graphite-soft">
                <th className="pb-2 font-medium">Vendedor</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Fechou</th>
                <th className="pb-2 text-right font-medium">Conversão</th>
                <th className="pb-2 text-right font-medium">Gerou</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const conversao = l.leads > 0 ? Math.round((l.fechadas / l.leads) * 100) : 0;
                return (
                  <tr key={l.vendedor} className="border-t border-aura-mist">
                    <td className="py-2">
                      <p className="font-medium text-aura-graphite">{l.vendedor}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        {l.empresa} · {l.campanhas} {l.campanhas === 1 ? "campanha" : "campanhas"}
                      </p>
                    </td>
                    <td className="py-2 text-right font-data">{l.leads}</td>
                    <td className="py-2 text-right font-data">{l.fechadas}</td>
                    <td className="py-2 text-right font-data">{conversao}%</td>
                    <td className="py-2 text-right font-data font-semibold">{moeda(l.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
