"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import {
  UserPlus,
  Megaphone,
  Calendar as CalendarIcon,
  TrendingUp,
  Clock,
  Trophy,
  Radio,
  BellRing,
  Table2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { listarLeads, type Lead } from "@/lib/supabase/leads";
import { listarCampanhas, type Campanha } from "@/lib/supabase/campanhas-marketing";
import { listarPostagens, type PostagemMarketing } from "@/lib/supabase/postagens-marketing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { diaEmSaoPaulo } from "@/lib/fuso";
import type { AbaMarketing } from "@/components/marketing/aba-marketing";
import { STATUS_POSTAGEM, leadSemResposta, tempoRelativo } from "@/components/marketing/rotulos";
import { Alerta, Botao, Card, CardHeader, EstadoVazio, type Tom } from "@/components/ui";

interface ItemAtividade {
  id: string;
  tipo: "lead" | "postagem";
  titulo: string;
  detalhe: string;
  quando: Date;
}

interface ItemAtencao {
  id: string;
  tom: "perigo" | "atencao" | "info";
  titulo: string;
  descricao: string;
  aba: AbaMarketing;
  acao: string;
}

const COR_KPI: Record<Tom, string> = {
  neutro: "text-aura-graphite",
  marca: "text-aura-petrol-600",
  sucesso: "text-aura-success",
  atencao: "text-aura-gold-700",
  perigo: "text-aura-danger",
  ouro: "text-aura-gold-700",
};

/** Número do topo que também é atalho para a seção dele. */
function KpiAtalho({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "neutro",
  onClick,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe: string;
  icone: LucideIcon;
  tom?: Tom;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aura-card aura-card-interativo group flex flex-col items-start p-4 text-left"
    >
      <div className="flex w-full items-center gap-1.5">
        <Icone size={13} className={tom === "neutro" ? "text-aura-petrol-600" : COR_KPI[tom]} />
        <p className="aura-rotulo truncate">{rotulo}</p>
        <ArrowRight
          size={13}
          className="ml-auto shrink-0 text-aura-graphite-soft opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${COR_KPI[tom]}`}>{valor}</p>
      <p className="mt-1 text-xs text-aura-graphite-soft">{detalhe}</p>
    </button>
  );
}

