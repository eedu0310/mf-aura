"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, ShieldAlert, Store, User } from "lucide-react";
import { EstadoVazio, Segmentado, Selo, classeBotao } from "@/components/ui";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { CATEGORIAS, agruparPorCategoria, type Categoria, type Grupo } from "@/lib/aura/categorias-recomendacao";

type Prioridade = "urgente" | "alta" | "media" | "baixa";

type Recomendacao = {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  prazo?: string | null;
  agente?: string | null;
  agente_nome?: string | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  criado_em?: string | null;
  acao_url?: string | null;
};

interface ResumoVendedor {
  id: string;
  nome: string;
  loja: string;
  cargo: string;
  voce: boolean;
  total: number;
  urgentes: number;
  altas: number;
  porCategoria: Partial<Record<Categoria, number>>;
}

// Cartão neutro para todas; a prioridade aparece no filete à esquerda e no selo.
const CORES: Record<Prioridade, string> = {
  urgente: "border-l-aura-danger",
  alta: "border-l-aura-warning",
  media: "border-l-aura-petrol-500",
  baixa: "border-l-aura-mist",
};

const SELO: Record<Prioridade, "perigo" | "atencao" | "marca" | "neutro"> = {
  urgente: "perigo",
  alta: "atencao",
  media: "marca",
  baixa: "neutro",
};

/** Quantos itens cada grupo mostra antes do "ver mais". */
const POR_GRUPO = 3;

type Filtro = "todas" | "urgentes";
type Visao = "minhas" | "equipe";

/**
 * A Supervisora AURA no Meu Dia: as prioridades separadas por tipo (leads,
 * conversas, follow-ups, negócios...), do mais urgente ao menos. O gestor
 * troca para "Equipe" e vê loja por loja, vendedor por vendedor.
 */
export function AuraSupervisorPanel() {
  const acesso = usarMeuAcesso();
  const gestor = acesso.cargo === "Gestor" && acesso.gestorAprovado;
  const [visao, setVisao] = useState<Visao>("minhas");

  return (
    <section className="aura-card p-5" aria-labelledby="aura-supervisora-titulo">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken text-aura-petrol-600">
          <ShieldAlert size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="aura-supervisora-titulo" className="text-sm font-semibold text-aura-graphite">
            AURA Supervisora
          </h2>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">
            {visao === "equipe" ? "Prioridades da equipe, por loja e vendedor." : "Suas prioridades, separadas por tipo."}
          </p>
        </div>
        {gestor && (
          <Segmentado<Visao>
            rotulo="Ver prioridades de"
            opcoes={[
              { valor: "minhas", rotulo: "Minhas" },
              { valor: "equipe", rotulo: "Equipe" },
            ]}
            valor={visao}
            aoMudar={setVisao}
          />
        )}
      </div>
      {visao === "equipe" && gestor ? <VisaoEquipe mestre={acesso.gestorMestre} /> : <ListaAgrupada url="/api/aura/supervisao" podeConcluir />}
    </section>
  );
}

