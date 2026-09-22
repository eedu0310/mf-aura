"use client";

import { useEffect, useState } from "react";
import { Target, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { buscarCompromissoDoMes, type CompromissoMensal } from "@/lib/supabase/compromisso-mensal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CompromissoMensalModal } from "./compromisso-mensal-modal";

function verificar30Dias(dataEnvio: string | null | undefined): boolean {
  if (!dataEnvio) return true;

  const data = new Date(dataEnvio);
  const agora = new Date();
  const diasPassados = Math.floor((agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));

  return diasPassados >= 30;
}

export function CompromissoMensalBanner() {
  const { profile } = useUserProfile();
  const [compromisso, setCompromisso] = useState<CompromissoMensal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar() {
    const c = await buscarCompromissoDoMes();
    setCompromisso(c);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-compromisso-mensal-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos_mensais" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // Marcar notificação como visualizada
  useEffect(() => {
    if (compromisso?.status === "aprovado" && !compromisso.notificacao_visualizada) {
      const marcarComoVisualizado = async () => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase || !compromisso.id) return;

        try {
          await supabase
            .from("compromissos_mensais")
            .update({ notificacao_visualizada: true })
            .eq("id", compromisso.id);

          await carregar();
        } catch (erro) {
          console.error("Erro ao marcar como visualizado:", erro);
        }
      };

      marcarComoVisualizado();
    }
  }, [compromisso?.status, compromisso?.notificacao_visualizada, compromisso?.id]);

  // ✅ Se for Gestor ou Diretor, não mostra
  if (profile.cargo === "Gestor" || profile.cargo === "Diretor") {
    return null;
  }

  if (carregando) return null;

  const hoje = new Date().getDate();
  if (!compromisso && hoje < 5) return null;

  // ✅ Se compromisso foi aprovado e não passaram 30 dias, não mostra
  if (compromisso?.status === "aprovado" && !verificar30Dias(compromisso.dataEnvio)) {
    return null;
  }

  if (!compromisso || compromisso.status === "rascunho") {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-aura-warning/30 bg-aura-warning/5 px-4 py-3 text-left hover:bg-aura-warning/10"
        >
          <Target size={16} className="shrink-0 text-aura-warning" />
          <p className="text-sm text-aura-graphite">
            Você ainda não enviou seu <span className="font-medium">Compromisso do Mês</span> pro
            gestor aprovar.
          </p>
        </button>
        {modalAberto && <CompromissoMensalModal onClose={() => setModalAberto(false)} />}
      </>
    );
  }

  if (compromisso.status === "ajuste_solicitado") {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-aura-danger/30 bg-aura-danger/5 px-4 py-3 text-left hover:bg-aura-danger/10"
        >
          <AlertTriangle size={16} className="shrink-0 text-aura-danger" />
          <div>
            <p className="text-sm font-medium text-aura-graphite">
              Seu gestor pediu um ajuste no seu Compromisso do Mês
            </p>
            {compromisso.feedbackGestor && (
              <p className="text-xs text-aura-graphite-soft">{compromisso.feedbackGestor}</p>
            )}
          </div>
        </button>
        {modalAberto && <CompromissoMensalModal onClose={() => setModalAberto(false)} />}
      </>
    );
  }

  if (compromisso.status === "pendente_aprovacao") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-aura-mist bg-white px-4 py-3">
        <Clock size={16} className="shrink-0 text-aura-graphite-soft" />
        <p className="text-sm text-aura-graphite-soft">
          Seu Compromisso do Mês está aguardando aprovação do gestor.
        </p>
      </div>
    );
  }

  if (compromisso.status === "aprovado" && !compromisso.notificacao_visualizada) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-aura-success/30 bg-aura-success/5 px-4 py-3">
        <CheckCircle2 size={16} className="shrink-0 text-aura-success" />
        <p className="text-sm text-aura-graphite">
          Seu Compromisso do Mês foi aprovado — bom trabalho! 🎯
        </p>
      </div>
    );
  }

  return null;
}
