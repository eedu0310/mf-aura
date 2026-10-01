"use client";

/**
 * Leads, vendas e faturamento do mês separados por origem.
 *
 * Fica ao lado da planilha de indicadores, não dentro dela. A planilha é
 * digitada pela equipe; este quadro é calculado dos registros. Se o sistema
 * escrevesse na planilha, apagaria o que a pessoa digitou — dois escritores na
 * mesma linha sempre acabam em um sobrescrevendo o outro.
 */
import { useEffect, useState } from "react";
import { Loader2, PieChart } from "lucide-react";
import { SeloOrigem } from "@/components/origem/selo-origem";

interface Origem {
  origem: string;
  leads: number;
  vendas: number;
  faturamento: number;
  perdidas: number;
  conversao: number | null;
}

interface Resposta {
  mes: string;
  gestor: boolean;
  origens: Origem[];
  totais: { leads: number; vendas: number; faturamento: number; perdidas: number };
  campanhas: {
    campanha: string;
    investido: number;
    faturamento: number;
    leads: number;
    vendas: number;
    retorno: number | null;
  }[];
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function RetornoPorOrigemCard() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/meu-dia/por-origem");
        const d = await r.json();
        if (!r.ok) throw new Error(d?.erro ?? "Não foi possível carregar.");
        if (vivo) setDados(d);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-start gap-3">
        <PieChart size={20} className="mt-0.5 shrink-0 text-aura-petrol-600" />
        <div>
          <h3 className="font-display text-lg font-semibold text-aura-graphite">
            De onde vieram os negócios deste mês
          </h3>
          <p className="mt-1 text-sm text-aura-graphite-soft">
            Calculado dos registros, não digitado. A planilha de indicadores
            segue sendo sua.
          </p>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : !dados || dados.origens.length === 0 ? (
        <p className="mt-6 text-sm text-aura-graphite-soft">
          Nenhum lead com origem registrada neste mês. A origem é informada no
          cadastro do cliente — a partir dela o sistema separa tudo aqui
          sozinho.
        </p>
      ) : (
        <>
          <div className="mt-5 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-aura-mist text-left text-xs text-aura-graphite-soft">
                  <th className="px-2 py-2 font-medium">Origem</th>
                  <th className="px-2 py-2 text-right font-medium">Leads</th>
                  <th className="px-2 py-2 text-right font-medium">Vendas</th>
                  <th className="px-2 py-2 text-right font-medium">Perdas</th>
                  <th className="px-2 py-2 text-right font-medium">Conversão</th>
                  <th className="px-2 py-2 text-right font-medium">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {dados.origens.map((o) => (
                  <tr key={o.origem} className="border-b border-aura-mist/60 last:border-0">
                    <td className="px-2 py-2">
                      <SeloOrigem origem={o.origem} tamanho={12} />
                    </td>
                    <td className="px-2 py-2 text-right text-aura-graphite">{o.leads}</td>
                    <td className="px-2 py-2 text-right text-aura-success">{o.vendas}</td>
                    <td className="px-2 py-2 text-right text-aura-danger">{o.perdidas}</td>
                    <td className="px-2 py-2 text-right text-aura-graphite">
                      {o.conversao === null ? "—" : `${o.conversao}%`}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-aura-graphite">
                      {moeda(o.faturamento)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-aura-mist font-semibold">
                  <td className="px-2 py-2 text-aura-graphite">Total</td>
                  <td className="px-2 py-2 text-right text-aura-graphite">{dados.totais.leads}</td>
                  <td className="px-2 py-2 text-right text-aura-graphite">{dados.totais.vendas}</td>
                  <td className="px-2 py-2 text-right text-aura-graphite">{dados.totais.perdidas}</td>
                  <td className="px-2 py-2 text-right text-aura-graphite-soft">—</td>
                  <td className="px-2 py-2 text-right text-aura-graphite">
                    {moeda(dados.totais.faturamento)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Retorno das campanhas: só o gestor recebe isto da rota. */}
          {dados.campanhas.length > 0 && (
            <div className="mt-6 border-t border-aura-mist pt-4">
              <h4 className="text-sm font-semibold text-aura-graphite">
                Investido × retorno por campanha
              </h4>
              <ul className="mt-2 space-y-2">
                {dados.campanhas.map((c, i) => (
                  <li key={`${c.campanha}-${i}`} className="text-sm">
                    <span className="font-medium text-aura-graphite">{c.campanha}</span>
                    <span className="text-aura-graphite-soft">
                      {" "}
                      · investido {moeda(c.investido)} · voltou {moeda(c.faturamento)}
                      {c.retorno != null && ` · ${c.retorno}× o investido`} ·{" "}
                      {c.vendas} de {c.leads} leads
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-xs text-aura-graphite-soft">
            Conversão é sobre o que já foi decidido (vendas + perdas). O que
            está em negociação não conta como erro.
          </p>
        </>
      )}
    </div>
  );
}
