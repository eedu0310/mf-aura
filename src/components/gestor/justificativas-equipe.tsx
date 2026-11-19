"use client";

/**
 * As respostas da equipe às cobranças da supervisora, dos últimos 7 dias.
 * A RLS já entrega só o que o gestor pode ver (a loja dele; o mestre, todas).
 */
import { useEffect, useMemo, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Linha {
  id: string;
  vendedorId: string;
  empresa: string;
  dia: string;
  itens: { chave: string; texto: string }[];
  resposta: Record<string, string> | null;
  respondidaEm: string | null;
}

const dataBR = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export function JustificativasEquipe() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let vivo = true;
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const desde = new Date(Date.now() - 7 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data, error } = await sb
        .from("aura_cobrancas")
        .select("id, vendedor_id, empresa, dia, itens, resposta, respondida_em")
        .gte("dia", desde)
        .order("dia", { ascending: false })
        .limit(300);
      if (!vivo) return;
      if (error) {
        console.error("Justificativas: erro ao ler", error);
        setLinhas([]);
        return;
      }
      const lista: Linha[] = (data ?? []).map((l) => ({
        id: String(l.id),
        vendedorId: String(l.vendedor_id),
        empresa: String(l.empresa ?? ""),
        dia: String(l.dia),
        itens: Array.isArray(l.itens) ? (l.itens as Linha["itens"]) : [],
        resposta: (l.resposta as Record<string, string>) ?? null,
        respondidaEm: (l.respondida_em as string) ?? null,
      }));
      setLinhas(lista);
      const ids = [...new Set(lista.map((l) => l.vendedorId))];
      if (ids.length) {
        const { data: perfis } = await sb.from("profiles").select("id, nome").in("id", ids);
        if (vivo) setNomes(new Map((perfis ?? []).map((p) => [String(p.id), String(p.nome ?? "")])));
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Só a cobrança mais recente de cada vendedor fica em destaque.
  const recentes = useMemo(() => {
    if (!linhas) return [];
    const vistos = new Set<string>();
    return linhas.filter((l) => (vistos.has(l.vendedorId) ? false : (vistos.add(l.vendedorId), true)));
  }, [linhas]);

  if (!linhas || recentes.length === 0) return null;
  const semResposta = recentes.filter((l) => !l.respondidaEm).length;

  return (
    <section className="rounded-2xl border border-aura-mist bg-white p-5" aria-labelledby="justificativas-titulo">
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareWarning size={18} className="text-aura-warning" aria-hidden />
        <h2 id="justificativas-titulo" className="font-display text-lg font-semibold text-aura-graphite">
          Cobranças da supervisora
        </h2>
        <span className="text-xs text-aura-graphite-soft">
          últimos 7 dias · {recentes.length} {recentes.length === 1 ? "vendedor" : "vendedores"}
          {semResposta ? ` · ${semResposta} sem resposta` : ""}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {recentes.map((l) => (
          <article key={l.id} className={`rounded-xl border p-4 ${l.respondidaEm ? "border-aura-mist" : "border-aura-warning/40 bg-aura-warning/5"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-aura-graphite">{nomes.get(l.vendedorId) || "Vendedor"}</p>
              <p className="text-xs text-aura-graphite-soft">
                {l.empresa} · {dataBR(l.dia)}
              </p>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {l.itens.map((i) => (
                <li key={i.chave} className="text-xs">
                  <p className="font-medium text-aura-graphite">{i.texto}</p>
                  <p className={l.resposta?.[i.chave] ? "text-aura-graphite" : "italic text-aura-graphite-soft"}>
                    {l.resposta?.[i.chave] ? `“${l.resposta[i.chave]}”` : "Ainda não respondeu."}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
