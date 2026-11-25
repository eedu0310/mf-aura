"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ExternalLink, Settings, Users } from "lucide-react";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { hrefDaAba } from "@/components/marketing/aba-marketing";
import { UsuariosTab } from "@/components/gestor/usuarios-tab";
import { ConfiguracoesTab } from "@/components/gestor/configuracoes-tab";
import { BotaoLink, Segmentado } from "@/components/ui";

type AbaMarketingGestor = "dashboard" | "usuarios" | "configuracoes";

const ABAS: Array<{
  id: AbaMarketingGestor;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "dashboard", label: "Resumo", icon: BarChart3 },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

/**
 * Aba "Marketing" do painel do gestor: o mesmo resumo da Central de Marketing,
 * com os atalhos levando para a seção certa de lá (antes não levavam a lugar
 * nenhum), mais usuários e configurações.
 */
export function MarketingTab() {
  const router = useRouter();
  const [aba, setAba] = useState<AbaMarketingGestor>("dashboard");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <BotaoLink href="/marketing" tamanho="sm" icone={ExternalLink}>
          Abrir Central de Marketing
        </BotaoLink>
      </div>

      {aba === "dashboard" && <VisaoGeralMarketing onIrPara={(destino) => router.push(hrefDaAba(destino))} />}
      {aba === "usuarios" && <UsuariosTab />}
      {aba === "configuracoes" && <ConfiguracoesTab />}
    </section>
  );
}
