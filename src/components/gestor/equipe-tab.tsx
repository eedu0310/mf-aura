"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

/**
 * Loja → vendedor → conversa / negociação, com o laudo da IA no fim.
 *
 * O pedido: "deixa tudo bem separado, lojas, vendedores, conversas e
 * relatórios da IA de cada conversa e cada negociação dos vendedores".
 *
 * A tela é uma trilha, não um dashboard: cada nível mostra só o placar
 * suficiente para escolher onde descer, e o detalhe pesado (histórico da
 * conversa, trilha do negócio) só é buscado quando o gestor abre aquele item.
 * Carregar as 698 conversas com histórico para desenhar quatro lojas é o
 * caminho mais curto para a tela travar.
 */

const moeda = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

interface LojaLinha {
  nome: string;
  vendedores: number;
  vendido: number;
  vendas: number;
  conversas: number;
  conversasComAlerta: number;
  negociosAbertos: number;
  pipeline: number;
  negociosParados: number;
}

interface VendedorLinha {
  id: string;
  nome: string;
  cargo: string;
  ativo: boolean;
  vendido: number;
  vendas: number;
  conversas: number;
  conversasComAlerta: number;
  negociosAbertos: number;
  pipeline: number;
  negociosParados: number;
  ganhos: number;
  perdidos: number;
  atividades: number;
}

type Trilha =
  | { nivel: "lojas" }
  | { nivel: "loja"; loja: string }
  | { nivel: "vendedor"; loja: string; id: string; nome: string }
  | { nivel: "conversa"; loja: string; voltarPara: Trilha; id: string }
  | { nivel: "negocio"; loja: string; voltarPara: Trilha; id: string };

