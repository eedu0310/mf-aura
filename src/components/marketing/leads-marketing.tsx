"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, Search, UserPlus, X } from "lucide-react";
import { listarLeads, type Lead, type StatusLead } from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { STATUS_LEAD, diaHora, leadSemResposta } from "@/components/marketing/rotulos";
import { Botao, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";

type FiltroSituacao = "todos" | "sem-resposta" | StatusLead;
type FiltroPeriodo = "todos" | "7" | "30";

/** Quantas linhas a tabela mostra de cada vez: lista de milhares trava o celular. */
const POR_PAGINA = 50;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function LeadsMarketing() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todos");
  const [origem, setOrigem] = useState("todas");
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("todos");
  const [limite, setLimite] = useState(POR_PAGINA);

  async function carregar() {
    const lista = await listarLeads();
    if (lista) setLeads(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-marketing-leads-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const origens = useMemo(
    () => [...new Set(leads.map((l) => l.origem?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [leads],
  );

  // Busca, origem e período primeiro; a situação por último, para o trilho
  // mostrar quantos de cada situação existem dentro dos outros filtros.
  const filtradosSemSituacao = useMemo(() => {
    const termo = normalizar(busca.trim());
    const desde = periodo === "todos" ? 0 : Date.now() - Number(periodo) * 24 * 60 * 60 * 1000;
    return leads.filter((l) => {
      if (origem !== "todas" && l.origem?.trim() !== origem) return false;
      if (desde && new Date(l.createdAt).getTime() < desde) return false;
      if (!termo) return true;
      return normalizar(`${l.nome ?? ""} ${l.telefone} ${l.origem} ${l.resumoIa ?? ""}`).includes(termo);
    });
  }, [leads, busca, origem, periodo]);

  const filtrados = useMemo(() => {
    if (situacao === "todos") return filtradosSemSituacao;
    if (situacao === "sem-resposta") return filtradosSemSituacao.filter((l) => leadSemResposta(l.status));
    return filtradosSemSituacao.filter((l) => l.status === situacao);
  }, [filtradosSemSituacao, situacao]);

  const contar = (fn: (l: Lead) => boolean) => filtradosSemSituacao.filter(fn).length;

  const respondidos = leads.filter((l) => l.status === "respondido").length;
  const taxaResposta = leads.length > 0 ? Math.round((respondidos / leads.length) * 100) : 0;
  const semResposta = leads.filter((l) => leadSemResposta(l.status)).length;
  const comVendedor = leads.filter((l) => l.status === "repassado_vendedor").length;

  const temFiltro = busca.trim() !== "" || situacao !== "todos" || origem !== "todas" || periodo !== "todos";

  function limparFiltros() {
    setBusca("");
    setSituacao("todos");
    setOrigem("todas");
    setPeriodo("todos");
    setLimite(POR_PAGINA);
  }

  if (carregando) {
    return (
      <div className="aura-card flex justify-center py-12 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const visiveis = filtrados.slice(0, limite);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Total de leads" valor={leads.length} />
        <StatCard rotulo="Sem resposta" valor={semResposta} tom={semResposta > 0 ? "atencao" : "neutro"} />
        <StatCard rotulo="Com o vendedor" valor={comVendedor} tom="marca" />
        <StatCard rotulo="Taxa de resposta" valor={`${taxaResposta}%`} tom="sucesso" />
      </div>

      <div className="aura-card overflow-hidden">
        {/* Barra de ferramentas: busca e filtros num lugar só */}
        <div className="flex flex-col gap-3 border-b border-aura-mist p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar lead</span>
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setLimite(POR_PAGINA);
                }}
                placeholder="Buscar por nome, telefone ou resumo"
                className="aura-input pl-9"
              />
            </label>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="sr-only">Origem</span>
                <select
                  value={origem}
                  onChange={(e) => {
                    setOrigem(e.target.value);
                    setLimite(POR_PAGINA);
                  }}
                  className="aura-input w-full sm:w-44"
                >
                  <option value="todas">Todas as origens</option>
                  {origens.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="sr-only">Período</span>
                <select
                  value={periodo}
                  onChange={(e) => {
                    setPeriodo(e.target.value as FiltroPeriodo);
                    setLimite(POR_PAGINA);
                  }}
                  className="aura-input w-full sm:w-40"
                >
                  <option value="todos">Desde o início</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmentado
              rotulo="Situação do lead"
              valor={situacao}
              aoMudar={(v) => {
                setSituacao(v);
                setLimite(POR_PAGINA);
              }}
              opcoes={[
                { valor: "todos", rotulo: "Todos", contagem: filtradosSemSituacao.length },
                { valor: "sem-resposta", rotulo: "Sem resposta", contagem: contar((l) => leadSemResposta(l.status)) },
                { valor: "repassado_vendedor", rotulo: "Com o vendedor", contagem: contar((l) => l.status === "repassado_vendedor") },
                { valor: "respondido", rotulo: "Respondidos", contagem: contar((l) => l.status === "respondido") },
                { valor: "lead_frio", rotulo: "Frios", contagem: contar((l) => l.status === "lead_frio") },
                { valor: "perdido", rotulo: "Perdidos", contagem: contar((l) => l.status === "perdido") },
              ]}
            />
            {temFiltro && (
              <Botao tamanho="sm" variante="fantasma" icone={X} onClick={limparFiltros}>
                Limpar filtros
              </Botao>
            )}
          </div>
        </div>

        {leads.length === 0 ? (
          <EstadoVazio
            icone={UserPlus}
            titulo="Nenhum lead recebido ainda"
            descricao="Os contatos que chegam pelos anúncios, pelo site e pelo WhatsApp aparecem aqui."
            className="m-4"
          />
        ) : filtrados.length === 0 ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum lead com esses filtros"
            acao={
              <Botao tamanho="sm" onClick={limparFiltros}>
                Limpar filtros
              </Botao>
            }
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="aura-tabela">
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Origem</th>
                    <th>Situação</th>
                    <th className="hidden md:table-cell">Resumo</th>
                    <th className="whitespace-nowrap text-right">Chegou em</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => {
                    const status = STATUS_LEAD[l.status];
                    return (
                      <tr key={l.id}>
                        <td>
                          <p className="font-medium text-aura-graphite">{l.nome || "Contato novo"}</p>
                          <p className="flex items-center gap-1 whitespace-nowrap text-xs text-aura-graphite-soft">
                            <Phone size={11} aria-hidden />
                            {l.telefone}
                          </p>
                        </td>
                        <td className="text-aura-graphite-soft">{l.origem || "—"}</td>
                        <td>
                          <Selo tom={status?.tom ?? "neutro"} className="whitespace-nowrap">
                            {status?.texto ?? l.status}
                          </Selo>
                        </td>
                        <td className="hidden max-w-xs md:table-cell">
                          {l.resumoIa ? (
                            <p className="line-clamp-2 text-xs text-aura-graphite-soft" title={l.resumoIa}>
                              {l.resumoIa}
                            </p>
                          ) : (
                            <span className="text-xs text-aura-graphite-soft">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right text-xs tabular-nums text-aura-graphite-soft">
                          {diaHora(l.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-aura-graphite-soft">
              <span className="tabular-nums">
                Mostrando {visiveis.length} de {filtrados.length}
              </span>
              {filtrados.length > visiveis.length && (
                <Botao tamanho="sm" onClick={() => setLimite((n) => n + POR_PAGINA)}>
                  Mostrar mais
                </Botao>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
