"use client";

import { useState } from "react";
import { BarChart3, Settings, Users } from "lucide-react";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { UsuariosTab } from "@/components/gestor/usuarios-tab";
import { ConfiguracoesTab } from "@/components/gestor/configuracoes-tab";
import { Segmentado } from "@/components/ui";

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
      <Segmentado
        rotulo="Abas de Marketing"
        valor={aba}
        aoMudar={setAba}
        opcoes={ABAS.map((item) => {
          const Icon = item.icon;
          return {
            valor: item.id,
            rotulo: (
              <span className="flex items-center gap-1.5">
                <Icon size={15} aria-hidden />
                {item.label}
              </span>
            ),
          };
        })}
      />

      {aba === "dashboard" && (
        <VisaoGeralMarketing onIrPara={() => undefined} />
      )}
      {aba === "usuarios" && <UsuariosTab />}
      {aba === "configuracoes" && <ConfiguracoesTab />}
    </section>
  );
}
