"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

export function SyncIndicator() {
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  useEffect(() => {
    function handleSync() {
      setSincronizando(true);
      setUltimaAtualizacao(new Date());

      setTimeout(() => setSincronizando(false), 1500);
    }

    window.addEventListener("supabase-change", handleSync);

    return () => {
      window.removeEventListener("supabase-change", handleSync);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-aura-graphite-soft shadow-md border border-aura-mist">
      <div className={`flex items-center gap-1 ${sincronizando ? "animate-spin" : ""}`}>
        <RotateCw size={14} className={sincronizando ? "text-green-600" : ""} />
      </div>
      <span>
        {sincronizando ? "Sincronizando..." : "Sincronizado"}
      </span>
      {ultimaAtualizacao && (
        <span className="text-xs text-aura-graphite-soft/50">
          {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
        </span>
      )}
    </div>
  );
}