/** As prioridades de uma pessoa, em grupos por tipo. */
function ListaAgrupada({ url, podeConcluir }: { url: string; podeConcluir: boolean }) {
  const [recomendacoes, setRecomendacoes] = useState<Recomendacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abertos, setAbertos] = useState<Set<Categoria>>(new Set());

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const resposta = await fetch(url, { cache: "no-store" });
        const dados = (await resposta.json().catch(() => ({}))) as { recomendacoes?: Recomendacao[]; erro?: string; error?: string };
        if (!vivo) return;
        if (!resposta.ok) setErro(dados.erro ?? dados.error ?? "Não consegui carregar as prioridades.");
        else setRecomendacoes(dados.recomendacoes ?? []);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não consegui carregar as prioridades.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [url]);

  const grupos = useMemo(() => {
    const base = filtro === "urgentes" ? recomendacoes.filter((r) => r.prioridade === "urgente" || r.prioridade === "alta") : recomendacoes;
    return agruparPorCategoria(base);
  }, [recomendacoes, filtro]);
  const totalVisivel = grupos.reduce((s, g) => s + g.itens.length, 0);

  async function atualizar(id: string, status: "concluida" | "dispensada") {
    setAtualizando(id);
    try {
      const resposta = await fetch("/api/aura/supervisao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (resposta.ok) setRecomendacoes((atuais) => atuais.filter((item) => item.id !== id));
      else window.alert("Não consegui atualizar. Tente de novo.");
    } finally {
      setAtualizando(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-aura-graphite-soft" size={18} />
      </div>
    );
  }
  if (erro) return <p className="rounded-lg bg-aura-danger/5 p-3 text-sm text-aura-danger">{erro}</p>;
  if (recomendacoes.length === 0) {
    return (
      <EstadoVazio
        icone={CheckCircle2}
        titulo="Nenhuma recomendação pendente nesta rodada."
        descricao="Continue registrando cada contato no CRM."
        className="py-6"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado<Filtro>
          rotulo="Filtrar prioridades"
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "urgentes", rotulo: "Urgentes e altas" },
          ]}
          valor={filtro}
          aoMudar={setFiltro}
        />
        <span className="text-xs text-aura-graphite-soft">
          {totalVisivel} {totalVisivel === 1 ? "item" : "itens"} em {grupos.length} {grupos.length === 1 ? "grupo" : "grupos"}
        </span>
      </div>
      {grupos.length === 0 && <p className="py-4 text-sm text-aura-graphite-soft">Nada urgente agora.</p>}
      {grupos.map((g) => (
        <GrupoDePrioridades
          key={g.categoria.id}
          grupo={g}
          aberto={abertos.has(g.categoria.id)}
          alternar={() =>
            setAbertos((a) => {
              const n = new Set(a);
              if (n.has(g.categoria.id)) n.delete(g.categoria.id);
              else n.add(g.categoria.id);
              return n;
            })
          }
          podeConcluir={podeConcluir}
          atualizando={atualizando}
          atualizar={atualizar}
        />
      ))}
    </div>
  );
}

