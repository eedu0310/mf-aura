"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, AlertTriangle, ClipboardCheck, Clock, Search, HeartHandshake, CalendarDays } from "lucide-react";
import { listarPosVendas, type PosVenda, type StatusPosVenda } from "@/lib/supabase/pos-venda";
import { PosVendaModal } from "@/components/pos-venda/pos-venda-modal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EstadoVazio, PageContainer, PageHeader, Segmentado, StatCard } from "@/components/ui";

/**
 * As colunas do quadro, no vocabulário que o banco aceita.
 *
 * Três destas colunas tinham nome que a tabela pos_vendas recusa no CHECK
 * ("instalacao_agendada", "instalacao_realizada", "concluido"): arrastar um
 * card para elas dava erro no banco, e o alerta de instalação atrasada nunca
 * disparava. Ver a explicação inteira em src/lib/supabase/pos-venda.ts.
 */
const COLUNAS: { status: StatusPosVenda; titulo: string; cor: string }[] = [
  { status: "aguardando_instalacao", titulo: "Aguardando Instalação", cor: "bg-aura-graphite-soft" },
  { status: "agendamento_realizado", titulo: "Instalação Agendada", cor: "bg-aura-petrol-500" },
  { status: "instalacao_pendente", titulo: "Instalação Pendente", cor: "bg-aura-warning" },
  { status: "reclamacao", titulo: "Reclamação", cor: "bg-aura-danger" },
  { status: "pos_venda_realizado", titulo: "Pós-venda Concluído", cor: "bg-aura-success" },
  // Quem comprou antes do CRM e o vendedor marcou como cliente antigo no
  // WhatsApp. Daqui ele vai para Reclamação ou Concluído como qualquer outro.
  { status: "cliente_antigo", titulo: "Clientes antigos", cor: "bg-aura-gold" },
];

type Filtro = "todas" | "atrasadas" | "reclamacoes" | "sem_avaliacao";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "atrasadas", label: "Atrasadas" },
  { valor: "reclamacoes", label: "Reclamações abertas" },
  { valor: "sem_avaliacao", label: "Sem avaliação" },
];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function estaAtrasada(item: PosVenda) {
  if (!item.dataAgendamento) return false;
  if (item.status !== "agendamento_realizado") return false;
  // "Hoje" no fuso de quem olha. O toISOString() é UTC: depois das 21h no
  // Brasil já era amanhã, e a instalação marcada para hoje aparecia atrasada.
  const agora = new Date();
  const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  return item.dataAgendamento < hojeISO;
}

function temReclamacaoAberta(item: PosVenda) {
  return Boolean(item.reclamacao?.trim()) && !item.reclamacaoResolvida;
}