export function EquipeTab() {
  const [trilha, setTrilha] = useState<Trilha>({ nivel: "lojas" });
  const [dias, setDias] = useState(90);
  const [dados, setDados] = useState<Record<string, unknown> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const p = new URLSearchParams({ dias: String(dias) });
    if (trilha.nivel === "loja") p.set("loja", trilha.loja);
    if (trilha.nivel === "vendedor") p.set("vendedor", trilha.id);
    if (trilha.nivel === "conversa") p.set("conversa", trilha.id);
    if (trilha.nivel === "negocio") p.set("negocio", trilha.id);

    try {
      const res = await fetch(`/api/gestor/equipe?${p}`);
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo.erro ?? "Não consegui carregar.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar.");
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [trilha, dias]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  function voltar() {
    if (trilha.nivel === "loja") setTrilha({ nivel: "lojas" });
    else if (trilha.nivel === "vendedor") setTrilha({ nivel: "loja", loja: trilha.loja });
    else if (trilha.nivel === "conversa" || trilha.nivel === "negocio")
      setTrilha(trilha.voltarPara);
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-aura-graphite">
            Equipe, conversa por conversa
          </h2>
          <p className="text-sm text-aura-graphite-soft">
            Entre na loja, depois no vendedor, e leia o que a IA viu em cada
            conversa e em cada negociação dele.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          Período
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-lg border border-aura-mist bg-white px-2.5 py-1.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </label>
      </header>

      {trilha.nivel !== "lojas" && (
        <button
          type="button"
          onClick={voltar}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-aura-petrol-600 hover:text-aura-petrol-700"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>
      )}

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" />
          Carregando...
        </p>
      )}

      {erro && !carregando && (
        <p className="rounded-xl bg-aura-danger/10 px-4 py-3 text-sm text-aura-danger">{erro}</p>
      )}

      {!carregando && !erro && dados && (
        <>
          {dados.nivel === "lojas" && (
            <NivelLojas
              lojas={(dados.lojas as LojaLinha[]) ?? []}
              aoEntrar={(loja) => setTrilha({ nivel: "loja", loja })}
            />
          )}
          {dados.nivel === "loja" && (
            <NivelLoja
              loja={dados.loja as string}
              vendedores={(dados.vendedores as VendedorLinha[]) ?? []}
              aoEntrar={(v) =>
                setTrilha({
                  nivel: "vendedor",
                  loja: dados.loja as string,
                  id: v.id,
                  nome: v.nome,
                })
              }
            />
          )}
          {dados.nivel === "vendedor" && (
            <NivelVendedor
              dados={dados}
              aoAbrirConversa={(id) =>
                setTrilha({ nivel: "conversa", loja: trilha.nivel === "vendedor" ? trilha.loja : "", voltarPara: trilha, id })
              }
              aoAbrirNegocio={(id) =>
                setTrilha({ nivel: "negocio", loja: trilha.nivel === "vendedor" ? trilha.loja : "", voltarPara: trilha, id })
              }
            />
          )}
          {dados.nivel === "conversa" && <NivelConversa dados={dados} />}
          {dados.nivel === "negocio" && <NivelNegocio dados={dados} />}
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ nível 1

function NivelLojas({
  lojas,
  aoEntrar,
}: {
  lojas: LojaLinha[];
  aoEntrar: (loja: string) => void;
}) {
  if (!lojas.length) {
    return <p className="text-sm text-aura-graphite-soft">Nenhuma loja com movimento no período.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {lojas.map((l) => (
        <button
          key={l.nome}
          type="button"
          onClick={() => aoEntrar(l.nome)}
          className="flex items-start justify-between gap-3 rounded-xl border border-aura-mist bg-white p-4 text-left transition hover:border-aura-petrol-500/40 hover:bg-aura-bg/40"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium text-aura-graphite">
              <Building2 size={16} className="text-aura-petrol-600" />
              {l.nome}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {l.vendedores} vendedor(es) · {l.conversas} conversa(s)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Numero rotulo="Vendido" valor={moeda(l.vendido)} />
              <Numero rotulo="Pipeline aberto" valor={moeda(l.pipeline)} />
              <Numero rotulo="Negócios abertos" valor={String(l.negociosAbertos)} />
              <Numero
                rotulo="Parados 7+ dias"
                valor={String(l.negociosParados)}
                alerta={l.negociosParados > 0}
              />
              <Numero
                rotulo="Conversas com alerta"
                valor={String(l.conversasComAlerta)}
                alerta={l.conversasComAlerta > 0}
              />
            </div>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-aura-graphite-soft" />
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ nível 2

function NivelLoja({
  loja,
  vendedores,
  aoEntrar,
}: {
  loja: string;
  vendedores: VendedorLinha[];
  aoEntrar: (v: VendedorLinha) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
        <Building2 size={16} className="text-aura-petrol-600" />
        {loja}
      </p>
      {!vendedores.length && (
        <p className="text-sm text-aura-graphite-soft">Nenhuma pessoa nesta loja.</p>
      )}
      {vendedores.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => aoEntrar(v)}
          className="flex items-start justify-between gap-3 rounded-xl border border-aura-mist bg-white p-4 text-left transition hover:border-aura-petrol-500/40 hover:bg-aura-bg/40"
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium text-aura-graphite">
              <User size={15} className="text-aura-petrol-600" />
              {v.nome}
              <span className="rounded-full bg-aura-mist/60 px-2 py-0.5 text-xs font-normal text-aura-graphite-soft">
                {v.cargo}
              </span>
              {!v.ativo && (
                <span className="rounded-full bg-aura-mist px-2 py-0.5 text-xs font-normal text-aura-graphite-soft">
                  desativado
                </span>
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <Numero rotulo="Vendido" valor={moeda(v.vendido)} />
              <Numero rotulo="Vendas" valor={String(v.vendas)} />
              <Numero rotulo="Pipeline" valor={moeda(v.pipeline)} />
              <Numero rotulo="Conversas" valor={String(v.conversas)} />
              <Numero
                rotulo="Com alerta"
                valor={String(v.conversasComAlerta)}
                alerta={v.conversasComAlerta > 0}
              />
              <Numero rotulo="Atividades" valor={String(v.atividades)} />
              <Numero rotulo="Abertos" valor={String(v.negociosAbertos)} />
              <Numero
                rotulo="Parados 7+"
                valor={String(v.negociosParados)}
                alerta={v.negociosParados > 0}
              />
              <Numero rotulo="Ganhos / perdidos" valor={`${v.ganhos} / ${v.perdidos}`} />
            </div>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-aura-graphite-soft" />
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ nível 3

function NivelVendedor({
  dados,
  aoAbrirConversa,
  aoAbrirNegocio,
}: {
  dados: Record<string, unknown>;
  aoAbrirConversa: (id: string) => void;
  aoAbrirNegocio: (id: string) => void;
}) {
  const [verConversas, setVerConversas] = useState(true);
  const v = dados.vendedor as { nome: string; loja: string; cargo: string };
  const conversas = (dados.conversas as Record<string, unknown>[]) ?? [];
  const negocios = (dados.negocios as Record<string, unknown>[]) ?? [];
  const supervisoes = (dados.supervisoes as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-lg font-semibold text-aura-graphite">{v.nome}</p>
        <p className="text-sm text-aura-graphite-soft">
          {v.cargo} · {v.loja}
        </p>
      </div>

      {supervisoes.length > 0 && (
        <div className="rounded-xl border border-aura-mist bg-aura-bg/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
            <Bot size={15} className="text-aura-petrol-600" />
            O que a AURA escreveu sobre {v.nome.split(" ")[0]}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {supervisoes.slice(0, 3).map((s) => (
              <div key={String(s.id)} className="rounded-lg bg-white p-3">
                <p className="flex flex-wrap items-center gap-2 text-xs text-aura-graphite-soft">
                  {quando(s.criado_em as string)}
                  {s.score != null && (
                    <span className="rounded-full bg-aura-petrol-500/10 px-2 py-0.5 font-medium text-aura-petrol-600">
                      nota {String(s.score)}
                    </span>
                  )}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite">
                  {String(s.resumo ?? "—")}
                </p>
                {Array.isArray(s.riscos) && s.riscos.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {(s.riscos as unknown[]).slice(0, 5).map((r, i) => (
                      <li key={i} className="flex gap-1.5 text-xs text-aura-graphite-soft">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-aura-gold" />
                        {textoDoItem(r)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-aura-mist">
        <Chip ativo={verConversas} onClick={() => setVerConversas(true)}>
          <MessageSquare size={14} /> Conversas ({conversas.length})
        </Chip>
        <Chip ativo={!verConversas} onClick={() => setVerConversas(false)}>
          <Target size={14} /> Negociações ({negocios.length})
        </Chip>
      </div>

      {verConversas ? (
        conversas.length === 0 ? (
          <p className="text-sm text-aura-graphite-soft">
            Nenhuma conversa desta pessoa no período.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {conversas.map((c) => (
              <button
                key={String(c.id)}
                type="button"
                onClick={() => aoAbrirConversa(String(c.id))}
                className="flex items-start justify-between gap-3 rounded-xl border border-aura-mist bg-white p-3.5 text-left transition hover:border-aura-petrol-500/40 hover:bg-aura-bg/40"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-aura-graphite">
                    {String(c.nome ?? c.telefone ?? "Sem nome")}
                    {c.papel === "parceiro" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-aura-petrol-500/10 px-2 py-0.5 text-xs font-normal text-aura-petrol-600">
                        <Users size={11} /> em dupla
                      </span>
                    )}
                    {Number(c.qtdAlertas ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-aura-gold/15 px-2 py-0.5 text-xs font-normal text-aura-gold-700">
                        <AlertTriangle size={11} /> {String(c.qtdAlertas)}
                      </span>
                    )}
                    {c.ignorado === true && (
                      <span className="rounded-full bg-aura-mist px-2 py-0.5 text-xs font-normal text-aura-graphite-soft">
                        não é lead
                      </span>
                    )}
                  </p>
                  {!!c.resumo && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-aura-graphite-soft">
                      {String(c.resumo)}
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-aura-graphite-soft">
                    {!!c.etapa && <span>{String(c.etapa)}</span>}
                    {!!c.categoria && <span>· {String(c.categoria)}</span>}
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {quando(c.updated_at as string)}
                    </span>
                  </p>
                </div>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-aura-graphite-soft" />
              </button>
            ))}
          </div>
        )
      ) : negocios.length === 0 ? (
        <p className="text-sm text-aura-graphite-soft">Nenhuma negociação desta pessoa.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {negocios.map((o) => (
            <button
              key={String(o.id)}
              type="button"
              onClick={() => aoAbrirNegocio(String(o.id))}
              className="flex items-start justify-between gap-3 rounded-xl border border-aura-mist bg-white p-3.5 text-left transition hover:border-aura-petrol-500/40 hover:bg-aura-bg/40"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-aura-graphite">
                  {String(o.cliente ?? "Sem nome")}
                  {o.papel === "parceiro" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-aura-petrol-500/10 px-2 py-0.5 text-xs font-normal text-aura-petrol-600">
                      <Users size={11} /> em dupla
                    </span>
                  )}
                  {o.ganho === true && (
                    <span className="rounded-full bg-aura-success/15 px-2 py-0.5 text-xs font-normal text-aura-success">
                      ganho
                    </span>
                  )}
                  {o.perdido === true && (
                    <span className="rounded-full bg-aura-danger/10 px-2 py-0.5 text-xs font-normal text-aura-danger">
                      perdido
                    </span>
                  )}
                  {o.fechado !== true && Number(o.dias_parado ?? 0) >= 7 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-aura-gold/15 px-2 py-0.5 text-xs font-normal text-aura-gold-700">
                      <Clock size={11} /> {String(o.dias_parado)} dias parado
                    </span>
                  )}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-aura-graphite-soft">
                  <span>{String(o.coluna ?? o.etapa)}</span>
                  <span>· {moeda(Number(o.valor ?? 0))}</span>
                  {!!o.produto && <span>· {String(o.produto)}</span>}
                  {!!o.motivo_perda && <span>· perdido por {String(o.motivo_perda)}</span>}
                </p>
              </div>
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-aura-graphite-soft" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ nível 4

function NivelConversa({ dados }: { dados: Record<string, unknown> }) {
  const c = dados.conversa as Record<string, unknown>;
  const historico = Array.isArray(c.historico) ? (c.historico as Record<string, unknown>[]) : [];
  const dicas = Array.isArray(c.dicas) ? (c.dicas as unknown[]) : [];
  const alertas = Array.isArray(c.alertas) ? (c.alertas as unknown[]) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-lg font-semibold text-aura-graphite">
          {String(c.nome ?? c.telefone ?? "Conversa")}
        </p>
        <p className="text-sm text-aura-graphite-soft">
          {String(c.vendedorNome ?? "sem dono")}
          {c.parceiroNome ? ` e ${String(c.parceiroNome)} (em dupla)` : ""}
          {c.telefone ? ` · ${String(c.telefone)}` : ""}
        </p>
      </div>

      <Cartao titulo="O que a IA entendeu" icone={<Bot size={15} />}>
        {c.resumo ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite">
            {String(c.resumo)}
          </p>
        ) : (
          <p className="text-sm text-aura-graphite-soft">
            A IA ainda não analisou esta conversa.
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
          <Campo rotulo="Etapa" valor={c.etapa as string} />
          <Campo rotulo="Interesse" valor={c.interesse as string} />
          <Campo
            rotulo="Valor estimado"
            valor={c.valor_estimado ? moeda(Number(c.valor_estimado)) : null}
          />
          <Campo rotulo="Natureza" valor={c.natureza as string} />
          <Campo rotulo="Categoria" valor={c.categoria as string} />
          <Campo rotulo="Analisada em" valor={quando(c.ultima_analise_em as string)} />
        </dl>
        {!!c.motivo_natureza && (
          <p className="mt-3 rounded-lg bg-aura-bg/60 px-3 py-2 text-xs leading-relaxed text-aura-graphite-soft">
            Por que foi classificada assim: {String(c.motivo_natureza)}
          </p>
        )}
      </Cartao>

      {!!c.proxima_acao && (
        <Cartao titulo="Próximo passo que a IA sugeriu" icone={<TrendingUp size={15} />}>
          <p className="text-sm leading-relaxed text-aura-graphite">{String(c.proxima_acao)}</p>
        </Cartao>
      )}

      {alertas.length > 0 && (
        <Cartao titulo={`Alertas (${alertas.length})`} icone={<AlertTriangle size={15} />}>
          <ul className="flex flex-col gap-1.5">
            {alertas.map((a, i) => (
              <li key={i} className="text-sm leading-relaxed text-aura-graphite">
                {textoDoItem(a)}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {dicas.length > 0 && (
        <Cartao titulo="Dicas que a IA deu ao vendedor" icone={<Bot size={15} />}>
          <ul className="flex flex-col gap-1.5">
            {dicas.map((d, i) => (
              <li key={i} className="text-sm leading-relaxed text-aura-graphite">
                {textoDoItem(d)}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {!!c.auto_enviado_em && (
        <Cartao titulo="Resposta automática enviada" icone={<MessageSquare size={15} />}>
          <p className="text-xs text-aura-graphite-soft">{quando(c.auto_enviado_em as string)}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite">
            {String(c.auto_texto ?? "—")}
          </p>
        </Cartao>
      )}

      <Cartao
        titulo={`Histórico da conversa (${historico.length})`}
        icone={<MessageSquare size={15} />}
      >
        {historico.length === 0 ? (
          <p className="text-sm text-aura-graphite-soft">
            Nada guardado aqui. O sistema registra o histórico a partir do momento
            em que a IA passa a acompanhar a conversa.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {historico.map((h, i) => (
              <li key={i} className="rounded-lg bg-aura-bg/60 px-3 py-2">
                <p className="text-xs text-aura-graphite-soft">
                  {quando((h.em ?? h.quando ?? h.created_at) as string)}
                  {h.etapa ? ` · ${String(h.etapa)}` : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite">
                  {String(h.resumo ?? h.texto ?? h.evidencia ?? h.mensagem ?? textoDoItem(h))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Cartao>
    </div>
  );
}

function NivelNegocio({ dados }: { dados: Record<string, unknown> }) {
  const o = dados.negocio as Record<string, unknown>;
  const movimentos = (dados.movimentos as Record<string, unknown>[]) ?? [];
  const conversa = dados.conversa as Record<string, unknown> | null;
  const fechamento = dados.fechamento as Record<string, unknown> | null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-lg font-semibold text-aura-graphite">
          {String(o.cliente ?? "Negócio")}
        </p>
        <p className="text-sm text-aura-graphite-soft">
          {String(o.vendedorNome ?? "sem dono")}
          {o.parceiroNome
            ? ` e ${String(o.parceiroNome)} — dividem ${String(o.percentual_parceiro ?? 50)}% para ${String(o.parceiroNome).split(" ")[0]}`
            : ""}
        </p>
      </div>

      <Cartao titulo="Onde está" icone={<Target size={15} />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
          <Campo rotulo="Etapa" valor={(o.coluna ?? o.etapa) as string} />
          <Campo rotulo="Valor" valor={moeda(Number(o.valor ?? 0))} />
          <Campo rotulo="Probabilidade" valor={o.probabilidade as string} />
          <Campo rotulo="Produto" valor={o.produto as string} />
          <Campo
            rotulo="Dias parado"
            valor={o.fechado === true ? "—" : String(o.dias_parado ?? 0)}
          />
          <Campo rotulo="Aberto em" valor={quando(o.created_at as string)} />
        </dl>
        {!!o.motivo_perda && (
          <p className="mt-3 rounded-lg bg-aura-danger/10 px-3 py-2 text-sm leading-relaxed text-aura-danger">
            Perdido por {String(o.motivo_perda)}
            {o.descricao_perda ? `: ${String(o.descricao_perda)}` : ""}
          </p>
        )}
      </Cartao>

      {fechamento && (
        <Cartao titulo="O laudo da IA sobre o fechamento" icone={<Bot size={15} />}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite">
            {String(fechamento.resumo ?? "—")}
          </p>
          <Lista rotulo="Acertou" itens={fechamento.acertos} />
          <Lista rotulo="Errou" itens={fechamento.erros} />
          <Lista rotulo="Etapas puladas" itens={fechamento.etapas_puladas} />
          {!!fechamento.ponto_fraco && (
            <p className="mt-3 rounded-lg bg-aura-gold/10 px-3 py-2 text-sm leading-relaxed text-aura-graphite">
              Ponto fraco: {String(fechamento.ponto_fraco)}
            </p>
          )}
        </Cartao>
      )}

      {conversa && (
        <Cartao titulo="A conversa que originou este negócio" icone={<MessageSquare size={15} />}>
          <p className="text-sm font-medium text-aura-graphite">{String(conversa.nome ?? "—")}</p>
          {!!conversa.resumo && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite-soft">
              {String(conversa.resumo)}
            </p>
          )}
          {!!conversa.proxima_acao && (
            <p className="mt-2 text-sm leading-relaxed text-aura-graphite">
              Próximo passo: {String(conversa.proxima_acao)}
            </p>
          )}
        </Cartao>
      )}

      <Cartao
        titulo={`Por que andou (ou não) — ${movimentos.length} registro(s)`}
        icone={<Clock size={15} />}
      >
        {movimentos.length === 0 ? (
          <p className="text-sm text-aura-graphite-soft">
            Nenhuma movimentação registrada para este negócio.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {movimentos.map((m) => (
              <li key={String(m.id)} className="rounded-lg bg-aura-bg/60 px-3 py-2">
                <p className="text-xs text-aura-graphite-soft">
                  {quando((m.ocorrida_em ?? m.created_at) as string)}
                  {m.origem === "whatsapp_ia" ? " · pela IA" : " · à mão"}
                </p>
                <p className="mt-0.5 text-sm font-medium text-aura-graphite">
                  {String(m.titulo ?? "—")}
                </p>
                {!!m.contexto && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-aura-graphite-soft">
                    {String(m.contexto)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ pedaços

function textoDoItem(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return String(o.texto ?? o.mensagem ?? o.titulo ?? o.descricao ?? JSON.stringify(x));
  }
  return String(x);
}

function Lista({ rotulo, itens }: { rotulo: string; itens: unknown }) {
  if (!Array.isArray(itens) || itens.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-aura-graphite-soft">
        {rotulo}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {itens.map((i, k) => (
          <li key={k} className="text-sm leading-relaxed text-aura-graphite">
            {textoDoItem(i)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cartao({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-cartao className="rounded-xl border border-aura-mist bg-white p-4">
      <p className="mb-2.5 flex items-center gap-2 text-sm font-medium text-aura-graphite">
        <span className="text-aura-petrol-600">{icone}</span>
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-aura-graphite-soft">{rotulo}</dt>
      <dd className="font-medium text-aura-graphite">{valor || "—"}</dd>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <p className="text-aura-graphite-soft">{rotulo}</p>
      <p className={`font-semibold ${alerta ? "text-aura-gold-700" : "text-aura-graphite"}`}>
        {valor}
      </p>
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
        ativo
          ? "border-aura-petrol-500 text-aura-petrol-600"
          : "border-transparent text-aura-graphite-soft hover:text-aura-graphite"
      }`}
    >
      {children}
    </button>
  );
}
