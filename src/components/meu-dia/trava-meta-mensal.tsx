"use client";

/**
 * Trava da meta do mês.
 *
 * Regra pedida pelo Elton em 19/11/2026: no primeiro dia do mês o vendedor
 * preenche e envia a meta pessoal do mês antes de usar o CRM. Enquanto a meta
 * do mês não foi ENVIADA (não existe, ou ainda é rascunho), a tela inteira
 * fica coberta pelo formulário, sem botão de fechar. Enviada, libera na hora,
 * mesmo antes de o gestor aprovar: a espera pela aprovação é do gestor, não
 * do vendedor.
 *
 * Vale só para quem vende (Vendedor e Vendedor Interno) e a partir de
 * dezembro de 2026; novembro já ia pela metade quando a regra nasceu.
 *
 * Se a leitura do banco falhar, a tela NÃO trava: um erro de rede não pode
 * deixar a equipe inteira sem CRM.
 */
import { useCallback, useEffect, useState } from "react";
import { LogOut, Target } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CARGOS_QUE_VENDEM } from "@/lib/types";
import { mesEmBrasilia, travaVale } from "@/lib/meta-mensal";
import { CompromissoMensalModal } from "./compromisso-mensal-modal";

export function TravaMetaMensal() {
  const [travado, setTravado] = useState(false);
  const [mes, setMes] = useState(() => mesEmBrasilia());

  const conferir = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const agoraMes = mesEmBrasilia();
    setMes(agoraMes);
    if (!travaVale(agoraMes)) {
      setTravado(false);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;

      const [perfil, meta] = await Promise.all([
        supabase.from("profiles").select("cargo, ativo").eq("id", user.id).maybeSingle(),
        supabase
          .from("compromissos_mensais")
          .select("status")
          .eq("vendedor_id", user.id)
          .eq("mes", agoraMes)
          .maybeSingle(),
      ]);
      if (perfil.error || meta.error) {
        console.error("Trava da meta: não consegui conferir", perfil.error ?? meta.error);
        setTravado(false);
        return;
      }
      const vende = CARGOS_QUE_VENDEM.includes(String(perfil.data?.cargo ?? "") as never);
      const enviada = Boolean(meta.data?.status && meta.data.status !== "rascunho");
      setTravado(vende && perfil.data?.ativo !== false && !enviada);
    } catch (e) {
      console.error("Trava da meta: erro ao conferir", e);
      setTravado(false);
    }
  }, []);

  useEffect(() => {
    void conferir();
    // Confere de novo quando a aba volta a ficar visível: quem deixa o CRM
    // aberto de um mês para o outro também cai na trava no dia 1.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    const relogio = window.setInterval(() => void conferir(), 30 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(relogio);
    };
  }, [conferir]);

  async function sair() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    window.location.href = "/login";
  }

  if (!travado) return null;

  const [ano, m] = mes.split("-").map(Number);
  const nomeMes = new Date(Date.UTC(ano, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-aura-navy-950/95" role="dialog" aria-modal="true" aria-labelledby="trava-meta-titulo">
      <div className="mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-2 pt-6 text-white sm:pt-10">
        <span className="mt-0.5 rounded-full bg-aura-gold/15 p-2 text-aura-gold" aria-hidden>
          <Target size={20} />
        </span>
        <div className="flex-1">
          <p id="trava-meta-titulo" className="font-display text-lg font-semibold">
            Antes de começar {nomeMes}: envie a sua meta do mês
          </p>
          <p className="mt-1 text-sm text-white/70">
            O CRM libera assim que você enviar. O gestor aprova depois, e você já pode trabalhar enquanto isso.
          </p>
        </div>
        <button
          type="button"
          onClick={sair}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
      <CompromissoMensalModal obrigatorio onClose={() => void conferir()} />
    </div>
  );
}
