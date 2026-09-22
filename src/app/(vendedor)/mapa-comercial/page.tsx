"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle, Target } from "lucide-react";
import { FunilAtendimento } from "@/components/area-vendedor/funil-atendimento";

export default function MapaComercialPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <div className="flex items-start gap-3">
        <Link href="/area-vendedor" aria-label="Voltar para Área do Vendedor" className="mt-1 flex h-8 w-8 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite">
          <ArrowLeft size={17} />
        </Link>
        <div>
          <div className="flex items-center gap-2"><Target size={20} className="text-aura-petrol-700" /><h1 className="font-display text-xl font-semibold text-aura-graphite">Mapa Comercial</h1></div>
          <p className="mt-1 text-sm text-aura-graphite-soft">Cadência pronta para conduzir o cliente do primeiro contato ao pós-venda.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="text-sm font-semibold text-aura-graphite">Use durante o atendimento</p><p className="mt-1 text-xs leading-relaxed text-aura-graphite-soft">Escolha a etapa, copie a mensagem adequada e registre o próximo passo no CRM.</p></div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="flex items-center gap-2 text-sm font-semibold text-aura-graphite"><MessageCircle size={15} className="text-aura-success" /> WhatsApp direto</p><p className="mt-1 text-xs leading-relaxed text-aura-graphite-soft">As mensagens podem ser copiadas ou abertas diretamente no WhatsApp para envio ao cliente.</p></div>
      </div>

      <FunilAtendimento />
    </div>
  );
}
