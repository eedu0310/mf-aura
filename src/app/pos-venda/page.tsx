"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, AlertTriangle, ClipboardCheck, Clock, Search } from "lucide-react";
import { listarPosVendas, type PosVenda, type StatusPosVenda } from "@/lib/supabase/pos-venda";
import { PosVendaModal } from "@/components/pos-venda/pos-venda-modal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const COLUNAS: { status: StatusPosVenda; titulo: string; cor: string }[] = [
  { status: "aguardando_instalacao", titulo: "Aguardando Instalação", cor: "border-t-aura-graphite-soft" },
  { status: "instalacao_agendada", titulo: "Instalação Agendada", cor: "border-t-aura-petrol-500" },
  { status: "instalacao_realizada", titulo: "Instalação Realizada", cor: "border-t-aura-success" },
  { status: "instalacao_pendente", titulo: "Instalação Pendente", cor: "border-t-aura-warning" },
  { status: "reclamacao", titulo: "Reclamação", cor: "border-t-aura-danger" },
  { status: "concluido", titulo: "Pós-venda Concluído", cor: "border-t-aura-gold" },
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
  if (item.status !== "instalacao_agendada") return false;
  const hojeISO = new Date().toISOString().slice(0, 10);
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

  const totalVendas = itensDaLoja.length;
  const totalReclamacoes = itensDaLoja.filter((i) => i.status === "reclamacao").length;
  const totalAvaliaram = itensDaLoja.filter((i) => i.avaliouLoja).length;
  const notaMedia =
    totalAvaliaram > 0
      ? itensDaLoja.filter((i) => i.notaAvaliacao).reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / totalAvaliaram
      : 0;

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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-16">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Pós-venda</p>
        <p className="text-sm text-aura-graphite-soft">
          Todas as vendas fechadas pelo time, do agendamento da instalação até a avaliação do cliente.
        </p>
      </div>

      {multiLoja && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEmpresaFiltro("todas")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              empresaFiltro === "todas"
                ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
            }`}
          >
            Todas as lojas
          </button>
          {lojas.map((loja) => (
            <button
              key={loja}
              type="button"
              onClick={() => setEmpresaFiltro(loja)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                empresaFiltro === loja
                  ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
              }`}
            >
              {loja}
            </button>
          ))}
        </div>
      )}

      {pendenciasUrgentes.length > 0 && (
        <div className="rounded-2xl border border-aura-danger/30 bg-aura-danger/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
            <AlertTriangle size={15} className="text-aura-danger" />
            {pendenciasUrgentes.length} pendência{pendenciasUrgentes.length > 1 ? "s" : ""} urgente
            {pendenciasUrgentes.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {pendenciasUrgentes.slice(0, 5).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(item)}
                  className="flex w-full items-center justify-between gap-2 text-left text-sm text-aura-graphite hover:underline"
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
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-xs text-aura-graphite-soft">Total de vendas</p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{totalVendas}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <AlertTriangle size={12} className="text-aura-danger" />
            Reclamações
          </div>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{totalReclamacoes}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <ClipboardCheck size={12} />
            Avaliaram a loja
          </div>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">
            {totalAvaliaram} de {totalVendas}
          </p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <Star size={12} className="text-aura-gold" />
            Nota média
          </div>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">
            {notaMedia > 0 ? notaMedia.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full rounded-full border border-aura-mist bg-white py-2 pl-9 pr-4 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft focus:border-aura-petrol-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filtro === f.valor
                  ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : itensFiltrados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-12 text-center text-sm text-aura-graphite-soft">
          Nenhuma venda encontrada com esse filtro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUNAS.map((coluna) => {
            const itensColuna = itensFiltrados.filter((i) => i.status === coluna.status);
            return (
              <div key={coluna.status} className={`flex flex-col gap-2 rounded-2xl border-t-4 ${coluna.cor} bg-aura-bg p-3`}>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-aura-graphite">{coluna.titulo}</p>
                  <span className="text-xs text-aura-graphite-soft">{itensColuna.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {itensColuna.length === 0 ? (
                    <p className="rounded-xl bg-white/60 px-3 py-4 text-center text-xs text-aura-graphite-soft">
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
                          className={`flex flex-col gap-1 rounded-xl border bg-white p-3 text-left hover:border-aura-petrol-500/40 ${
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
                            <span className="w-fit rounded-full bg-aura-petrol-700/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-aura-petrol-700">
                              {item.empresa}
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-data text-xs font-semibold text-aura-graphite">
                              {formatarMoeda(item.valor)}
                            </span>
                            {item.avaliouLoja && item.notaAvaliacao && (
                              <span className="flex items-center gap-0.5 text-[0.65rem] text-aura-gold">
                                <Star size={10} className="fill-aura-gold" />
                                {item.notaAvaliacao}
                              </span>
                            )}
                          </div>
                          {item.dataAgendamento && (
                            <span
                              className={`text-[0.65rem] ${atrasada ? "font-medium text-aura-danger" : "text-aura-graphite-soft"}`}
                            >
                              📅 {item.dataAgendamento.split("-").reverse().join("/")}
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
    </div>
  );
}
