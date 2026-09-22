"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { listarNotificacoes, marcarComoLida, deletarNotificacao, limparNotificacoes, type Notificacao } from "@/lib/supabase/notificacoes";

const ICONS: Record<string, React.ReactNode> = {
  compromisso: <AlertCircle size={16} className="text-aura-petrol-600" />,
  lead_frio: <AlertCircle size={16} className="text-aura-warning" />,
  tarefa_urgente: <AlertCircle size={16} className="text-aura-danger" />,
  saudacao: <Bell size={16} className="text-aura-gold" />,
  venda: <CheckCircle size={16} className="text-aura-success" />,
  meta_atingida: <CheckCircle size={16} className="text-aura-success" />,
  alerta: <AlertCircle size={16} className="text-aura-danger" />,
};

const CORES: Record<string, string> = {
  compromisso: "bg-aura-petrol-50 border-aura-petrol-200",
  lead_frio: "bg-yellow-50 border-yellow-200",
  tarefa_urgente: "bg-red-50 border-red-200",
  saudacao: "bg-aura-gold/10 border-aura-gold/30",
  venda: "bg-green-50 border-green-200",
  meta_atingida: "bg-green-50 border-green-200",
  alerta: "bg-red-50 border-red-200",
};

export function NotificationCenter() {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    const lista = await listarNotificacoes();
    setNotificacoes(lista);
  }

  useEffect(() => {
    carregar();

    // Sincronizar a cada 30 segundos
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleMarcarComoLida(id: string) {
    await marcarComoLida(id);
    await carregar();
  }

  async function handleDeletar(id: string) {
    await deletarNotificacao(id);
    await carregar();
  }

  async function handleLimpar() {
    if (confirm("Limpar todas as notificações lidas?")) {
      setCarregando(true);
      await limparNotificacoes();
      await carregar();
      setCarregando(false);
    }
  }

  const naoLidas = notificacoes.filter((n) => !n.lida);

  return (
    <div className="relative">
      {/* Botão */}
      <button
        onClick={() => setAberto(!aberto)}
        className="relative rounded-lg p-2 transition hover:bg-aura-bg"
      >
        <Bell size={20} className="text-aura-graphite" />
        {naoLidas.length > 0 && (
          <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-aura-danger text-xs font-bold text-white">
            {naoLidas.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {aberto && (
        <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-1rem)] rounded-2xl border border-aura-mist bg-white shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-aura-mist px-4 py-3">
            <p className="font-medium text-aura-graphite">Notificações</p>
            <button
              onClick={() => setAberto(false)}
              className="rounded-lg p-1 transition hover:bg-aura-bg"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo */}
          {notificacoes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={32} className="mx-auto mb-2 text-aura-graphite-soft" />
              <p className="text-sm text-aura-graphite-soft">
                Nenhuma notificação
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notificacoes.map((notif) => (
                <div
                  key={notif.id}
                  className={`border-b border-aura-mist px-4 py-3 transition hover:bg-aura-bg/50 ${
                    notif.lida ? "opacity-60" : ""
                  } ${CORES[notif.tipo]}`}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      {ICONS[notif.tipo]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-aura-graphite">
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-aura-graphite-soft">
                        {notif.mensagem}
                      </p>
                      <p className="mt-1 text-xs text-aura-graphite-soft/70">
                        {new Date(notif.criadaEm).toLocaleTimeString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!notif.lida && (
                        <button
                          onClick={() => handleMarcarComoLida(notif.id)}
                          className="rounded p-1 transition hover:bg-aura-petrol-100"
                          title="Marcar como lida"
                        >
                          <CheckCircle size={14} className="text-aura-petrol-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletar(notif.id)}
                        className="rounded p-1 transition hover:bg-red-100"
                        title="Deletar"
                      >
                        <X size={14} className="text-aura-danger" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="border-t border-aura-mist px-4 py-2 text-center">
              <button
                onClick={handleLimpar}
                disabled={carregando}
                className="text-xs text-aura-graphite-soft transition hover:text-aura-graphite disabled:opacity-50"
              >
                {carregando ? (
                  <Loader2 size={12} className="inline animate-spin" />
                ) : (
                  "Limpar lidas"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}