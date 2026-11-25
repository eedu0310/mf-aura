"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, HeartHandshake, KanbanSquare, List, Search, X } from "lucide-react";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { PosVendaModal } from "@/components/pos-venda/pos-venda-modal";
import { PosVendaKpis } from "@/components/pos-venda/pos-venda-kpis";
import { PosVendaAtencao } from "@/components/pos-venda/pos-venda-atencao";
import { PosVendaQuadro } from "@/components/pos-venda/pos-venda-quadro";
import { PosVendaLista } from "@/components/pos-venda/pos-venda-lista";
import { PosVendaAgenda } from "@/components/pos-venda/pos-venda-agenda";
import { EsqueletoPosVenda } from "@/components/pos-venda/pos-venda-pecas";
import { FILTROS, hojeISO, passaNoFiltro, type Filtro } from "@/components/pos-venda/regras";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Botao, EstadoVazio, PageContainer, PageHeader, Segmentado } from "@/components/ui";

type Visao = "quadro" | "lista" | "agenda";

const VISOES: { valor: Visao; rotulo: string; icone: typeof List }[] = [
  { valor: "quadro", rotulo: "Quadro", icone: KanbanSquare },
  { valor: "lista", rotulo: "Lista", icone: List },
  { valor: "agenda", rotulo: "Agenda", icone: CalendarDays },
];

/** Guarda a visão escolhida neste navegador, para abrir do mesmo jeito amanhã. */
const CHAVE_VISAO = "aura:pos-venda:visao";

/** Só dígitos, para achar o cliente pelo telefone escrito de qualquer jeito. */
function digitos(texto: string) {
  return texto.replace(/\D/g, "");
}

export default function PosVendaPage() {
  const [itens, setItens] = useState<PosVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<PosVenda | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [visao, setVisao] = useState<Visao>("quadro");

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

  // A visão salva só é lida depois de montar: no servidor não há localStorage,
  // e ler antes faria a página do servidor e a do navegador saírem diferentes.
  useEffect(() => {
    try {
      const salva = window.localStorage.getItem(CHAVE_VISAO);
      if (salva === "quadro" || salva === "lista" || salva === "agenda") setVisao(salva);
    } catch {
      // navegador sem armazenamento (aba privada): fica no quadro
    }
  }, []);

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    try {
      window.localStorage.setItem(CHAVE_VISAO, nova);
    } catch {
      // sem armazenamento: só não lembra da escolha
    }
  }

  const hoje = hojeISO();

  const lojas = useMemo(() => [...new Set(itens.map((i) => i.empresa))].sort(), [itens]);
  const multiLoja = lojas.length > 1;
  const mostrarLoja = multiLoja && empresaFiltro === "todas";

  const itensDaLoja = useMemo(
    () => (empresaFiltro === "todas" ? itens : itens.filter((i) => i.empresa === empresaFiltro)),
    [itens, empresaFiltro]
  );

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = digitos(termo);
    return itensDaLoja.filter((i) => {
      if (!passaNoFiltro(i, filtro, hoje)) return false;
      if (!termo) return true;
      return (
        i.cliente.toLowerCase().includes(termo) ||
        i.produto.toLowerCase().includes(termo) ||
        (termoDigitos.length >= 4 && digitos(i.telefone ?? "").includes(termoDigitos))
      );
    });
  }, [itensDaLoja, busca, filtro, hoje]);

  const contagemFiltro = useMemo(() => {
    const mapa = {} as Record<Filtro, number>;
    for (const f of FILTROS) mapa[f.valor] = itensDaLoja.filter((i) => passaNoFiltro(i, f.valor, hoje)).length;
    return mapa;
  }, [itensDaLoja, hoje]);

  const temFiltro = filtro !== "todas" || busca.trim() !== "";

  function limparFiltros() {
    setFiltro("todas");
    setBusca("");
  }

  const propsVisao = { itens: itensFiltrados, hoje, mostrarLoja, aoAbrir: setSelecionado };

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        titulo="Pós-venda"
        icone={HeartHandshake}
        className="mb-0"
        descricao="Da venda fechada à avaliação do cliente: instalação, reclamações e clientes antigos."
        acoes={
          <Segmentado<Visao>
            rotulo="Modo de ver"
            valor={visao}
            aoMudar={trocarVisao}
            opcoes={VISOES.map((v) => ({
              valor: v.valor,
              rotulo: (
                <span className="inline-flex items-center gap-1.5">
                  <v.icone size={14} aria-hidden />
                  {v.rotulo}
                </span>
              ),
            }))}
          />
        }
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

      {carregando ? (
        <EsqueletoPosVenda />
      ) : (
        <>
          <PosVendaKpis itens={itensDaLoja} hoje={hoje} filtro={filtro} aoFiltrar={setFiltro} />

          {itensDaLoja.length > 0 && (
            <PosVendaAtencao itens={itensDaLoja} hoje={hoje} mostrarLoja={mostrarLoja} aoAbrir={setSelecionado} />
          )}

          {/* Barra de busca e filtro, logo acima do que ela filtra */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:w-72">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
                aria-hidden
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente, produto ou telefone"
                aria-label="Buscar no pós-venda"
                className="aura-input pl-9"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Segmentado<Filtro>
                rotulo="Filtrar"
                valor={filtro}
                aoMudar={setFiltro}
                className="min-w-0"
                opcoes={FILTROS.map((f) => ({ valor: f.valor, rotulo: f.rotulo, contagem: contagemFiltro[f.valor] }))}
              />
              {temFiltro && (
                <Botao variante="fantasma" tamanho="sm" icone={X} onClick={limparFiltros} className="shrink-0">
                  Limpar
                </Botao>
              )}
            </div>
          </div>

          {itens.length === 0 ? (
            <EstadoVazio
              icone={HeartHandshake}
              titulo="Nenhuma venda no pós-venda ainda"
              descricao="Quando uma venda é fechada, ela aparece aqui sozinha para agendar a instalação. Clientes antigos marcados no WhatsApp também entram aqui."
            />
          ) : itensFiltrados.length === 0 ? (
            <EstadoVazio
              icone={Search}
              titulo="Nada encontrado com esses filtros"
              descricao="Tente outro nome ou tire o filtro para ver todas as vendas."
              acao={
                <Botao tamanho="sm" icone={X} onClick={limparFiltros}>
                  Limpar filtros
                </Botao>
              }
            />
          ) : visao === "lista" ? (
            <PosVendaLista {...propsVisao} />
          ) : visao === "agenda" ? (
            <PosVendaAgenda {...propsVisao} />
          ) : (
            <PosVendaQuadro {...propsVisao} />
          )}
        </>
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
