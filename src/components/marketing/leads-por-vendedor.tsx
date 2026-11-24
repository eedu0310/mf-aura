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
    <div className="aura-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone size={15} className="text-aura-petrol-600" />
        <p className="text-sm font-semibold text-aura-graphite">Leads de anúncio por vendedor</p>
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-aura-danger/30 bg-aura-danger/10 p-3 text-xs text-aura-danger">
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
        <div className="-mx-5 overflow-x-auto border-t border-aura-mist">
          <table className="aura-tabela">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Fechou</th>
                <th className="text-right">Conversão</th>
                <th className="text-right">Gerou</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const conversao = l.leads > 0 ? Math.round((l.fechadas / l.leads) * 100) : 0;
                return (
                  <tr key={l.vendedor}>
                    <td>
                      <p className="font-medium text-aura-graphite">{l.vendedor}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        {l.empresa} · {l.campanhas} {l.campanhas === 1 ? "campanha" : "campanhas"}
                      </p>
                    </td>
                    <td className="text-right tabular-nums">{l.leads}</td>
                    <td className="text-right tabular-nums">{l.fechadas}</td>
                    <td className="text-right tabular-nums">{conversao}%</td>
                    <td className="text-right font-semibold tabular-nums">{moeda(l.valor)}</td>
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
