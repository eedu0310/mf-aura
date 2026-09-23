"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { listarRelatorios, type RelatorioPeriodico, type TipoRelatorio } from "@/lib/supabase/relatorios";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const LABEL_TIPO: Record<TipoRelatorio, string> = {
  semanal_vendedor: "Seu relatório semanal",
  semanal_gestor: "Relatório semanal por loja",
  mensal_diretor: "Relatório mensal por loja",
};

function formatarPeriodo(inicio: string, fim: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
  return `${new Date(inicio + "T00:00:00").toLocaleDateString("pt-BR", opts)} – ${new Date(fim + "T00:00:00").toLocaleDateString("pt-BR", opts)}`;
}

export default function RelatoriosPage() {
  const { profile } = useUserProfile();
  const vejoTudo = profile.cargo === "Gestor";
  const [relatorios, setRelatorios] = useState<RelatorioPeriodico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState<TipoRelatorio | null>(null);

  async function carregar() {
    const lista = await listarRelatorios();
    setRelatorios(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-relatorios-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "relatorios_periodicos" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function gerar(tipo: TipoRelatorio) {
    setGerando(tipo);
    try {
      const resp = await fetch("/api/relatorios/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        alert(dados.erro ?? "Não consegui gerar o relatório.");
      } else {
        await carregar();
        if (dados.geradas) {
          const msg =
            dados.semDados && dados.semDados.length > 0
              ? `Relatório gerado para: ${dados.geradas.join(", ")}.\nSem dados suficientes: ${dados.semDados.join(", ")}.`
              : `Relatório gerado para todas as lojas: ${dados.geradas.join(", ")}.`;
          alert(msg);
        }
      }
    } catch {
      alert("Não consegui gerar o relatório. Tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  const opcoesGeracao: TipoRelatorio[] = vejoTudo
    ? ["semanal_gestor", "mensal_diretor"]
    : ["semanal_vendedor"];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Relatórios</p>
        <p className="text-sm text-aura-graphite-soft">
          Gerados automaticamente todo domingo (semanal) e todo dia 1 (mensal) — ou gere na hora.
          {vejoTudo && " Sempre um relatório separado para cada uma das 4 lojas."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {opcoesGeracao.map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => gerar(tipo)}
            disabled={gerando !== null}
            className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
          >
            {gerando === tipo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {gerando === tipo ? "Gerando..." : `Gerar ${LABEL_TIPO[tipo].toLowerCase()} agora`}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : relatorios.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-16 text-center">
          <FileText size={24} className="text-aura-graphite-soft" />
          <p className="text-sm text-aura-graphite-soft">
            Nenhum relatório ainda. Gere um agora ou espere o próximo domingo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {relatorios.map((r) => (
            <div key={r.id} className="rounded-2xl border border-aura-mist bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-aura-graphite">{LABEL_TIPO[r.tipo]}</p>
                <span className="shrink-0 text-xs text-aura-graphite-soft">
                  {formatarPeriodo(r.periodoInicio, r.periodoFim)}
                </span>
              </div>
              {vejoTudo && <p className="text-xs text-aura-graphite-soft">{r.empresa}</p>}
              <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-aura-graphite">
                {r.conteudo}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