const ATALHOS: Array<{ aba: AbaMarketing; icone: LucideIcon; titulo: string; descricao: string }> = [
  { aba: "leads", icone: UserPlus, titulo: "Leads", descricao: "Buscar e filtrar quem chegou" },
  { aba: "campanhas", icone: Megaphone, titulo: "Campanhas", descricao: "Criar e acompanhar anúncios" },
  { aba: "postagens", icone: CalendarIcon, titulo: "Postagens", descricao: "Calendário e aprovações" },
  { aba: "indicadores", icone: Table2, titulo: "Indicadores", descricao: "Números semanais da equipe" },
];

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
      // Dia de Brasília dos dois lados: em UTC o lead das 21h às 24h caía no
      // dia seguinte, e o rótulo (hora local) não batia com a chave (UTC).
      const chave = diaEmSaoPaulo(d);
      dias.push({ chave, label: `${Number(chave.slice(8, 10))}/${Number(chave.slice(5, 7))}` });
    }
    return dias.map(({ chave, label }) => ({
      dia: label,
      Leads: leads.filter((l) => l.createdAt && diaEmSaoPaulo(new Date(l.createdAt)) === chave).length,
    }));
  }, [leads]);

  const totalUltimos14Dias = dadosGrafico.reduce((s, d) => s + d.Leads, 0);
  const ultimos7Dias = dadosGrafico.slice(-7).reduce((s, d) => s + d.Leads, 0);

  /*
   * De onde vêm os leads: as seis origens que mais trouxeram gente e o resto
   * somado em "Outras", para a lista não crescer sem fim.
   */
  const porOrigem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of leads) {
      const origem = l.origem?.trim() || "Sem origem";
      mapa.set(origem, (mapa.get(origem) ?? 0) + 1);
    }
    const ordenado = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const topo = ordenado.slice(0, 6).map(([origem, total]) => ({ origem, total }));
    const resto = ordenado.slice(6).reduce((s, [, total]) => s + total, 0);
    if (resto > 0) topo.push({ origem: "Outras", total: resto });
    return topo;
  }, [leads]);
  const maiorOrigem = Math.max(1, ...porOrigem.map((o) => o.total));

  /*
   * Campanha sem lead nenhum não ocupa vaga no top: o quadro é para mostrar o
   * que está trazendo gente, e com os números vindo da contagem real agora dá
   * para separar quem gerou de quem não gerou.
   */
  const topCampanhas = [...campanhas]
    .filter((c) => c.leadsGerados > 0 || c.vendasFechadas > 0)
    .sort((a, b) => b.valorGerado - a.valorGerado || b.leadsGerados - a.leadsGerados)
    .slice(0, 5);

  const moedaCurta = (v: number) =>
    v >= 1000
      ? `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",")} mil`
      : `R$ ${Math.round(v)}`;

  /*
   * O que pede ação hoje, do mais urgente para o menos. Cada item leva direto
   * para a seção onde se resolve, para ninguém ter de procurar.
   */
  const atencao = useMemo<ItemAtencao[]>(() => {
    const itens: ItemAtencao[] = [];
    const agora = Date.now();
    const hojeISO = diaEmSaoPaulo();

    const semResposta = leads.filter((l) => leadSemResposta(l.status));
    const atrasados = semResposta.filter((l) => l.prazoResposta && new Date(l.prazoResposta).getTime() < agora);
    if (atrasados.length > 0) {
      itens.push({
        id: "leads-atrasados",
        tom: "perigo",
        titulo: `${atrasados.length} ${atrasados.length === 1 ? "lead passou" : "leads passaram"} do prazo de resposta`,
        descricao: "Chegaram e ninguém respondeu a tempo. Quanto mais esperam, mais esfriam.",
        aba: "leads",
        acao: "Ver leads",
      });
    } else if (semResposta.length > 0) {
      itens.push({
        id: "leads-sem-resposta",
        tom: "atencao",
        titulo: `${semResposta.length} ${semResposta.length === 1 ? "lead esperando" : "leads esperando"} resposta`,
        descricao: "Ainda em qualificação ou com o SDR, dentro do prazo.",
        aba: "leads",
        acao: "Ver leads",
      });
    }

    if (aguardandoAprovacao > 0) {
      itens.push({
        id: "postagens-aprovacao",
        tom: "atencao",
        titulo: `${aguardandoAprovacao} ${aguardandoAprovacao === 1 ? "postagem aguardando" : "postagens aguardando"} aprovação`,
        descricao: "O material já está no Drive e falta o gestor aprovar.",
        aba: "postagens",
        acao: "Ver postagens",
      });
    }

    const comAjuste = postagens.filter((p) => p.status === "planejado" && p.feedbackGestor);
    if (comAjuste.length > 0) {
      itens.push({
        id: "postagens-ajuste",
        tom: "atencao",
        titulo: `${comAjuste.length} ${comAjuste.length === 1 ? "postagem com ajuste pedido" : "postagens com ajuste pedido"}`,
        descricao: "O gestor deixou um comentário do que mudar antes de publicar.",
        aba: "postagens",
        acao: "Ver postagens",
      });
    }

    const atrasadas = postagens.filter(
      (p) => p.dataPlanejada < hojeISO && (p.status === "planejado" || p.status === "aprovado"),
    );
    if (atrasadas.length > 0) {
      itens.push({
        id: "postagens-atrasadas",
        tom: "info",
        titulo: `${atrasadas.length} ${atrasadas.length === 1 ? "postagem com data passada" : "postagens com data passada"}`,
        descricao: "Estavam planejadas para dias que já foram e não foram marcadas como publicadas.",
        aba: "postagens",
        acao: "Ver postagens",
      });
    }

    const ativasSemLead = campanhas.filter((c) => c.status === "ativa" && c.leadsGerados === 0);
    if (ativasSemLead.length > 0) {
      itens.push({
        id: "campanhas-sem-lead",
        tom: "info",
        titulo: `${ativasSemLead.length} ${ativasSemLead.length === 1 ? "campanha ativa ainda sem lead" : "campanhas ativas ainda sem lead"}`,
        descricao: "Vale conferir o anúncio, o público ou se o canal está certo.",
        aba: "campanhas",
        acao: "Ver campanhas",
      });
    }

    return itens;
  }, [leads, postagens, campanhas, aguardandoAprovacao]);

  const atividade: ItemAtividade[] = [
    ...leads.slice(0, 8).map((l) => ({
      id: `lead-${l.id}`,
      tipo: "lead" as const,
      titulo: l.nome || l.telefone,
      detalhe: l.resumoIa || `Novo lead via ${l.origem}`,
      quando: new Date(l.createdAt),
    })),
    // A lista vem do banco na ordem da data planejada; aqui interessa a mais nova.
    ...[...postagens]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((p) => ({
      id: `post-${p.id}`,
      tipo: "postagem" as const,
      titulo: p.titulo,
      detalhe: STATUS_POSTAGEM[p.status]?.texto ?? "Planejada",
      quando: new Date(p.createdAt),
    })),
  ]
    .sort((a, b) => b.quando.getTime() - a.quando.getTime())
    .slice(0, 6);

  const valor = (v: React.ReactNode) => (carregando ? "—" : v);

  return (
    <div className="flex flex-col gap-6">
      {/* Números do topo: cada um abre a seção dele */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiAtalho
          rotulo="Leads recebidos"
          valor={valor(leads.length)}
          detalhe={`${ultimos7Dias} nos últimos 7 dias`}
          icone={UserPlus}
          onClick={() => onIrPara("leads")}
        />
        <KpiAtalho
          rotulo="Taxa de resposta"
          valor={valor(`${taxaResposta}%`)}
          detalhe={`${respondidos} de ${leads.length} respondidos`}
          icone={TrendingUp}
          tom={!carregando && leads.length > 0 && taxaResposta < 50 ? "atencao" : "neutro"}
          onClick={() => onIrPara("leads")}
        />
        <KpiAtalho
          rotulo="Campanhas ativas"
          valor={valor(campanhasAtivas)}
          detalhe={`${campanhas.length} cadastradas`}
          icone={Megaphone}
          onClick={() => onIrPara("campanhas")}
        />
        <KpiAtalho
          rotulo="Postagens publicadas"
          valor={valor(publicadas)}
          detalhe={aguardandoAprovacao > 0 ? `${aguardandoAprovacao} aguardando aprovação` : "Nenhuma esperando aprovação"}
          icone={CalendarIcon}
          onClick={() => onIrPara("postagens")}
        />
      </div>

      {/* O que precisa de atenção */}
      {!carregando && (
        <Card>
          <CardHeader
            titulo="O que precisa de atenção"
            descricao={atencao.length > 0 ? "Do mais urgente para o menos urgente." : undefined}
            icone={BellRing}
            acoes={
              atencao.length === 0 ? <span className="aura-selo aura-selo-sucesso">Tudo em dia</span> : undefined
            }
          />
          {atencao.length === 0 && (
            <p className="text-sm text-aura-graphite-soft">
              Nenhum lead fora do prazo, nenhuma postagem esperando aprovação ou ajuste e nenhuma campanha ativa
              parada.
            </p>
          )}
          {atencao.length > 0 && (
            <div className="flex flex-col gap-2">
              {atencao.map((item) => (
                <Alerta
                  key={item.id}
                  tom={item.tom}
                  titulo={item.titulo}
                  descricao={item.descricao}
                  acao={
                    <Botao tamanho="sm" variante="secundario" onClick={() => onIrPara(item.aba)}>
                      {item.acao}
                    </Botao>
                  }
                  className="shadow-none"
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Volume e origem dos leads */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            titulo="Leads nos últimos 14 dias"
            descricao="Quantos chegaram por dia, no horário de Brasília."
            icone={TrendingUp}
            acoes={<span className="text-xs tabular-nums text-aura-graphite-soft">{totalUltimos14Dias} no período</span>}
          />
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGrafico} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--aura-petrol-600)" stopOpacity={0.3} />
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
                <Tooltip
                  cursor={{ stroke: "var(--aura-mist)" }}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "var(--aura-mist)",
                    background: "var(--aura-surface)",
                    color: "var(--aura-graphite)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--aura-graphite-soft)" }}
                  itemStyle={{ color: "var(--aura-graphite)" }}
                />
                <Area
                  type="monotone"
                  dataKey="Leads"
                  stroke="var(--aura-petrol-600)"
                  strokeWidth={2}
                  fill="url(#leadsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            titulo="De onde vêm os leads"
            descricao="Origem de todos os leads recebidos."
            icone={Radio}
          />
          {carregando ? (
            <p className="py-6 text-center text-sm text-aura-graphite-soft">Carregando...</p>
          ) : porOrigem.length === 0 ? (
            <EstadoVazio titulo="Nenhum lead ainda" descricao="Assim que chegar o primeiro, a origem aparece aqui." />
          ) : (
            <ul className="flex flex-col gap-3">
              {porOrigem.map((o) => {
                const pct = leads.length > 0 ? Math.round((o.total / leads.length) * 100) : 0;
                return (
                  <li key={o.origem}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-aura-graphite">{o.origem}</span>
                      <span className="shrink-0 tabular-nums text-aura-graphite-soft">
                        <span className="font-medium text-aura-graphite">{o.total}</span> · {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-aura-sunken">
                      <div
                        className="h-full rounded-full bg-aura-petrol-500"
                        style={{ width: `${Math.max(2, (o.total / maiorOrigem) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Campanhas que mais trouxeram resultado e o que aconteceu por último */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Campanhas que mais trouxeram resultado"
            icone={Trophy}
            corIcone="text-aura-gold-700"
            acoes={
              <Botao tamanho="sm" variante="fantasma" onClick={() => onIrPara("campanhas")}>
                Ver todas
              </Botao>
            }
          />
          {topCampanhas.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma campanha gerou lead ainda"
              descricao="Os leads que chegam pelos seus anúncios do Facebook e do Instagram entram aqui sozinhos."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-aura-mist">
              {topCampanhas.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`w-5 shrink-0 text-center text-xs font-semibold tabular-nums ${
                        i === 0 ? "text-aura-gold-700" : "text-aura-graphite-soft"
                      }`}
                    >
                      {i + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-aura-graphite">{c.nome}</p>
                      <p className="truncate text-xs text-aura-graphite-soft">{c.canal}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-aura-graphite">
                      {c.leadsGerados} {c.leadsGerados === 1 ? "lead" : "leads"}
                    </p>
                    <p className="text-xs text-aura-graphite-soft">
                      {c.vendasFechadas > 0
                        ? `${c.vendasFechadas} fechada${c.vendasFechadas > 1 ? "s" : ""} · ${moedaCurta(c.valorGerado)}`
                        : "nenhuma fechada ainda"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader titulo="Atividade recente" descricao="Leads e postagens mais novos." icone={Clock} />
          {carregando ? (
            <p className="py-6 text-center text-sm text-aura-graphite-soft">Carregando...</p>
          ) : atividade.length === 0 ? (
            <EstadoVazio
              titulo="Nada por aqui ainda"
              descricao="Assim que chegar um lead ou alguém criar uma postagem, aparece aqui."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-aura-mist">
              {atividade.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
                    {item.tipo === "lead" ? (
                      <UserPlus size={14} className="text-aura-petrol-600" />
                    ) : (
                      <CalendarIcon size={14} className="text-aura-gold-700" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-aura-graphite">{item.titulo}</p>
                    <p className="truncate text-xs text-aura-graphite-soft">{item.detalhe}</p>
                  </div>
                  <span className="shrink-0 text-[0.7rem] text-aura-graphite-soft">{tempoRelativo(item.quando)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Atalhos para as outras seções */}
      <div>
        <p className="aura-rotulo mb-3">Ir para</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ATALHOS.map((a) => (
            <button
              key={a.aba}
              type="button"
              onClick={() => onIrPara(a.aba)}
              className="aura-card aura-card-interativo group flex items-center gap-3 p-3.5 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
                <a.icone size={16} className="text-aura-petrol-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-aura-graphite">{a.titulo}</span>
                <span className="block truncate text-xs text-aura-graphite-soft">{a.descricao}</span>
              </span>
              <ArrowRight
                size={14}
                className="hidden shrink-0 text-aura-graphite-soft transition group-hover:translate-x-0.5 group-hover:text-aura-graphite sm:block"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
