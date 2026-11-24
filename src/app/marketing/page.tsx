"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAbaMarketing, ABAS_MARKETING } from "@/components/marketing/aba-marketing";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { LeadsMarketing } from "@/components/marketing/leads-marketing";
import { CampanhasMarketing } from "@/components/marketing/campanhas-marketing";
import { CalendarioPostagens } from "@/components/marketing/calendario-postagens";
import { PlanilhaConsolidada } from "@/components/gestor/planilha-consolidada";
import { saudacaoDoDia } from "@/lib/date-local";
import { PageContainer, PageHeader, Segmentado, classeBotao } from "@/components/ui";

export default function MarketingPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { aba, setAba } = useAbaMarketing();
  const abaAtual = ABAS_MARKETING.find((a) => a.id === aba);

  return (
    <PageContainer largura="normal">
      <PageHeader
        rotulo={abaAtual?.label ?? "Central de Marketing"}
        titulo={`${saudacaoDoDia()}, ${profile.nome}`}
        descricao={`Leads, campanhas, postagens e indicadores da ${profile.empresa}`}
        icone={Megaphone}
        acoes={
          <>
            {/* Botões Voltar e Gestor */}
            <button type="button" onClick={() => router.back()} className={classeBotao("secundario", "sm")}>
              <ArrowLeft size={14} />
              Voltar
            </button>
            {profile.cargo === "Gestor" && (
              <Link href="/gestor" className={classeBotao("secundario", "sm")}>
                <LayoutDashboard size={14} />
                Painel Gestor
              </Link>
            )}
          </>
        }
      />

      {/* Navegação */}
      <Segmentado
        rotulo="Seções do marketing"
        valor={aba}
        aoMudar={setAba}
        className="mb-6"
        opcoes={ABAS_MARKETING.map((item) => ({ valor: item.id, rotulo: item.label }))}
      />

      {/* Conteúdo */}
      <div>
        {aba === "visao-geral" && <VisaoGeralMarketing onIrPara={setAba} />}
        {aba === "leads" && <LeadsMarketing />}
        {aba === "campanhas" && <CampanhasMarketing />}
        {aba === "postagens" && <CalendarioPostagens />}
        {aba === "indicadores" && <PlanilhaConsolidada />}
      </div>
    </PageContainer>
  );
}