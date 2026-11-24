"use client";

import { ArrowLeft, MessageCircle, Target } from "lucide-react";
import { FunilAtendimento } from "@/components/area-vendedor/funil-atendimento";
import Link from "next/link";
import { Card, PageContainer, PageHeader, classeBotao } from "@/components/ui";

export default function MapaComercialPage() {
  return (
    <PageContainer largura="estreita">
      <PageHeader
        titulo="Mapa Comercial"
        descricao="Cadência pronta para conduzir o cliente do primeiro contato ao pós-venda."
        icone={Target}
        acoes={
          <Link href="/area-vendedor" aria-label="Voltar para Área do Vendedor" className={classeBotao("fantasma", "sm", "w-8 px-0")}>
            <ArrowLeft size={15} />
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm font-semibold text-aura-graphite">Use durante o atendimento</p>
            <p className="mt-1 text-xs leading-relaxed text-aura-graphite-soft">Escolha a etapa, copie a mensagem adequada e registre o próximo passo no CRM.</p>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-aura-graphite"><MessageCircle size={15} className="text-aura-success" /> WhatsApp direto</p>
            <p className="mt-1 text-xs leading-relaxed text-aura-graphite-soft">As mensagens podem ser copiadas ou abertas diretamente no WhatsApp para envio ao cliente.</p>
          </Card>
        </div>

        <FunilAtendimento />
      </div>
    </PageContainer>
  );
}
