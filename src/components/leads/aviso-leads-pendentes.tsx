"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, ChevronRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Faixa vermelha de "lead esperando você".
 *
 * Pedido do Elton (25/11): muitos vendedores não abrem a aba Leads e o
 * contato se perde. Enquanto a pessoa tiver lead dela sem resposta (com o
 * SDR ou com o vendedor, ainda não marcado como respondido, frio ou
 * perdido), aparece uma faixa vermelha no alto de todas as telas e um número
 * vermelho no item Leads do menu. Sai sozinha quando o lead é atendido.
 *
 * Um só ouvinte para a tela inteira (faixa, menu do computador e do
 * celular): os componentes leem o mesmo estado.
 */

export interface LeadPendente {
  id: string;
  nome: string | null;
  origem: string | null;
  createdAt: string;
}

const EVENTO = "aura:leads-pendentes";
const ATUALIZA_MS = 60_000;
let atual: LeadPendente[] = [];
let ligado = false;

function publicar(lista: LeadPendente[]) {
  atual = lista;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: lista }));
}

async function buscar() {
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const { data: u } = await sb.auth.getUser();
  const eu = u.user?.id;
  if (!eu) return publicar([]);
  const { data, error } = await sb
    .from("leads_recebidos")
    .select("id, nome, telefone, origem, created_at, status, vendedor_id, sdr_id, natureza")
    .in("status", ["atribuido_sdr", "repassado_vendedor"])
    .or(`vendedor_id.eq.${eu},sdr_id.eq.${eu}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return;
  publicar(
    (data ?? [])
      // Com vendedor, o lead é do vendedor; com SDR, é do SDR. Cliente antigo
      // ou não-lead (natureza marcada no WhatsApp) não conta.
      .filter((l) => (l.vendedor_id ?? l.sdr_id) === eu && (!l.natureza || l.natureza === "lead"))
      .map((l) => ({
        id: String(l.id),
        nome: (l.nome as string | null) || (l.telefone as string | null),
        origem: l.origem as string | null,
        createdAt: String(l.created_at),
      })),
  );
}

function ligar() {
  if (ligado) return;
  ligado = true;
  void buscar();
  const sb = getSupabaseBrowserClient();
  sb
    ?.channel("aura-leads-pendentes")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => void buscar())
    .subscribe();
  window.setInterval(() => void buscar(), ATUALIZA_MS);
  window.addEventListener("focus", () => void buscar());
}

/** Leads da pessoa logada esperando resposta (mais novos primeiro). */
export function useLeadsPendentes(): LeadPendente[] {
  const [lista, setLista] = useState<LeadPendente[]>(atual);
  useEffect(() => {
    const ouvir = (e: Event) => setLista((e as CustomEvent<LeadPendente[]>).detail ?? []);
    window.addEventListener(EVENTO, ouvir);
    ligar();
    setLista(atual);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  return lista;
}

function haQuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export function AvisoLeadsPendentes() {
  const lista = useLeadsPendentes();
  const pathname = usePathname();
  const [, tique] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tique((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (!lista.length || pathname === "/leads") return null;
  const maisNovo = lista[0];
  const novo = Date.now() - new Date(maisNovo.createdAt).getTime() < 60 * 60_000;
  const n = lista.length;

  return (
    <Link
      href="/leads"
      data-imprimir="esconder"
      role="alert"
      className="group sticky top-14 z-40 lg:top-0 flex items-center gap-3 border-b border-l-[3px] border-aura-danger/40 border-l-aura-danger bg-[color-mix(in_srgb,var(--aura-danger)_11%,var(--aura-surface))] px-4 py-2.5 text-aura-graphite shadow-sm transition hover:bg-[color-mix(in_srgb,var(--aura-danger)_17%,var(--aura-surface))] sm:px-8"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-danger text-white shadow-sm">
        <BellRing size={16} className={novo ? "animate-bounce" : ""} />
        {novo && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-aura-danger ring-2 ring-aura-surface" />
        )}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        <strong className="font-semibold text-aura-danger">
          {n === 1 ? "Você tem 1 lead esperando você chamar" : `Você tem ${n} leads esperando você chamar`}
        </strong>
        <span className="block truncate text-xs text-aura-graphite-soft sm:inline sm:before:content-['_·_']">
          {novo ? "Novo: " : "Mais recente: "}
          {maisNovo.nome ?? "Contato novo"}
          {maisNovo.origem ? ` (${maisNovo.origem})` : ""} · {haQuanto(maisNovo.createdAt)}
        </span>
      </span>
      <span className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-aura-danger px-3 text-xs font-semibold text-white shadow-sm transition group-hover:brightness-95">
        Atender agora
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}
