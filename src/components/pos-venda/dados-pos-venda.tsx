"use client";

/**
 * Os dados da área de Pós-venda, carregados UMA vez e divididos entre as
 * seções (Visão geral, Instalações, Reclamações...).
 *
 * Mora no layout: trocar de seção não recarrega nada, os contadores do menu
 * usam os mesmos números da tela, e a sincronização ao vivo (outra pessoa
 * salvou um pós-venda) atualiza todas as seções juntas. O modal do pós-venda
 * também mora aqui, para qualquer seção poder abrir um cliente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { listarManutencoes, type Manutencao } from "@/lib/supabase/pos-venda-manutencao";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PosVendaModal } from "./pos-venda-modal";
import { hojeISO } from "./regras";
import { montarManutencoes, type ItemManutencao } from "./regras-manutencao";

interface DadosPosVenda {
  /** Todos os pós-vendas que a pessoa enxerga. */
  itens: PosVenda[];
  /** Os da loja escolhida no filtro (ou todos). */
  itensDaLoja: PosVenda[];
  carregando: boolean;
  hoje: string;
  lojas: string[];
  multiLoja: boolean;
  /** Mostrar o nome da loja nas linhas (mais de uma loja e sem filtro). */
  mostrarLoja: boolean;
  empresaFiltro: string;
  setEmpresaFiltro: (loja: string) => void;

  manutencoes: {
    carregando: boolean;
    /** A tabela pos_venda_manutencoes existe e foi lida. */
    disponivel: boolean;
    registros: Manutencao[];
    /** Registros + previsão calculada, já na loja do filtro. */
    itens: ItemManutencao[];
  };
  recarregarManutencoes: () => Promise<void>;

  abrir: (item: PosVenda) => void;
}

const Contexto = createContext<DadosPosVenda | null>(null);

export function usePosVenda() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePosVenda precisa estar dentro de <ProvedorPosVenda>");
  return valor;
}

export function ProvedorPosVenda({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<PosVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState("todas");

  const [registros, setRegistros] = useState<Manutencao[]>([]);
  const [manutDisponivel, setManutDisponivel] = useState(false);
  const [manutCarregando, setManutCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const lista = await listarPosVendas();
    if (lista) setItens(lista);
    setCarregando(false);
  }, []);

  const recarregarManutencoes = useCallback(async () => {
    const r = await listarManutencoes();
    setManutDisponivel(r.disponivel);
    setRegistros(r.registros);
    setManutCarregando(false);
  }, []);

  useEffect(() => {
    // Carga inicial: o setState acontece depois do await, fora do efeito.
    void carregar();
    void recarregarManutencoes();
  }, [carregar, recarregarManutencoes]);

  // Sincronização ao vivo. A tabela de manutenções só entra no canal quando
  // existe: pedir mudanças de uma tabela que não existe derruba a inscrição.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let canal = supabase
      .channel("aura-pos-venda-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_vendas" }, () => void carregar());
    if (manutDisponivel) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_venda_manutencoes" },
        () => void recarregarManutencoes()
      );
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, recarregarManutencoes, manutDisponivel]);

  const hoje = hojeISO();
  const lojas = useMemo(() => [...new Set(itens.map((i) => i.empresa))].sort(), [itens]);
  const multiLoja = lojas.length > 1;
  // Se a loja escolhida sumiu da lista (ex.: perdeu acesso), volta para todas.
  const filtroValido = empresaFiltro === "todas" || lojas.includes(empresaFiltro) ? empresaFiltro : "todas";
  const mostrarLoja = multiLoja && filtroValido === "todas";

  const itensDaLoja = useMemo(
    () => (filtroValido === "todas" ? itens : itens.filter((i) => i.empresa === filtroValido)),
    [itens, filtroValido]
  );

  const itensManutencao = useMemo(() => montarManutencoes(itensDaLoja, registros), [itensDaLoja, registros]);

  // O modal guarda só o id: se a lista recarregar enquanto ele está aberto,
  // ele continua mostrando o mesmo cliente.
  const selecionado = selecionadoId ? itens.find((i) => i.id === selecionadoId) ?? null : null;

  const valor: DadosPosVenda = {
    itens,
    itensDaLoja,
    carregando,
    hoje,
    lojas,
    multiLoja,
    mostrarLoja,
    empresaFiltro: filtroValido,
    setEmpresaFiltro,
    manutencoes: {
      carregando: manutCarregando,
      disponivel: manutDisponivel,
      registros,
      itens: itensManutencao,
    },
    recarregarManutencoes,
    abrir: (item) => setSelecionadoId(item.id),
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      {selecionado && (
        <PosVendaModal
          key={selecionado.id}
          posVenda={selecionado}
          onClose={() => setSelecionadoId(null)}
          onAtualizado={(atualizado) => {
            setItens((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)));
          }}
        />
      )}
    </Contexto.Provider>
  );
}
