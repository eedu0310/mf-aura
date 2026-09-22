"use client";

import { useState } from "react";
import { BarChart3, Settings, Users } from "lucide-react";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { UsuariosTab } from "@/components/gestor/usuarios-tab";
import { ConfiguracoesTab } from "@/components/gestor/configuracoes-tab";

type AbaMarketingGestor = "dashboard" | "usuarios" | "configuracoes";

const ABAS: Array<{
  id: AbaMarketingGestor;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export function MarketingTab() {
  const [aba, setAba] = useState<AbaMarketingGestor>("dashboard");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-aura-mist bg-white p-2">
        <nav className="flex flex-wrap gap-2" aria-label="Abas de Marketing">
          {ABAS.map((item) => {
            const Icon = item.icon;
            const ativa = aba === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  ativa
                    ? "bg-aura-navy-950 text-white"
                    : "text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
                }`}
                aria-selected={ativa}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {aba === "dashboard" && (
        <VisaoGeralMarketing onIrPara={() => undefined} />
      )}
      {aba === "usuarios" && <UsuariosTab />}
      {aba === "configuracoes" && <ConfiguracoesTab />}
    </section>
  );
}
