"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { listarRelatorios, type RelatorioPeriodico, type TipoRelatorio } from "@/lib/supabase/relatorios";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, EstadoVazio, PageContainer, PageHeader, Selo, classeBotao } from "@/components/ui";

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
    <PageContainer largura="estreita">
      <PageHeader
        titulo="Relatórios"
        icone={FileText}
        descricao={
          <>
            Gerados automaticamente todo domingo (semanal) e todo dia 1 (mensal) — ou gere na hora.
            {vejoTudo && " Sempre um relatório separado para cada uma das 4 lojas."}
          </>
        }
      />

      <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {opcoesGeracao.map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => gerar(tipo)}
            disabled={gerando !== null}
            className={classeBotao("primario")}
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
        <EstadoVazio
          icone={FileText}
          titulo="Nenhum relatório ainda. Gere um agora ou espere o próximo domingo."
          className="py-16"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {relatorios.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-aura-graphite">{LABEL_TIPO[r.tipo]}</p>
                <Selo className="shrink-0">{formatarPeriodo(r.periodoInicio, r.periodoFim)}</Selo>
              </div>
              {vejoTudo && <p className="mt-0.5 text-xs text-aura-graphite-soft">{r.empresa}</p>}
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-aura-graphite">
                {r.conteudo}
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
    </PageContainer>
  );
}
