"use client";

/**
 * A cobrança da supervisora no Meu Dia: o que está zerado no mês e uma caixa
 * para o vendedor responder por quê. Some depois de respondida; o gestor lê
 * a resposta no painel dele.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Alerta, classeBotao } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Item {
  chave: string;
  texto: string;
  pergunta: string;
}

interface Cobranca {
  id: string;
  dia: string;
  itens: Item[];
  contexto: string | null;
}

export function CobrancaSupervisora() {
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      // A mais recente ainda sem resposta, de até três dias atrás.
      const desde = new Date(Date.now() - 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data, error } = await sb
        .from("aura_cobrancas")
        .select("id, dia, itens, contexto")
        .eq("vendedor_id", user.id)
        .is("respondida_em", null)
        .gte("dia", desde)
        .order("dia", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!vivo || error || !data) return;
      setCobranca({
        id: String(data.id),
        dia: String(data.dia),
        itens: Array.isArray(data.itens) ? (data.itens as Item[]) : [],
        contexto: (data.contexto as string) ?? null,
      });
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (enviada) {
    return (
      <Alerta
        tom="sucesso"
        titulo="Resposta enviada. O gestor vai ler. Agora é registrar no CRM o que você está fazendo."
      />
    );
  }
  if (!cobranca || !cobranca.itens.length) return null;

  const completo = cobranca.itens.every((i) => (respostas[i.chave] ?? "").trim().length >= 5);

  async function enviar() {
    if (!cobranca) return;
    setEnviando(true);
    setErro(null);
    const sb = getSupabaseBrowserClient();
    const resposta = Object.fromEntries(cobranca.itens.map((i) => [i.chave, (respostas[i.chave] ?? "").trim()]));
    const { data, error } = await sb!.rpc("aura_responder_cobranca", { p_id: cobranca.id, p_resposta: resposta });
    setEnviando(false);
    if (error || data !== true) {
      setErro("Não consegui enviar a resposta. Tente de novo.");
      return;
    }
    setEnviada(true);
  }

  return (
    <section className="aura-card border-l-2 border-l-aura-warning p-5" aria-labelledby="cobranca-titulo">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-warning/12 text-aura-warning" aria-hidden>
          <AlertTriangle size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="aura-rotulo text-aura-gold-700">Supervisora AURA</p>
          <h2 id="cobranca-titulo" className="mt-0.5 font-display text-base font-semibold text-aura-graphite">
            O seu mês ainda não aparece no CRM
          </h2>
          {cobranca.contexto && <p className="mt-1 text-sm text-aura-graphite-soft">{cobranca.contexto}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {cobranca.itens.map((i) => (
          <label key={i.chave} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-aura-graphite">{i.texto}</span>
            <span className="text-xs text-aura-graphite-soft">{i.pergunta}</span>
            <textarea
              rows={2}
              value={respostas[i.chave] ?? ""}
              onChange={(e) => setRespostas((r) => ({ ...r, [i.chave]: e.target.value }))}
              placeholder="Escreva o motivo"
              className="aura-input"
            />
          </label>
        ))}
      </div>

      {erro && <p className="mt-3 text-sm text-aura-danger">{erro}</p>}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={enviar}
          disabled={!completo || enviando}
          className={classeBotao("primario")}
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Enviar para o gestor
        </button>
      </div>
    </section>
  );
}
