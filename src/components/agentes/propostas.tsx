"use client";

/**
 * PROPOSTAS E CRIADOS: os agentes novos que a equipe pediu (quem propôs, a
 * missão, o porquê e a configuração em palavras) com Aprovar/Recusar para o
 * gestor mestre — sempre com um passo de confirmação — e a lista dos que já
 * foram criados pela própria equipe.
 */
import { useState, type ReactNode } from "react";
import { Check, CheckCircle2, Inbox, Lightbulb, RefreshCw, Sparkles, X } from "lucide-react";
import type { Agenda, ConfigAgenteConfiguravel, PropostaListada } from "@/lib/agentes/tipos";
import { Alerta, Botao, Card, CardHeader, EstadoVazio, Selo } from "@/components/ui";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { AvatarAgente, Esqueleto, Janela, comandos, dataHora, haQuanto, rotuloSetor, useEscritorio } from "./comum";

const FONTES: Record<ConfigAgenteConfiguravel["fonte"], string> = {
  relacionamentos: "Clientes e contatos (relacionamentos)",
  oportunidades: "Oportunidades do funil",
  leads: "Leads que chegaram",
  atividades: "Atividades registradas pela equipe",
  pos_vendas: "Pós-venda (entregas, instalações, manutenções)",
  vendas: "Vendas fechadas",
  conversas_whatsapp: "Conversas do WhatsApp (só leitura)",
  campanhas: "Campanhas de marketing",
};

