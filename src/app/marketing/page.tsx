"use client";

import { Table2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAbaMarketing, dadosDaAba } from "@/components/marketing/aba-marketing";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { LeadsMarketing } from "@/components/marketing/leads-marketing";
import { CampanhasMarketing } from "@/components/marketing/campanhas-marketing";
import { CalendarioPostagens } from "@/components/marketing/calendario-postagens";
import { PlanilhaConsolidada } from "@/components/gestor/planilha-consolidada";
import { BotaoLink, PageContainer, PageHeader } from "@/components/ui";

/**
 * Central de Marketing. O menu fica só no layout (coluna da esquerda); aqui o
 * cabeçalho diz em que seção a pessoa está e o que ela encontra ali.
 */
export default function MarketingPage() {
  const { profile } = useUserProfile();
  const { aba, setAba } = useAbaMarketing();
  const secao = dadosDaAba(aba);

  return (
    <PageContainer largura="normal">
      <PageHeader
        rotulo={profile.empresa ? `Central de Marketing · ${profile.empresa}` : "Central de Marketing"}
        titulo={secao.label}
        descricao={secao.descricao}
        icone={secao.icon}
        acoes={
          aba === "indicadores" ? (
            <BotaoLink href="/marketing/planilha-leads" icone={Table2} tamanho="sm">
              Planilha por vendedor
            </BotaoLink>
          ) : undefined
        }
      />

      {aba === "visao-geral" && <VisaoGeralMarketing onIrPara={setAba} />}
      {aba === "leads" && <LeadsMarketing />}
      {aba === "campanhas" && <CampanhasMarketing />}
      {aba === "postagens" && <CalendarioPostagens />}
      {aba === "indicadores" && <PlanilhaConsolidada />}
    </PageContainer>
  );
}
