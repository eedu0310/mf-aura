"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { desligarPush, estadoDoPush, ligarPush, mandarTeste, type EstadoPush } from "@/lib/push/cliente";

/**
 * Rodapé do sino: liga ou desliga os avisos neste aparelho (notificação push).
 * Cada aparelho liga o seu — celular e computador são independentes.
 */
export function AvisosNoAparelho() {
  const [estado, setEstado] = useState<EstadoPush>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void estadoDoPush()
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado("sem_suporte"));
    return () => {
      vivo = false;
    };
  }, []);

  async function agir(fn: () => Promise<EstadoPush | void>, depois?: string) {
    setOcupado(true);
    setRecado(null);
    try {
      const novo = await fn();
      if (novo) setEstado(novo);
      if (depois) setRecado(depois);
    } catch (e) {
      setRecado((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando" || estado === "sem_suporte") return null;

  return (
    <div className="border-t border-aura-mist px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
          <BellRing size={14} className={estado === "ligado" ? "text-aura-petrol-500" : "text-aura-graphite-soft"} />
        </span>
        <div className="min-w-0 flex-1">
          {estado === "ligado" && (
            <>
              <p className="text-xs font-semibold text-aura-graphite">Avisos ligados neste aparelho</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => agir(mandarTeste, "Teste enviado. Deve aparecer em alguns segundos.")}
                  className="font-medium text-aura-petrol-600 hover:underline disabled:opacity-50"
                >
                  Mandar um teste
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => agir(desligarPush)}
                  className="font-medium text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
                >
                  Desligar
                </button>
              </div>
            </>
          )}
          {estado === "desligado" && (
            <>
              <p className="text-xs text-aura-graphite-soft">
                Receba lead novo, cliente esperando e recados da equipe mesmo com o AURA fechado.
              </p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => agir(ligarPush)}
                className="aura-btn aura-btn-primario aura-btn-sm mt-2"
              >
                {ocupado && <Loader2 size={12} className="animate-spin" />}
                Ligar avisos neste aparelho
              </button>
            </>
          )}
          {estado === "bloqueado" && (
            <p className="text-xs text-aura-graphite-soft">
              Os avisos estão bloqueados para o AURA neste navegador. Libere em Configurações do site › Notificações e
              recarregue a página.
            </p>
          )}
          {estado === "iphone_sem_app" && (
            <p className="text-xs text-aura-graphite-soft">
              No iPhone, os avisos só funcionam com o AURA na tela de início: toque em Compartilhar › Adicionar à Tela de
              Início e abra o AURA por lá.
            </p>
          )}
          {recado && <p className="mt-1.5 text-xs text-aura-graphite-soft">{recado}</p>}
        </div>
      </div>
    </div>
  );
}
