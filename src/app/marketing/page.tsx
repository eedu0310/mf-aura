"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAbaMarketing, ABAS_MARKETING } from "./layout";
import { VisaoGeralMarketing } from "@/components/marketing/visao-geral-marketing";
import { LeadsMarketing } from "@/components/marketing/leads-marketing";
import { CampanhasMarketing } from "@/components/marketing/campanhas-marketing";
import { CalendarioPostagens } from "@/components/marketing/calendario-postagens";
import { PlanilhaConsolidada } from "@/components/gestor/planilha-consolidada";
import { saudacaoDoDia } from "@/lib/date-local";

export default function MarketingPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { aba, setAba } = useAbaMarketing();
  const abaAtual = ABAS_MARKETING.find((a) => a.id === aba);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-aura-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aura-petrol-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-aura-gold">
                <Sparkles size={12} />
                {abaAtual?.label ?? "Central de Marketing"}
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-white sm:text-3xl">
                {saudacaoDoDia()}, {profile.nome}
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Leads, campanhas, postagens e indicadores da {profile.empresa}
              </p>
            </div>

            {/* Botões Voltar e Gestor */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 hover:bg-white/5"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
              {profile.cargo === "Gestor" && (
                <Link
                  href="/gestor"
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  <LayoutDashboard size={14} />
                  Painel Gestor
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navegação com Cards */}
      <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8">
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ABAS_MARKETING.map((item) => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={`rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                aba === item.id
                  ? "bg-aura-petrol-600 text-white"
                  : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="pb-24">
          {aba === "visao-geral" && <VisaoGeralMarketing onIrPara={setAba} />}
          {aba === "leads" && <LeadsMarketing />}
          {aba === "campanhas" && <CampanhasMarketing />}
          {aba === "postagens" && <CalendarioPostagens />}
          {aba === "indicadores" && <PlanilhaConsolidada />}
        </div>
      </div>
    </div>
  );
}