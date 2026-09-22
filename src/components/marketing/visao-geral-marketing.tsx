"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { UserPlus, Megaphone, Calendar as CalendarIcon, TrendingUp, Clock, Trophy } from "lucide-react";
import { listarLeads, type Lead } from "@/lib/supabase/leads";
import { listarCampanhas, type Campanha } from "@/lib/supabase/campanhas-marketing";
import { listarPostagens, type PostagemMarketing } from "@/lib/supabase/postagens-marketing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AbaMarketing } from "@/app/marketing/layout";

interface ItemAtividade {
  id: string;
  tipo: "lead" | "postagem";
  titulo: string;
  detalhe: string;
  quando: Date;
}

function tempoRelativo(data: Date) {
  const diffMs = Date.now() - data.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}


export function VisaoGeralMarketing({ onIrPara }: { onIrPara: (aba: AbaMarketing) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [postagens, setPostagens] = useState<PostagemMarketing[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const [l, c, p] = await Promise.all([listarLeads(), listarCampanhas(), listarPostagens()]);
    if (l) setLeads(l);
    setCampanhas(c);
    setPostagens(p);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-marketing-visao-geral-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "campanhas_marketing" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "postagens_marketing" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const respondidos = leads.filter((l) => l.status === "respondido").length;
  const taxaResposta = leads.length > 0 ? Math.round((respondidos / leads.length) * 100) : 0;
  const campanhasAtivas = campanhas.filter((c) => c.status === "ativa").length;
  const publicadas = postagens.filter((p) => p.status === "publicado").length;
  const aguardandoAprovacao = postagens.filter((p) => p.status === "aguardando_aprovacao").length;

  const dadosGrafico = useMemo(() => {
    const hoje = new Date();
    const dias: { chave: string; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      dias.push({ chave: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return dias.map(({ chave, label }) => ({
      dia: label,
      Leads: leads.filter((l) => l.createdAt?.slice(0, 10) === chave).length,
    }));
  }, [leads]);

  const totalUltimos14Dias = dadosGrafico.reduce((s, d) => s + d.Leads, 0);

  const topCampanhas = [...campanhas].sort((a, b) => b.leadsGerados - a.leadsGerados).slice(0, 5);

  const atividade: ItemAtividade[] = [
    ...leads.slice(0, 8).map((l) => ({
      id: `lead-${l.id}`,
      tipo: "lead" as const,
      titulo: l.nome || l.telefone,
      detalhe: l.resumoIa || `Novo lead via ${l.origem}`,
      quando: new Date(l.createdAt),
    })),
    ...postagens.slice(0, 8).map((p) => ({
      id: `post-${p.id}`,
      tipo: "postagem" as const,
      titulo: p.titulo,
      detalhe:
        p.status === "publicado"
          ? "Publicada"
          : p.status === "aguardando_aprovacao"
            ? "Aguardando aprovação"
            : "Planejada",
      quando: new Date(p.createdAt),
    })),
  ]
    .sort((a, b) => b.quando.getTime() - a.quando.getTime())
    .slice(0, 6);

  const CARDS = [
    {
      aba: "leads" as const,
      icon: UserPlus,
      label: "Leads recebidos",
      valor: leads.length,
      nota: `${taxaResposta}% respondidos`,
      cor: "text-aura-petrol-600",
      bg: "bg-aura-petrol-700/10",
    },
    {
      aba: "campanhas" as const,
      icon: Megaphone,
      label: "Campanhas ativas",
      valor: campanhasAtivas,
      nota: `${campanhas.length} no total`,
      cor: "text-aura-gold",
      bg: "bg-aura-gold/10",
    },
    {
      aba: "postagens" as const,
      icon: CalendarIcon,
      label: "Postagens publicadas",
      valor: publicadas,
      nota: aguardandoAprovacao > 0 ? `${aguardandoAprovacao} aguardando aprovação` : "Tudo em dia",
      cor: "text-aura-success",
      bg: "bg-aura-success/10",
    },
    {
      aba: "indicadores" as const,
      icon: TrendingUp,
      label: "Taxa de resposta",
      valor: `${taxaResposta}%`,
      nota: "dos leads recebidos",
      cor: "text-aura-warning",
      bg: "bg-aura-warning/10",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map((c) => (
          <button
            key={c.aba}
            type="button"
            onClick={() => onIrPara(c.aba)}
            className="flex flex-col items-start gap-3 rounded-2xl border border-aura-mist bg-white p-4 text-left transition hover:border-aura-petrol-500/40 hover:shadow-sm"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.cor}`}>
              <c.icon size={17} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-aura-graphite">
                {carregando ? "—" : c.valor}
              </p>
              <p className="text-xs font-medium text-aura-graphite">{c.label}</p>
              <p className="text-[0.7rem] text-aura-graphite-soft">{c.nota}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
              <TrendingUp size={15} className="text-aura-petrol-600" />
              Leads nos últimos 14 dias
            </p>
            <span className="text-xs text-aura-graphite-soft">{totalUltimos14Dias} no total</span>
          </div>
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGrafico} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--aura-petrol-600)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--aura-petrol-600)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "var(--aura-mist)", fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="Leads"
                  stroke="var(--aura-petrol-600)"
                  strokeWidth={2.5}
                  fill="url(#leadsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
            <Trophy size={15} className="text-aura-gold" />
            Top campanhas
          </p>
          {topCampanhas.length === 0 ? (
            <p className="mt-4 text-center text-xs text-aura-graphite-soft">
              Nenhuma campanha com leads registrados ainda.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-aura-mist">
              {topCampanhas.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 shrink-0 text-center text-xs font-bold ${
                        i === 0 ? "text-aura-gold" : "text-aura-graphite-soft"
                      }`}
                    >
                      {i + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-aura-graphite">{c.nome}</p>
                      <p className="truncate text-xs text-aura-graphite-soft">{c.canal}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-data text-sm font-semibold text-aura-graphite">
                    {c.leadsGerados}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
          <Clock size={15} className="text-aura-petrol-600" />
          Atividade recente
        </p>
        {carregando ? (
          <p className="mt-4 text-center text-sm text-aura-graphite-soft">Carregando...</p>
        ) : atividade.length === 0 ? (
          <p className="mt-4 text-center text-sm text-aura-graphite-soft">
            Nada por aqui ainda — assim que chegar um lead ou você criar uma postagem, aparece aqui.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-aura-mist">
            {atividade.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.tipo === "lead" ? "bg-aura-petrol-700/10 text-aura-petrol-700" : "bg-aura-gold/10 text-aura-gold"
                  }`}
                >
                  {item.tipo === "lead" ? <UserPlus size={13} /> : <CalendarIcon size={13} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-aura-graphite">{item.titulo}</p>
                  <p className="truncate text-xs text-aura-graphite-soft">{item.detalhe}</p>
                </div>
                <span className="shrink-0 text-[0.7rem] text-aura-graphite-soft">{tempoRelativo(item.quando)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
