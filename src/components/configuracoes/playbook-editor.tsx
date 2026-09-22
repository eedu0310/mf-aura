"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";

export function PlaybookEditor() {
  const { playbook, salvarPlaybook, usandoSupabase } = useAppData();
  const [texto, setTexto] = useState(playbook);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Mantém o textarea sincronizado se o playbook carregar depois (ex.: do Supabase)
  useEffect(() => {
    setTexto(playbook);
  }, [playbook]);

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    const ok = await salvarPlaybook(texto);
    setSalvando(false);
    if (ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Base de Conhecimento da AURA Coach</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Cole aqui seu manual de vendas, script de abordagem, objeções mais comuns, ou
        qualquer processo que a AURA Coach deve seguir. Ela vai usar isso em toda
        conversa, análise de reunião e preparação de pauta.
      </p>

      {!usandoSupabase && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-aura-warning/10 px-3 py-2 text-xs text-aura-warning">
          <AlertCircle size={12} />
          Supabase não configurado — isso fica salvo só nesta sessão (some ao atualizar a página).
        </p>
      )}

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={10}
        placeholder="Ex.: Nosso processo de vendas segue 5 etapas: 1) Levantamento de necessidades... 2) Apresentação técnica... Objeções comuns: 'está caro' → responda destacando a garantia de 10 anos e a economia de energia..."
        className="mt-3 w-full resize-y rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm leading-relaxed text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-xl bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {salvo && <span className="text-xs font-medium text-aura-success">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