const DESTINOS: Record<ConfigAgenteConfiguravel["destinatario"], string> = {
  dono: "O vendedor dono de cada registro",
  gestor_da_loja: "O gestor da loja",
  pos_venda_da_loja: "O pós-venda da loja",
  marketing_da_loja: "O marketing da loja",
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Agenda em palavras: "A cada 2 horas", "Todo dia às 7h40 e 14h (seg a sex)". */
export function agendaEmPalavras(a: Agenda | null | undefined) {
  if (!a) return "—";
  if (a.tipo === "intervalo") {
    const m = a.minutos;
    if (m % 1440 === 0) return m === 1440 ? "Uma vez por dia" : `A cada ${m / 1440} dias`;
    if (m % 60 === 0) return m === 60 ? "A cada hora" : `A cada ${m / 60} horas`;
    return `A cada ${m} minutos`;
  }
  const min = a.minuto ?? 0;
  const horas = [...a.horas].sort((x, y) => x - y).map((h) => (min ? `${h}h${String(min).padStart(2, "0")}` : `${h}h`));
  const lista = horas.length > 1 ? `${horas.slice(0, -1).join(", ")} e ${horas[horas.length - 1]}` : horas[0] ?? "—";
  const dias = a.diasSemana?.length ? [...a.diasSemana].sort((x, y) => x - y) : [];
  let quando = "Todo dia";
  if (dias.length > 0 && dias.length < 7) {
    const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    quando = seguidos && dias.length > 2 ? `De ${DIAS[dias[0]]} a ${DIAS[dias[dias.length - 1]]}` : `Às ${dias.map((d) => DIAS[d]).join(", ")}`;
  }
  return `${quando}, às ${lista}`;
}

export function PropostasAgentes() {
  const { estado, erro, carregando, recarregar } = useEscritorio();
  const acesso = usarMeuAcesso();
  const souMestre = acesso.gestorMestre && acesso.gestorAprovado;
  const [confirmar, setConfirmar] = useState<{ proposta: PropostaListada; decisao: "aprovar" | "recusar" } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);

  if (carregando && !estado) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="aura-card space-y-3 p-5">
            <Esqueleto className="h-4 w-48" />
            <Esqueleto className="h-16 w-full" />
            <Esqueleto className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!estado) {
    return (
      <Alerta
        tom="perigo"
        titulo="Não consegui carregar as propostas"
        descricao={erro ?? "Tente de novo em instantes."}
        acao={
          <Botao tamanho="sm" icone={RefreshCw} onClick={() => void recarregar()}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }

  const iconePorId = new Map(estado.mesas.map((m) => [m.id, m.icone]));
  // O agente criado ganha id próprio; a mesa dele é achada pelo nome.
  const mesaPorNome = new Map(estado.mesas.map((m) => [m.nome, m]));
  const porData = (a: PropostaListada, b: PropostaListada) => b.criadoEm.localeCompare(a.criadoEm);
  const pendentes = estado.propostas.filter((p) => p.status === "proposta").sort(porData);
  const criados = estado.propostas.filter((p) => p.status === "criada" || p.status === "aprovada").sort(porData);
  const recusadas = estado.propostas.filter((p) => p.status === "recusada").sort(porData);

  async function decidir() {
    if (!confirmar) return;
    setEnviando(true);
    setRetorno(null);
    try {
      await comandos.decidir(confirmar.proposta.id, confirmar.decisao);
      setRetorno({
        ok: true,
        texto:
          confirmar.decisao === "aprovar"
            ? `“${confirmar.proposta.nome}” aprovado. Ele ganha uma mesa no escritório na próxima rodada.`
            : `“${confirmar.proposta.nome}” recusado.`,
      });
      setConfirmar(null);
      await recarregar();
    } catch (e) {
      setRetorno({ ok: false, texto: e instanceof Error ? e.message : "Não deu para registrar a decisão." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      {!estado.ativo && (
        <Alerta
          tom="atencao"
          titulo="Equipe aguardando ativação"
          descricao="As propostas começam a chegar quando a equipe estiver ativa (depois da migração 110)."
        />
      )}
      {retorno && <Alerta tom={retorno.ok ? "sucesso" : "perigo"} titulo={retorno.texto} />}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-aura-graphite">Esperando decisão</h2>
          <Selo tom={pendentes.length ? "atencao" : "neutro"}>{pendentes.length}</Selo>
          {!souMestre && pendentes.length > 0 && (
            <span className="ml-auto text-xs text-aura-graphite-soft">Só o gestor mestre aprova ou recusa.</span>
          )}
        </div>
        {pendentes.length === 0 ? (
          <EstadoVazio
            icone={Lightbulb}
            titulo="Nenhuma proposta esperando"
            descricao="Quando um agente vir um buraco que ninguém cobre, ele propõe um agente novo — e a proposta aparece aqui para você decidir."
          />
        ) : (
          <div className="space-y-4">
            {pendentes.map((p) => (
              <CartaoProposta
                key={p.id}
                proposta={p}
                icone={iconePorId.get(p.propostoPor)}
                acoes={
                  souMestre ? (
                    <>
                      <Botao tamanho="sm" variante="fantasma" icone={X} onClick={() => setConfirmar({ proposta: p, decisao: "recusar" })}>
                        Recusar
                      </Botao>
                      <Botao tamanho="sm" variante="primario" icone={Check} onClick={() => setConfirmar({ proposta: p, decisao: "aprovar" })}>
                        Aprovar
                      </Botao>
                    </>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader icone={Sparkles} titulo="Criados pela equipe" descricao="Agentes que nasceram de uma proposta e foram aprovados" />
        {criados.length === 0 ? (
          <EstadoVazio icone={Inbox} titulo="Nenhum agente criado pela equipe ainda" className="py-8" />
        ) : (
          <ul className="divide-y divide-aura-mist">
            {criados.map((p) => {
              const mesa = mesaPorNome.get(p.nome);
              return (
              <li key={p.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <AvatarAgente icone={mesa?.icone ?? "Bot"} tamanho="sm" apagado={mesa?.ativo === false} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-aura-graphite">{p.nome}</p>
                    <p className="truncate text-xs text-aura-graphite-soft">
                      {rotuloSetor(p.setor)} · proposto por {p.propostoPorNome} {haQuanto(p.criadoEm)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-9 sm:pl-0">
                  {p.status === "aprovada" ? (
                    <Selo tom="atencao">Aprovado, entrando na equipe</Selo>
                  ) : (
                    <Selo tom={mesa?.ativo === false ? "neutro" : "sucesso"}>
                      <CheckCircle2 size={11} aria-hidden /> {mesa?.ativo === false ? "Na equipe, desligado" : "Na equipe"}
                    </Selo>
                  )}
                  {p.decididoEm && <span className="text-xs text-aura-graphite-soft">aprovado {dataHora(p.decididoEm)}</span>}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </Card>

      {recusadas.length > 0 && (
        <details className="aura-card group p-5">
          <summary className="cursor-pointer list-none text-sm font-medium text-aura-graphite">
            Recusadas <span className="text-aura-graphite-soft">({recusadas.length})</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {recusadas.map((p) => (
              <li key={p.id} className="text-xs text-aura-graphite-soft">
                <span className="font-medium text-aura-graphite">{p.nome}</span> · proposto por {p.propostoPorNome}
                {p.decididoEm && ` · recusado ${dataHora(p.decididoEm)}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Janela
        aberto={Boolean(confirmar)}
        aoFechar={() => !enviando && setConfirmar(null)}
        titulo={confirmar?.decisao === "aprovar" ? "Aprovar este agente?" : "Recusar esta proposta?"}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setConfirmar(null)} disabled={enviando}>
              Voltar
            </Botao>
            <Botao
              variante={confirmar?.decisao === "aprovar" ? "primario" : "perigo-suave"}
              icone={confirmar?.decisao === "aprovar" ? Check : X}
              onClick={decidir}
              disabled={enviando}
            >
              {enviando ? "Registrando…" : confirmar?.decisao === "aprovar" ? "Sim, aprovar" : "Sim, recusar"}
            </Botao>
          </>
        }
      >
        {confirmar && (
          <div className="space-y-2 text-sm text-aura-graphite">
            <p className="font-medium">{confirmar.proposta.nome}</p>
            {confirmar.decisao === "aprovar" ? (
              <p className="text-aura-graphite-soft">
                Ele passa a ler <strong className="font-medium text-aura-graphite">{FONTES[confirmar.proposta.config.fonte] ?? confirmar.proposta.config.fonte}</strong>{" "}
                {agendaEmPalavras(confirmar.proposta.config.agenda).toLowerCase()} e a mandar até{" "}
                {confirmar.proposta.config.limitePorExecucao} achados por rodada para{" "}
                {(DESTINOS[confirmar.proposta.config.destinatario] ?? confirmar.proposta.config.destinatario).toLowerCase()}.
                Como todo agente, ele só sugere: não manda mensagem a cliente e não muda nenhum dado. Dá para desligá-lo
                a qualquer momento na aba Equipe.
              </p>
            ) : (
              <p className="text-aura-graphite-soft">A proposta fica registrada como recusada e o agente não é criado.</p>
            )}
          </div>
        )}
      </Janela>
    </div>
  );
}

function CartaoProposta({
  proposta: p,
  icone,
  acoes,
}: {
  proposta: PropostaListada;
  icone: string | undefined;
  acoes: ReactNode;
}) {
  const c = p.config;
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <AvatarAgente icone={icone} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-aura-graphite">{p.nome}</h3>
              <Selo tom="marca">{rotuloSetor(p.setor)}</Selo>
            </div>
            <p className="mt-0.5 text-xs text-aura-graphite-soft">
              Proposto por <span className="text-aura-graphite">{p.propostoPorNome}</span> · {haQuanto(p.criadoEm)}
            </p>
          </div>
        </div>
        {acoes && <div className="flex shrink-0 gap-2 self-end sm:self-start">{acoes}</div>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="aura-rotulo mb-1">Missão</p>
            <p className="text-sm leading-relaxed text-aura-graphite">{p.missao}</p>
          </div>
          <div>
            <p className="aura-rotulo mb-1">Por que a equipe pediu</p>
            <p className="text-sm leading-relaxed text-aura-graphite-soft">{p.justificativa}</p>
          </div>
        </div>
        <dl className="grid gap-2.5 rounded-lg bg-aura-sunken/60 p-3.5 text-sm">
          <Item rotulo="Onde olha" valor={FONTES[c.fonte] ?? c.fonte} />
          <Item rotulo="O que procura" valor={c.filtroDescricao || "—"} />
          <Item rotulo="Para quem avisa" valor={DESTINOS[c.destinatario] ?? c.destinatario} />
          <Item rotulo="Frequência" valor={agendaEmPalavras(c.agenda)} />
          <Item rotulo="Limite" valor={`Até ${c.limitePorExecucao} ${c.limitePorExecucao === 1 ? "achado" : "achados"} por rodada`} />
          {c.instrucoes && (
            <details className="text-xs">
              <summary className="cursor-pointer text-aura-graphite-soft hover:text-aura-graphite">Instruções para a IA</summary>
              <p className="mt-1.5 whitespace-pre-line leading-relaxed text-aura-graphite">{c.instrucoes}</p>
            </details>
          )}
        </dl>
      </div>
    </Card>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-aura-graphite-soft">{rotulo}</dt>
      <dd className="text-aura-graphite">{valor}</dd>
    </div>
  );
}
