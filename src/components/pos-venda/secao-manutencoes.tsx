"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CalendarRange, CheckCircle2, Flame, Plus, Search, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Botao, CardHeader, EstadoVazio, Selo, StatCard } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { EsqueletoSecao } from "./pos-venda-pecas";
import {
  AvisoSemTabela,
  BotaoWhatsAppLimpeza,
  LinhaManutencao,
  MOTIVO_SEM_TABELA,
  NovaManutencao,
  ProgramarLimpeza,
} from "./pos-venda-manutencao-pecas";
import {
  GRUPOS_MANUTENCAO,
  baseDaInstalacao,
  dataDaManutencao,
  estaAberta,
  grupoDaManutencao,
  instalacaoConcluida,
  type GrupoManutencao,
  type ItemManutencao,
} from "./regras-manutencao";
import { diaDoMomento, diasEntre, formatarDia, haQuantoTempo } from "./regras";

const ICONE_GRUPO: Record<GrupoManutencao, { icone: LucideIcon; cor: string }> = {
  vencidas: { icone: CalendarClock, cor: "text-aura-danger" },
  este_mes: { icone: Flame, cor: "text-aura-gold-700" },
  proximos_90: { icone: CalendarRange, cor: "text-aura-petrol-600" },
  mais_adiante: { icone: CalendarDays, cor: "text-aura-graphite-soft" },
  realizadas: { icone: CheckCircle2, cor: "text-aura-success" },
};

/** Grupos que começam com poucas linhas (o resto num "ver todas"). */
const LIMITE_RECOLHIDO = 8;

function digitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/**
 * Manutenções: a limpeza anual da chaminé (e a revisão), um ano depois da
 * instalação. É o pós-venda "mais adiante": a loja volta a chamar o cliente,
 * cuida da segurança da lareira e vende o serviço.
 *
 * Com a tabela pos_venda_manutencoes no banco, tudo funciona (agendar, marcar
 * como feita — que já prevê a próxima —, cancelar, criar avulsa). Sem ela, a
 * seção mostra a previsão calculada, só para leitura, e o WhatsApp.
 */
