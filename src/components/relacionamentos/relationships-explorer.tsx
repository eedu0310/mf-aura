"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Edit2, Trash2, Phone, Mail, MapPin, Users } from "lucide-react";
import { Alerta, Botao, EstadoVazio, PageContainer, PageHeader, Segmentado, Selo, type Tom } from "@/components/ui";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { SeloOrigem } from "@/components/origem/selo-origem";
import { RelacionamentoDetailsModal } from "./relacionamento-details-modal";
import { NewRelationshipModal } from "./new-relationship-modal";
import type { Relacionamento } from "@/lib/types";
import {
  TEXTO_FILTRO_ATENCAO,
  lerFiltroAtencao,
  passaNoFiltroAtencao,
  type FiltroAtencao,
} from "@/lib/relacionamento-atencao";

export function RelationshipsExplorer() {
  const { relacionamentos, deleteRelacionamento, nomesPorOwnerId } = useAppData();
  const { profile } = useUserProfile();
  // O vendedor só tem a própria carteira, então para ele estes filtros não
  // significam nada. Quem precisa separar é quem vê mais de uma carteira.
  const vejoMaisDeUmaCarteira = profile.cargo === "Gestor";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelacionamento, setSelectedRelacionamento] = useState<Relacionamento | null>(null);

  async function excluirRelacionamento(id: string, nome: string) {
    if (!window.confirm(`Excluir o relacionamento de ${nome}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteRelacionamento(id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível excluir o relacionamento.");
    }
  }
  const [filtroTemperatura, setFiltroTemperatura] = useState<string>("todos");
  const [filtroLoja, setFiltroLoja] = useState<string>("todos");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [showNovaModal, setShowNovaModal] = useState(false);
  /**
   * Recorte que vem do Meu Dia (cartões e recados "follow-ups vencidos" e
   * "esfriando"). Antes o botão levava à carteira inteira e a vendedora não
   * achava quem estava atrasado: parecia que não tinha aberto nada.
   */
  const [filtroAtencao, setFiltroAtencao] = useState<FiltroAtencao | null>(null);

  /**
   * Abre direto no cliente quando alguém chega por um link de outra tela.
   *
   * As flechas do briefing, das atividades recentes e dos recados da AURA
   * sempre mandaram `?id=` ou `?buscar=`, mas esta tela ignorava os dois e
   * abria a lista inteira — parecia que o botão não fazia nada.
   */
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("id");
    const buscar = searchParams.get("buscar");
    setFiltroAtencao(lerFiltroAtencao(searchParams.get("filtro")));

    if (id) {
      const achado = (relacionamentos ?? []).find((r) => r.id === id);
      if (achado) {
        setSelectedRelacionamento(achado);
        return;
      }
    }
    if (buscar) setSearchQuery(buscar);
  }, [searchParams, relacionamentos]);

  const relacionamentosFiltrados = useMemo(() => {
    let resultado = relacionamentos;

    if (filtroAtencao) {
      const agora = Date.now();
      resultado = resultado.filter((r) => passaNoFiltroAtencao(r, filtroAtencao, agora));
    }

    // Filtro de busca
    if (searchQuery.trim()) {
      const termo = searchQuery.toLowerCase();
      resultado = resultado.filter(
        (r) =>
          r.nome.toLowerCase().includes(termo) ||
          r.categoria.toLowerCase().includes(termo) ||
          r.telefone?.toLowerCase().includes(termo) ||
          r.email?.toLowerCase().includes(termo) ||
          r.cidade?.toLowerCase().includes(termo)
      );
    }

    // Filtro de temperatura
    if (filtroTemperatura !== "todos") {
      resultado = resultado.filter((r) => r.temperatura === filtroTemperatura);
    }

    // Loja e vendedor: o gestor vê a carteira das quatro lojas de uma vez, e
    // sem isto não dava para saber de quem era cada contato — vinha tudo junto.
    if (filtroLoja !== "todos") {
      resultado = resultado.filter((r) => r.empresa === filtroLoja);
    }
    if (filtroVendedor !== "todos") {
      resultado = resultado.filter(
        (r) => (r.ownerId ?? r.vendedorId) === filtroVendedor,
      );
    }

    return resultado;
  }, [relacionamentos, searchQuery, filtroTemperatura, filtroLoja, filtroVendedor, filtroAtencao]);

  /** Lojas e vendedores que realmente aparecem na carteira carregada. */
  const lojas = useMemo(
    () =>
      [...new Set(relacionamentos.map((r) => r.empresa).filter(Boolean))].sort() as string[],
    [relacionamentos],
  );

  /** Só os vendedores da loja escolhida, para a lista não virar um paiol. */
  const vendedores = useMemo(() => {
    const ids = new Set(
      relacionamentos
        .filter((r) => filtroLoja === "todos" || r.empresa === filtroLoja)
        .map((r) => r.ownerId ?? r.vendedorId)
        .filter(Boolean) as string[],
    );
    return [...ids]
      .map((id) => ({ id, nome: nomesPorOwnerId[id] ?? "Sem nome" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [relacionamentos, filtroLoja, nomesPorOwnerId]);

  /** Temperatura vira um selo pequeno; o cartão fica neutro. */
  const tomTemperatura: Record<string, Tom> = {
    quente: "perigo",
    ativo: "sucesso",
    esfriando: "atencao",
    frio: "neutro",
  };
  const pontoTemperatura: Record<string, string> = {
    quente: "bg-aura-danger",
    ativo: "bg-aura-success",
    esfriando: "bg-aura-warning",
    frio: "bg-aura-graphite-soft/50",
  };

  return (
    <PageContainer>
      <PageHeader
        titulo="Relacionamentos"
        descricao="Gerencie seus relacionamentos com clientes, parceiros e prospects."
        icone={Users}
        acoes={
          <Botao
            variante="primario"
            icone={Plus}
            onClick={() => setShowNovaModal(true)}
            className="hidden sm:inline-flex"
          >
            Adicionar novo relacionamento
          </Botao>
        }
      />

      <div className="space-y-6">
        <AuraInsightCard pagina="relacionamentos" />

        {/* Filtros e Busca */}
        <div className="space-y-3">
          {/* Barra de Busca */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, categoria, telefone, email ou cidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="aura-input pl-9"
            />
          </div>

          {filtroAtencao && (
            <Alerta
              tom="atencao"
              titulo={
                <>
                  Mostrando: <strong className="font-semibold">{TEXTO_FILTRO_ATENCAO[filtroAtencao]}</strong> ({relacionamentosFiltrados.length})
                </>
              }
              acao={
                <Botao
                  tamanho="sm"
                  onClick={() => {
                    setFiltroAtencao(null);
                    window.history.replaceState(null, "", "/relacionamentos");
                  }}
                >
                  Ver todos os clientes
                </Botao>
              }
            />
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <Segmentado
              rotulo="Temperatura"
              valor={filtroTemperatura}
              aoMudar={setFiltroTemperatura}
              opcoes={[
                { valor: "todos", rotulo: "Todos" },
                ...["quente", "ativo", "esfriando", "frio"].map((temp) => ({
                  valor: temp,
                  rotulo: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${pontoTemperatura[temp]}`} />
                      {temp.charAt(0).toUpperCase() + temp.slice(1)}
                    </span>
                  ),
                })),
              ]}
            />

            {/* Loja e vendedor — só para quem vê mais de uma carteira. */}
            {vejoMaisDeUmaCarteira && (
              <>
                <label className="flex items-center gap-2 text-sm text-aura-graphite-soft">
                  Loja
                  <select
                    value={filtroLoja}
                    onChange={(e) => {
                      setFiltroLoja(e.target.value);
                      // Trocar de loja invalida o vendedor escolhido: ele pode
                      // nem trabalhar na loja nova, e o filtro ficaria vazio.
                      setFiltroVendedor("todos");
                    }}
                    className="aura-input w-auto"
                  >
                    <option value="todos">Todas ({relacionamentos.length})</option>
                    {lojas.map((loja) => (
                      <option key={loja} value={loja}>
                        {loja}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-aura-graphite-soft">
                  Vendedor
                  <select
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    className="aura-input w-auto"
                  >
                    <option value="todos">Todos</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="text-sm tabular-nums text-aura-graphite-soft">
                  {relacionamentosFiltrados.length}{" "}
                  {relacionamentosFiltrados.length === 1 ? "contato" : "contatos"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Lista de Relacionamentos */}
        {relacionamentosFiltrados.length === 0 ? (
          <EstadoVazio
            icone={Users}
            titulo={searchQuery ? "Nenhum relacionamento encontrado." : "Nenhum relacionamento criado."}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relacionamentosFiltrados.map((rel) => (
              <div key={rel.id} className="aura-card aura-card-interativo flex flex-col p-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  {/* min-w-0 + nome em até 2 linhas: sem isso um nome comprido
                      empurrava a etiqueta de temperatura e partia o selo de
                      origem ("Marketing") ao meio nas telas mais estreitas. */}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRelacionamento(rel)}
                      className="line-clamp-2 break-words text-left text-sm font-semibold text-aura-graphite transition hover:text-aura-petrol-600"
                    >
                      {rel.nome}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                      <p className="text-xs text-aura-graphite-soft">{rel.categoria}</p>
                      {/* O ícone da origem: o vendedor bate o olho e sabe se o
                          card veio da loja, da MF ou de campanha. */}
                      <SeloOrigem origem={rel.origemLead} tamanho={11} />
                    </div>
                    {/* De quem é o contato. Sem isto o gestor via a carteira das
                        quatro lojas num bolo só, sem saber de quem era cada um. */}
                    {vejoMaisDeUmaCarteira && (
                      <p className="mt-1 text-xs text-aura-petrol-600">
                        {nomesPorOwnerId[rel.ownerId ?? rel.vendedorId] ?? "Sem vendedor"}
                        {rel.empresa ? ` · ${rel.empresa}` : ""}
                      </p>
                    )}
                  </div>
                  <Selo tom={tomTemperatura[rel.temperatura] ?? "neutro"} className="shrink-0">
                    <span className={`h-1.5 w-1.5 rounded-full ${pontoTemperatura[rel.temperatura] ?? ""}`} />
                    {rel.temperatura}
                  </Selo>
                </div>

                {/* Contatos */}
                <div className="mt-3 space-y-1.5">
                  {rel.telefone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone size={13} className="shrink-0 text-aura-graphite-soft" />
                      <span className="text-aura-graphite">{rel.telefone}</span>
                    </div>
                  )}
                  {rel.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail size={13} className="shrink-0 text-aura-graphite-soft" />
                      <span className="truncate text-aura-graphite">{rel.email}</span>
                    </div>
                  )}
                  {rel.cidade && (
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin size={13} className="shrink-0 text-aura-graphite-soft" />
                      <span className="text-aura-graphite">{rel.cidade}</span>
                    </div>
                  )}
                </div>

                {/* Datas de Contato */}
                <div className="mt-auto pt-3">
                  <div className="space-y-1 border-t border-aura-mist pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-aura-graphite-soft">Último contato:</span>
                      <span className="font-medium tabular-nums text-aura-graphite">
                        {rel.ultimoContato || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-aura-graphite-soft">Próximo contato:</span>
                      <span className="font-medium tabular-nums text-aura-graphite">
                        {rel.proximoContato}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="mt-3 flex gap-2">
                    <Botao
                      tamanho="sm"
                      icone={Edit2}
                      onClick={() => setSelectedRelacionamento(rel)}
                      className="flex-1"
                    >
                      {vejoMaisDeUmaCarteira ? "Abrir ficha" : "Editar"}
                    </Botao>
                    <Botao
                      tamanho="sm"
                      variante="perigo-suave"
                      onClick={() => excluirRelacionamento(rel.id, rel.nome)}
                      aria-label={`Excluir ${rel.nome}`}
                    >
                      <Trash2 size={13} />
                    </Botao>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botão flutuante para adicionar. No celular fica acima do botão de
          registrar atividade — antes ele era escondido e não havia nenhum
          outro caminho para cadastrar um cliente pelo telefone. No
          computador o mesmo botão fica no cabeçalho. */}
      <button
        onClick={() => setShowNovaModal(true)}
        className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-aura-petrol-600 text-white shadow-lg transition hover:bg-aura-petrol-700 sm:hidden"
        title="Adicionar novo relacionamento"
        aria-label="Adicionar novo relacionamento"
      >
        <Plus size={22} />
      </button>

      {/* Modal de Novo Relacionamento */}
      {showNovaModal && (
        <NewRelationshipModal
          onClose={() => setShowNovaModal(false)}
          onCriado={() => {
            setShowNovaModal(false);
          }}
        />
      )}

      {/* Modal de Detalhes */}
      {selectedRelacionamento && (
        <RelacionamentoDetailsModal
          relacionamento={selectedRelacionamento}
          onClose={() => setSelectedRelacionamento(null)}
          onDelete={() => setSelectedRelacionamento(null)}
        />
      )}
    </PageContainer>
  );
}
