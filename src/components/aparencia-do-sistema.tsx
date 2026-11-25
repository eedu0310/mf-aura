"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EVENTO_APARENCIA,
  aplicarAparencia,
  normalizarAparencia,
  paletaDoDia,
  type IdFundo,
  type IdPaleta,
} from "@/lib/aparencia";
import { ROTAS_SEMPRE_CLARAS } from "@/lib/tema-script";

/**
 * Aplica a aparência que o gestor escolheu (paleta e fundo do pipeline).
 *
 * O script do <head> já pôs a última aparência guardada no navegador, para a
 * tela não abrir na cor antiga. Aqui busca a escolha atual no banco (e a data
 * comemorativa do dia), aplica e guarda. A tela de Aparência do gestor manda
 * o evento EVENTO_APARENCIA para pré-visualizar sem salvar.
 *
 * As páginas que o cliente abre (formulário, landing, avaliação) ficam com o
 * visual original da marca, como já acontece com o tema escuro.
 */
export function AparenciaDoSistema() {
  const caminho = usePathname();
  const publica = ROTAS_SEMPRE_CLARAS.test(caminho ?? "");

  useEffect(() => {
    if (publica) {
      delete document.documentElement.dataset.paleta;
      delete document.documentElement.dataset.fundoPipeline;
      return;
    }
    let vivo = true;
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const { data, error } = await sb
        .from("aparencia_config")
        .select("paleta, fundo_pipeline, agenda")
        .eq("id", true)
        .maybeSingle();
      // Sem login ou sem a tabela: fica com o que estava guardado.
      if (!vivo || error || !data) return;
      const config = normalizarAparencia(data);
      aplicarAparencia(paletaDoDia(config).paleta, config.fundoPipeline);
    })();
    return () => {
      vivo = false;
    };
  }, [publica]);

  useEffect(() => {
    function aoMudar(e: Event) {
      const d = (e as CustomEvent<{ paleta: IdPaleta; fundo: IdFundo; guardar?: boolean }>).detail;
      if (d) aplicarAparencia(d.paleta, d.fundo, d.guardar ?? false);
    }
    window.addEventListener(EVENTO_APARENCIA, aoMudar);
    return () => window.removeEventListener(EVENTO_APARENCIA, aoMudar);
  }, []);

  return null;
}