export default function PosVendaPage() {
  const [itens, setItens] = useState<PosVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<PosVenda | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");

  async function carregar() {
    const lista = await listarPosVendas();
    if (lista) setItens(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  // Sincronização ao vivo
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-pos-venda-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_vendas" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
     
  }, []);

  const lojas = useMemo(() => [...new Set(itens.map((i) => i.empresa))], [itens]);
  const multiLoja = lojas.length > 1;

  const itensDaLoja = useMemo(
    () => (empresaFiltro === "todas" ? itens : itens.filter((i) => i.empresa === empresaFiltro)),
    [itens, empresaFiltro]
  );

  // Cliente antigo não é venda: fica fora do total de vendas e da taxa de avaliação.
  const totalVendas = itensDaLoja.filter((i) => i.origem !== "cliente_antigo").length;
  const totalReclamacoes = itensDaLoja.filter((i) => i.status === "reclamacao").length;
  const totalAvaliaram = itensDaLoja.filter((i) => i.avaliouLoja && i.origem !== "cliente_antigo").length;
  // Soma e divisor do mesmo grupo: antes somava as notas de todos (cliente
  // antigo e quem tinha nota sem "avaliou") e dividia só por quem avaliou,
  // então a média podia passar de 5 ou cair sem motivo.
  const comNota = itensDaLoja.filter((i) => i.notaAvaliacao && i.origem !== "cliente_antigo");
  const notaMedia =
    comNota.length > 0 ? comNota.reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / comNota.length : 0;

  const atrasadas = itensDaLoja.filter(estaAtrasada);
  const reclamacoesAbertas = itensDaLoja.filter(temReclamacaoAberta);
  const pendenciasUrgentes = [...atrasadas, ...reclamacoesAbertas.filter((i) => !atrasadas.includes(i))];

  const itensFiltrados = useMemo(() => {
    let resultado = itensDaLoja;
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      resultado = resultado.filter((i) => i.cliente.toLowerCase().includes(termo));
    }
    if (filtro === "atrasadas") resultado = resultado.filter(estaAtrasada);
    if (filtro === "reclamacoes") resultado = resultado.filter(temReclamacaoAberta);
    if (filtro === "sem_avaliacao") resultado = resultado.filter((i) => !i.avaliouLoja);
    return resultado;
  }, [itensDaLoja, busca, filtro]);

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        titulo="Pós-venda"
        icone={HeartHandshake}
        className="mb-0"
        descricao="Todas as vendas fechadas pelo time, do agendamento da instalação até a avaliação do cliente, e os clientes antigos marcados no WhatsApp."
      />

      {multiLoja && (
        <Segmentado
          rotulo="Loja"
          valor={empresaFiltro}
          aoMudar={setEmpresaFiltro}
          className="self-start"
          opcoes={[
            { valor: "todas", rotulo: "Todas as lojas" },
            ...lojas.map((loja) => ({ valor: loja, rotulo: loja })),
          ]}
        />
      )}

      {pendenciasUrgentes.length > 0 && (
        <div className="aura-card flex items-start gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-danger/10">
            <AlertTriangle size={16} className="text-aura-danger" />
          </span>
          <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-aura-graphite">
            {pendenciasUrgentes.length} pendência{pendenciasUrgentes.length > 1 ? "s" : ""} urgente
            {pendenciasUrgentes.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-aura-mist">
            {pendenciasUrgentes.slice(0, 5).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(item)}
                  className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm text-aura-graphite hover:text-aura-petrol-600"
                >
                  <span className="truncate">{item.cliente}</span>
                  <span className="shrink-0 text-xs text-aura-danger">
                    {estaAtrasada(item) ? "Instalação atrasada" : "Reclamação em aberto"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard rotulo="Total de vendas" valor={totalVendas} />
        <StatCard rotulo="Reclamações" valor={totalReclamacoes} icone={AlertTriangle} tom={totalReclamacoes > 0 ? "perigo" : "neutro"} />
        <StatCard rotulo="Avaliaram a loja" valor={`${totalAvaliaram} de ${totalVendas}`} icone={ClipboardCheck} />
        <StatCard rotulo="Nota média" valor={notaMedia > 0 ? notaMedia.toFixed(1) : "—"} icone={Star} tom="ouro" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente..."
            className="aura-input pl-9"
          />
        </div>
        <Segmentado<Filtro>
          rotulo="Filtrar vendas"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={FILTROS.map((f) => ({ valor: f.valor, rotulo: f.label }))}
        />
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : itensFiltrados.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Nenhuma venda encontrada com esse filtro." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUNAS.map((coluna) => {
            const itensColuna = itensFiltrados.filter((i) => i.status === coluna.status);
            return (
              <div key={coluna.status} className="flex flex-col gap-2 rounded-xl border border-aura-mist bg-aura-sunken/50 p-2.5">
                <div className="flex items-center justify-between gap-2 px-1 py-0.5">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-aura-graphite">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${coluna.cor}`} />
                    <span className="truncate">{coluna.titulo}</span>
                  </p>
                  <span className="rounded-md bg-aura-surface px-1.5 py-0.5 text-xs tabular-nums text-aura-graphite-soft">{itensColuna.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {itensColuna.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-aura-mist px-3 py-4 text-center text-xs text-aura-graphite-soft">
                      Nenhuma venda aqui
                    </p>
                  ) : (
                    itensColuna.map((item) => {
                      const atrasada = estaAtrasada(item);
                      const reclamacaoAberta = temReclamacaoAberta(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelecionado(item)}
                          className={`flex flex-col gap-1 rounded-lg border bg-aura-surface p-3 text-left shadow-sm transition hover:border-aura-petrol-500/40 ${
                            atrasada || reclamacaoAberta ? "border-aura-danger/50" : "border-aura-mist"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {(atrasada || reclamacaoAberta) && (
                              <Clock size={11} className="shrink-0 text-aura-danger" />
                            )}
                            <p className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</p>
                          </div>
                          <p className="truncate text-xs text-aura-graphite-soft">{item.produto}</p>
                          {multiLoja && empresaFiltro === "todas" && (
                            <span className="aura-selo aura-selo-neutro w-fit">
                              {item.empresa}
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            {item.origem === "cliente_antigo" ? (
                              <span className="aura-selo aura-selo-ouro">
                                Cliente antigo
                              </span>
                            ) : (
                              <span className="text-xs font-semibold tabular-nums text-aura-graphite">
                                {formatarMoeda(item.valor)}
                              </span>
                            )}
                            {item.avaliouLoja && item.notaAvaliacao && (
                              <span className="flex items-center gap-0.5 text-[0.65rem] font-medium text-aura-gold-700">
                                <Star size={10} className="fill-aura-gold" />
                                {item.notaAvaliacao}
                              </span>
                            )}
                          </div>
                          {item.dataAgendamento && (
                            <span
                              className={`flex items-center gap-1 text-[0.65rem] ${atrasada ? "font-medium text-aura-danger" : "text-aura-graphite-soft"}`}
                            >
                              <CalendarDays size={11} className="shrink-0" />
                              {item.dataAgendamento.split("-").reverse().join("/")}
                              {item.horaAgendamento ? ` ${item.horaAgendamento}` : ""}
                              {atrasada ? " · atrasada" : ""}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selecionado && (
        <PosVendaModal
          posVenda={selecionado}
          onClose={() => setSelecionado(null)}
          onAtualizado={(atualizado) => {
            setItens((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)));
          }}
        />
      )}
    </PageContainer>
  );
}
