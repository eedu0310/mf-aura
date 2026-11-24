"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { Alerta, CardHeader, classeBotao } from "@/components/ui";

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
    <div className="aura-card p-5">
      <CardHeader
        titulo="Base de Conhecimento da AURA Coach"
        icone={BookOpen}
        className="mb-0"
        descricao={
          <>
            Cole aqui seu manual de vendas, script de abordagem, objeções mais comuns, ou
            qualquer processo que a AURA Coach deve seguir. Ela vai usar isso em toda
            conversa, análise de reunião e preparação de pauta.
          </>
        }
      />

      {!usandoSupabase && (
        <Alerta
          tom="atencao"
          icone={AlertCircle}
          className="mt-3"
          titulo="Sem conexão com o servidor — o texto fica salvo só nesta sessão (some ao atualizar a página)."
        />
      )}

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={10}
        placeholder="Ex.: Nosso processo de vendas segue 5 etapas: 1) Levantamento de necessidades... 2) Apresentação técnica... Objeções comuns: 'está caro' → responda destacando a garantia de 10 anos e a economia de energia..."
        className="aura-input mt-3 resize-y"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className={classeBotao("primario")}
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {salvo && <span className="text-xs font-medium text-aura-success">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
