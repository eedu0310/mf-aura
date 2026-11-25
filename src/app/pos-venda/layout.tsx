"use client";

import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { useUserProfile } from "@/lib/user-profile-context";
import { AreaDeTrabalho, type GrupoDaArea } from "@/components/area-de-trabalho";
import { ProvedorPosVenda, usePosVenda } from "@/components/pos-venda/dados-pos-venda";
import { SECOES_POS_VENDA, hrefDaSecao, useSecaoPosVenda, type SecaoPosVenda } from "@/components/pos-venda/secoes";
import { motivoDeAtencao, temReclamacaoAberta } from "@/components/pos-venda/regras";
import { manutencaoVencida } from "@/components/pos-venda/regras-manutencao";

/** Motivos de atenção que são da instalação (contam no menu "Instalações"). */
const PENDENCIA_DE_INSTALACAO = new Set(["atrasada", "pendente", "sem_agendar"]);

/**
 * O Pós-venda é uma ÁREA DE TRABALHO (src/components/area-de-trabalho): abre
 * sozinho, sem o menu do CRM (Leads, Relacionamentos...), com as próprias
 * seções, e o Voltar leva para onde a pessoa estava — pedido do Elton
 * (25/11). Mesma casca da Central de Marketing e do Painel do Gestor.
 *
 * Os dados são carregados uma vez aqui (ProvedorPosVenda) e servem a todas as
 * seções e aos contadores do menu.
 */
function Casca({ children }: { children: React.ReactNode }) {
  const { profile } = useUserProfile();
  const secao = useSecaoPosVenda();
  const { itensDaLoja, hoje, carregando, manutencoes } = usePosVenda();

  // Contadores do menu: só o que é pendência de verdade (o número é vermelho).
  const contador: Partial<Record<SecaoPosVenda, number>> = {};
  if (!carregando) {
    contador.instalacoes = itensDaLoja.filter((i) =>
      PENDENCIA_DE_INSTALACAO.has(motivoDeAtencao(i, hoje)?.chave ?? "")
    ).length;
    contador.reclamacoes = itensDaLoja.filter(temReclamacaoAberta).length;
  }
  if (!manutencoes.carregando) {
    contador.manutencoes = manutencoes.itens.filter((m) => manutencaoVencida(m, hoje)).length;
  }

  const grupos: GrupoDaArea[] = [
    {
      itens: SECOES_POS_VENDA.map((s) => ({
        id: s.id,
        rotulo: s.rotulo,
        href: hrefDaSecao(s.id),
        icone: s.icone,
        ativo: secao === s.id,
        contador: contador[s.id] || undefined,
      })),
    },
  ];
  // Atalho só do gestor, num grupo à parte para não parecer mais uma seção.
  if (profile.cargo === "Gestor") {
    grupos.push({
      titulo: "Gestão",
      itens: [{ id: "gestor", rotulo: "Painel do gestor", href: "/gestor", icone: LayoutDashboard, ativo: false }],
    });
  }

  return (
    <AreaDeTrabalho nome="Pós-venda" selo="PÓS" inicio="/pos-venda" grupos={grupos}>
      {children}
    </AreaDeTrabalho>
  );
}

export default function PosVendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Pós-venda", "Gestor"]}>
        {/* A seção aberta vem da URL (useSearchParams), que pede um Suspense em volta. */}
        <Suspense fallback={null}>
          <ProvedorPosVenda>
            <Casca>{children}</Casca>
          </ProvedorPosVenda>
        </Suspense>
      </RoleGuard>
    </OnboardingGuard>
  );
}