function GrupoDePrioridades({
  grupo,
  aberto,
  alternar,
  podeConcluir,
  atualizando,
  atualizar,
}: {
  grupo: Grupo<Recomendacao>;
  aberto: boolean;
  alternar: () => void;
  podeConcluir: boolean;
  atualizando: string | null;
  atualizar: (id: string, status: "concluida" | "dispensada") => void;
}) {
  const visiveis = aberto ? grupo.itens : grupo.itens.slice(0, POR_GRUPO);
  const resto = grupo.itens.length - visiveis.length;
  return (
    <div className="rounded-xl border border-aura-mist">
      <div className="flex items-center gap-2 border-b border-aura-mist bg-aura-sunken/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-aura-graphite">
            {grupo.categoria.nome} <span className="font-normal text-aura-graphite-soft">({grupo.itens.length})</span>
          </p>
          <p className="truncate text-xs text-aura-graphite-soft">{grupo.categoria.descricao}</p>
        </div>
        {grupo.urgentes > 0 && <Selo tom="perigo">{grupo.urgentes} urgente(s)</Selo>}
      </div>
      <div className="space-y-2 p-2">
        {visiveis.map((item) => (
          <div key={item.id} className={`rounded-lg border border-aura-mist border-l-2 bg-aura-surface p-3 ${CORES[item.prioridade] ?? ""}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-aura-graphite">{item.titulo}</p>
                {item.descricao && <p className="mt-1 text-xs text-aura-graphite-soft">{item.descricao}</p>}
                {item.agente_nome && <p className="mt-1 text-[11px] text-aura-graphite-soft">Enviado por {item.agente_nome}</p>}
              </div>
              <Selo tom={SELO[item.prioridade] ?? "neutro"} className="shrink-0 uppercase">
                {item.prioridade}
              </Selo>
            </div>
            {(podeConcluir || item.acao_url) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.acao_url && (
                  <Link href={item.acao_url} className={classeBotao("secundario", "sm")}>
                    <ExternalLink size={13} /> Abrir
                  </Link>
                )}
                {podeConcluir && (
                  <>
                    <button
                      type="button"
                      onClick={() => void atualizar(item.id, "concluida")}
                      disabled={atualizando === item.id}
                      className={classeBotao("secundario", "sm")}
                    >
                      <CheckCircle2 size={13} className="text-aura-success" /> Concluí
                    </button>
                    <button
                      type="button"
                      onClick={() => void atualizar(item.id, "dispensada")}
                      disabled={atualizando === item.id}
                      className={classeBotao("fantasma", "sm")}
                    >
                      Dispensar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {(resto > 0 || aberto) && grupo.itens.length > POR_GRUPO && (
          <button type="button" onClick={alternar} className={classeBotao("fantasma", "sm", "w-full justify-center")}>
            {aberto ? (
              <>
                <ChevronUp size={14} /> Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Ver mais {resto}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** Gestor: a equipe por loja, com filtro de loja e vendedor. */
function VisaoEquipe({ mestre }: { mestre: boolean }) {
  const [resumo, setResumo] = useState<ResumoVendedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [loja, setLoja] = useState("");
  const [vendedor, setVendedor] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/aura/supervisao?escopo=equipe", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { resumo?: ResumoVendedor[]; erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Não consegui carregar a equipe.");
      setResumo(d.resumo ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar a equipe.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const lojas = useMemo(() => [...new Set(resumo.map((r) => r.loja))].sort(), [resumo]);
  const daLoja = resumo.filter((r) => !loja || r.loja === loja);
  const escolhido = resumo.find((r) => r.id === vendedor);

  if (carregando) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-aura-graphite-soft" size={18} />
      </div>
    );
  }
  if (erro) return <p className="rounded-lg bg-aura-danger/5 p-3 text-sm text-aura-danger">{erro}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mestre && lojas.length > 1 && (
          <select
            value={loja}
            onChange={(e) => {
              setLoja(e.target.value);
              setVendedor("");
            }}
            className="aura-input !h-9 w-auto"
            aria-label="Filtrar por loja"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="aura-input !h-9 w-auto" aria-label="Filtrar por vendedor">
          <option value="">Todos os vendedores</option>
          {daLoja.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
              {v.voce ? " (você)" : ""} — {v.total}
            </option>
          ))}
        </select>
        {vendedor && (
          <button type="button" onClick={() => setVendedor("")} className={classeBotao("fantasma", "sm")}>
            <ArrowLeft size={14} /> Voltar à equipe
          </button>
        )}
      </div>

      {escolhido ? (
        <div className="space-y-2">
          <p className="text-sm text-aura-graphite">
            <User size={14} className="mr-1 inline text-aura-graphite-soft" />
            <strong>{escolhido.nome}</strong> · {escolhido.loja} · {escolhido.total} prioridade(s)
            {!escolhido.voce && <span className="text-aura-graphite-soft"> — só leitura: quem conclui é o vendedor.</span>}
          </p>
          <ListaAgrupada
            url={escolhido.voce ? "/api/aura/supervisao" : `/api/aura/supervisao?vendedor=${encodeURIComponent(escolhido.id)}`}
            podeConcluir={escolhido.voce}
          />
        </div>
      ) : daLoja.length === 0 ? (
        <EstadoVazio icone={CheckCircle2} titulo="Ninguém com prioridade pendente." className="py-6" />
      ) : (
        (loja ? [loja] : lojas).map((l) => {
          const pessoas = daLoja.filter((v) => v.loja === l);
          if (!pessoas.length) return null;
          return (
            <div key={l} className="rounded-xl border border-aura-mist">
              <p className="flex items-center gap-2 border-b border-aura-mist bg-aura-sunken/60 px-3 py-2 text-sm font-semibold text-aura-graphite">
                <Store size={14} className="text-aura-graphite-soft" /> {l}
                <span className="font-normal text-aura-graphite-soft">
                  ({pessoas.reduce((s, p) => s + p.total, 0)} prioridades)
                </span>
              </p>
              <div className="divide-y divide-aura-mist">
                {pessoas.map((v) => {
                  const principais = CATEGORIAS.filter((c) => v.porCategoria[c.id]).slice(0, 4);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVendedor(v.id)}
                      className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left transition hover:bg-aura-sunken/50"
                    >
                      <span className="min-w-[9rem] flex-1 text-sm font-medium text-aura-graphite">
                        {v.nome}
                        {v.voce && <span className="font-normal text-aura-graphite-soft"> (você)</span>}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {principais.map((c) => (
                          <span key={c.id} className="rounded-md bg-aura-sunken px-1.5 py-0.5 text-[11px] text-aura-graphite-soft">
                            {c.nome}: {v.porCategoria[c.id]}
                          </span>
                        ))}
                      </span>
                      {v.urgentes > 0 && <Selo tom="perigo">{v.urgentes} urgente(s)</Selo>}
                      {v.altas > 0 && <Selo tom="atencao">{v.altas} alta(s)</Selo>}
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-aura-graphite">{v.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
