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
      className="sticky top-14 z-40 lg:top-0 flex items-center gap-3 bg-[#CD1C1B] px-4 py-2.5 text-white shadow-md transition hover:bg-[#b01615] sm:px-8"
    >
      <span className="relative flex shrink-0">
        <BellRing size={18} className={novo ? "animate-bounce" : ""} />
        {novo && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        <strong>
          {n === 1 ? "Você tem 1 lead esperando você chamar" : `Você tem ${n} leads esperando você chamar`}
        </strong>
        <span className="block truncate text-xs text-white/85 sm:inline sm:before:content-['_·_']">
          {novo ? "Novo: " : "Mais recente: "}
          {maisNovo.nome ?? "Contato novo"}
          {maisNovo.origem ? ` (${maisNovo.origem})` : ""} · {haQuanto(maisNovo.createdAt)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#CD1C1B]">
        Atender agora
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}
