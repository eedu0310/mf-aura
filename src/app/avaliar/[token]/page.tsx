"use client";

import { useEffect, useState, use } from "react";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCarregando(false);
      setErro("Sistema não configurado.");
      return;
    }
    supabase
      .rpc("buscar_empresa_por_token", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data) {
          setErro("Link inválido ou expirado.");
        } else {
          setEmpresa(data as string);
        }
        setCarregando(false);
      });
  }, [token]);

  async function enviar() {
    if (nota === 0) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setEnviando(true);
    const { data, error } = await supabase.rpc("registrar_avaliacao_publica", {
      p_token: token,
      p_nota: nota,
      p_comentario: comentario.trim() || null,
    });
    setEnviando(false);

    if (error || !data) {
      setErro("Não consegui enviar sua avaliação. Tente novamente.");
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-aura-bg px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <AuraLogoFull />
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-6 shadow-sm">
          {carregando ? (
            <div className="flex justify-center py-8 text-aura-graphite-soft">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : erro && !empresa ? (
            <p className="text-center text-sm text-aura-graphite-soft">{erro}</p>
          ) : enviado ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 size={32} className="text-aura-success" />
              <p className="font-display text-lg font-semibold text-aura-graphite">
                Obrigado pela avaliação!
              </p>
              <p className="text-sm text-aura-graphite-soft">
                Seu feedback foi enviado para {empresa}.
              </p>
            </div>
          ) : (
            <>
              <p className="text-center font-display text-lg font-semibold text-aura-graphite">
                Como foi sua experiência com {empresa}?
              </p>
              <p className="mt-1 text-center text-sm text-aura-graphite-soft">
                Sua opinião nos ajuda a melhorar.
              </p>

              <div className="mt-5 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNota(n)}
                    aria-label={`${n} estrelas`}
                  >
                    <Star
                      size={32}
                      className={n <= nota ? "fill-aura-gold text-aura-gold" : "text-aura-mist"}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Quer contar mais alguma coisa? (opcional)"
                className="mt-4 w-full resize-none rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />

              {erro && <p className="mt-2 text-center text-xs text-aura-danger">{erro}</p>}

              <button
                type="button"
                onClick={enviar}
                disabled={nota === 0 || enviando}
                className="mt-4 w-full rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviando ? "Enviando..." : "Enviar avaliação"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
