"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, HeartHandshake, KanbanSquare, List, Search, X } from "lucide-react";
import { Botao, EstadoVazio, Segmentado } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { PosVendaKpis } from "./pos-venda-kpis";
import { PosVendaQuadro } from "./pos-venda-quadro";
import { PosVendaLista } from "./pos-venda-lista";
import { PosVendaAgenda } from "./pos-venda-agenda";
import { EsqueletoPosVenda } from "./pos-venda-pecas";
import { FILTROS, passaNoFiltro, type Filtro } from "./regras";

type Visao = "quadro" | "lista" | "agenda";

const VISOES: { valor: Visao; rotulo: string; icone: typeof List }[] = [
  { valor: "quadro", rotulo: "Quadro", icone: KanbanSquare },
  { valor: "lista", rotulo: "Lista", icone: List },
  { valor: "agenda", rotulo: "Agenda", icone: CalendarDays },
];

/** Guarda a visão escolhida neste navegador, para abrir do mesmo jeito amanhã. */
const CHAVE_VISAO = "aura:pos-venda:visao";

function ehVisao(v: string | null): v is Visao {
  return v === "quadro" || v === "lista" || v === "agenda";
}

function ehFiltro(v: string | null): v is Filtro {
  return FILTROS.some((f) => f.valor === v);
}

/** Só dígitos, para achar o cliente pelo telefone escrito de qualquer jeito. */
function digitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/**
 * Instalações: o que era a tela inteira do pós-venda — números, busca,
 * filtros e as três visões (Quadro, Lista, Agenda). A Visão geral manda para
 * cá já filtrado (?filtro=atrasadas) ou numa visão (?visao=agenda).
 */
export function SecaoInstalacoes() {
  const params = useSearchParams();
  const { itens, itensDaLoja, carregando, hoje, mostrarLoja, abrir } = usePosVenda();

  const filtroUrl = params.get("filtro");
  const visaoUrl = params.get("visao");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(ehFiltro(filtroUrl) ? filtroUrl : "todas");
  const [visao, setVisao] = useState<Visao>(ehVisao(visaoUrl) ? visaoUrl : "quadro");

  // A visão salva só é lida depois de montar: no servidor não há localStorage,
  // e ler antes faria a página do servidor e a do navegador saírem diferentes.
  // Se o link já pediu uma visão (?visao=), ela vale mais que a salva.
  useEffect(() => {
    if (ehVisao(visaoUrl)) return;
    try {
      const salva = window.localStorage.getItem(CHAVE_VISAO);
      if (ehVisao(salva)) setVisao(salva);
    } catch {
      // navegador sem armazenamento (aba privada): fica no quadro
    }
  }, [visaoUrl]);

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    try {
      window.localStorage.setItem(CHAVE_VISAO, nova);
    } catch {
      // sem armazenamento: só não lembra da escolha
    }
  }

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

  if (carregando) return <EsqueletoPosVenda />;

  const propsVisao = { itens: itensFiltrados, hoje, mostrarLoja, aoAbrir: abrir };

  return (
    <div className="flex flex-col gap-5">
      <PosVendaKpis itens={itensDaLoja} hoje={hoje} filtro={filtro} aoFiltrar={setFiltro} />

      {/* Barra de busca, filtro e modo de ver, logo acima do que eles mexem */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
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
              aria-label="Buscar nas instalações"
              className="aura-input pl-9"
            />
          </div>
          <Segmentado<Visao>
            rotulo="Modo de ver"
            valor={visao}
            aoMudar={trocarVisao}
            className="self-start"
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
    </div>
  );
}