export function SecaoManutencoes() {
  const { itensDaLoja, carregando, hoje, mostrarLoja, abrir, manutencoes, recarregarManutencoes } = usePosVenda();
  const { disponivel, itens } = manutencoes;
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<GrupoManutencao>>(new Set());

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    const termoDigitos = digitos(termo);
    return itens.filter(
      (m) =>
        m.posVenda.cliente.toLowerCase().includes(termo) ||
        m.posVenda.produto.toLowerCase().includes(termo) ||
        (termoDigitos.length >= 4 && digitos(m.posVenda.telefone ?? "").includes(termoDigitos))
    );
  }, [itens, busca]);

  const porGrupo = useMemo(() => {
    const mapa = new Map<GrupoManutencao, ItemManutencao[]>(GRUPOS_MANUTENCAO.map((g) => [g.chave, []]));
    for (const m of filtrados) {
      const g = grupoDaManutencao(m, hoje);
      if (g) mapa.get(g)!.push(m);
    }
    for (const [chave, lista] of mapa) {
      if (chave === "realizadas") {
        lista.sort((a, b) => (b.realizadaEm ?? "").localeCompare(a.realizadaEm ?? ""));
      } else {
        lista.sort((a, b) => dataDaManutencao(a).localeCompare(dataDaManutencao(b)));
      }
    }
    return mapa;
  }, [filtrados, hoje]);

  // Sem data para prever: clientes antigos (compraram antes do CRM) e
  // instalações concluídas sem nenhuma data anotada. Sem manutenção em aberto,
  // a primeira limpeza é programada à mão.
  const semPrevisao = useMemo(() => {
    const comAberta = new Set(itens.filter(estaAberta).map((m) => m.posVenda.id));
    const termo = busca.trim().toLowerCase();
    return itensDaLoja
      .filter(
        (pv) =>
          (pv.origem === "cliente_antigo" || (instalacaoConcluida(pv) && !baseDaInstalacao(pv))) &&
          !comAberta.has(pv.id)
      )
      .filter((pv) => !termo || pv.cliente.toLowerCase().includes(termo))
      .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
  }, [itens, itensDaLoja, busca]);

  const clientesParaNova = useMemo(
    () => [...itensDaLoja].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR")),
    [itensDaLoja]
  );

  if (carregando || manutencoes.carregando) return <EsqueletoSecao />;

  const umAnoAtras = `${Number(hoje.slice(0, 4)) - 1}${hoje.slice(4)}`;
  const contagem = (g: GrupoManutencao) => porGrupo.get(g)!.length;
  const feitasNoAno = itens.filter(
    (m) => m.status === "realizada" && (diaDoMomento(m.realizadaEm) ?? "") >= umAnoAtras
  ).length;
  const totalAbertas = itens.filter(estaAberta).length;

  function alternarGrupo(g: GrupoManutencao) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(g)) novo.delete(g);
      else novo.add(g);
      return novo;
    });
  }

  const nadaAinda = totalAbertas === 0 && contagem("realizadas") === 0;

  return (
    <div className="flex flex-col gap-5">
      {!disponivel && <AvisoSemTabela />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Vencidas"
          valor={contagem("vencidas")}
          tom={contagem("vencidas") > 0 ? "perigo" : "neutro"}
          icone={CalendarClock}
          detalhe="passou da data"
        />
        <StatCard
          rotulo="Este mês"
          valor={contagem("este_mes")}
          tom={contagem("este_mes") > 0 ? "atencao" : "neutro"}
          icone={Flame}
          detalhe="ligar agora"
        />
        <StatCard
          rotulo="Próximos 90 dias"
          valor={contagem("proximos_90")}
          tom="marca"
          icone={CalendarRange}
          detalhe="ir avisando"
        />
        <StatCard
          rotulo="Feitas em 12 meses"
          valor={disponivel ? feitasNoAno : "—"}
          tom="sucesso"
          icone={CheckCircle2}
          detalhe={disponivel ? "limpezas e revisões" : "aparece com o cadastro ativo"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            aria-label="Buscar nas manutenções"
            className="aura-input pl-9"
          />
        </div>
        <Botao
          icone={Plus}
          onClick={() => setNova((v) => !v)}
          disabled={!disponivel}
          title={disponivel ? undefined : MOTIVO_SEM_TABELA}
          aria-expanded={nova}
          className="self-start"
        >
          Nova manutenção
        </Botao>
      </div>

      {nova && disponivel && (
        <NovaManutencao
          clientes={clientesParaNova}
          hoje={hoje}
          aoMudou={recarregarManutencoes}
          aoFechar={() => setNova(false)}
        />
      )}

      {nadaAinda && semPrevisao.length === 0 ? (
        <EstadoVazio
          icone={Flame}
          titulo="Nenhuma manutenção por enquanto"
          descricao="Quando uma instalação é concluída, a limpeza da chaminé fica prevista para um ano depois e aparece aqui."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {GRUPOS_MANUTENCAO.map((g) => {
            const lista = porGrupo.get(g.chave)!;
            if (lista.length === 0) return null;
            const { icone, cor } = ICONE_GRUPO[g.chave];
            const recolhe = g.chave === "realizadas" || g.chave === "mais_adiante";
            const aberto = !recolhe || expandidos.has(g.chave);
            const visiveis = aberto ? lista : lista.slice(0, LIMITE_RECOLHIDO);
            return (
              <section
                key={g.chave}
                className={`aura-card p-4 ${g.chave === "vencidas" ? "border-aura-danger/40" : ""}`}
                aria-labelledby={`grupo-${g.chave}`}
              >
                <CardHeader
                  titulo={
                    <span id={`grupo-${g.chave}`}>
                      {g.titulo}
                      <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{lista.length}</span>
                    </span>
                  }
                  descricao={g.descricao}
                  icone={icone}
                  corIcone={cor}
                  className="mb-0"
                />
                <ul className="divide-y divide-aura-mist">
                  {visiveis.map((m) => (
                    <LinhaManutencao
                      key={m.chave}
                      item={m}
                      hoje={hoje}
                      mostrarLoja={mostrarLoja}
                      disponivel={disponivel}
                      aoAbrirCliente={abrir}
                      aoMudou={recarregarManutencoes}
                    />
                  ))}
                </ul>
                {recolhe && lista.length > LIMITE_RECOLHIDO && (
                  <button
                    type="button"
                    onClick={() => alternarGrupo(g.chave)}
                    className="mt-1 w-full rounded-lg py-2 text-center text-xs font-medium text-aura-petrol-600 hover:bg-aura-sunken/50"
                  >
                    {aberto ? "Mostrar menos" : `Ver todas as ${lista.length}`}
                  </button>
                )}
              </section>
            );
          })}

          {semPrevisao.length > 0 && (
            <section className="aura-card p-4" aria-labelledby="grupo-antigos">
              <CardHeader
                titulo={
                  <span id="grupo-antigos">
                    Sem data para prever a limpeza
                    <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">
                      {semPrevisao.length}
                    </span>
                  </span>
                }
                descricao="Clientes antigos e instalações concluídas sem data anotada. Programe a primeira limpeza: a partir dela o ciclo anual segue sozinho."
                icone={UserRound}
                corIcone="text-aura-gold-700"
                className="mb-0"
              />
              <ul className="divide-y divide-aura-mist">
                {semPrevisao.map((pv) => (
                  <li key={pv.id} className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrir(pv)}
                          className="truncate text-left text-sm font-medium text-aura-graphite hover:text-aura-petrol-600"
                        >
                          {pv.cliente}
                        </button>
                        {pv.origem === "cliente_antigo" && <Selo tom="ouro">Cliente antigo</Selo>}
                        {mostrarLoja && <Selo>{pv.empresa}</Selo>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-aura-graphite-soft">
                        {pv.produto && pv.produto !== "Cliente antigo" && <span>{pv.produto}</span>}
                        {pv.telefone && <span className="tabular-nums">{pv.telefone}</span>}
                        <span>
                          {pv.origem === "cliente_antigo" ? "marcado" : "venda"}{" "}
                          {haQuantoTempo(diasEntre(pv.dataVenda, hoje))}
                        </span>
                        {pv.dataVenda && <span className="sr-only">em {formatarDia(pv.dataVenda)}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProgramarLimpeza
                        posVenda={pv}
                        hoje={hoje}
                        disponivel={disponivel}
                        aoMudou={recarregarManutencoes}
                      />
                      <BotaoWhatsAppLimpeza posVenda={pv} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
