"use client";

import { useState } from "react";
import { CalendarPlus, Check, CheckCircle2, Database, MessageCircle, Plus, X } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import {
  ROTULO_TIPO,
  agendarManutencao,
  cancelarManutencao,
  concluirManutencao,
  criarManutencao,
  somarMeses,
  type ResultadoManutencao,
  type TipoManutencao,
} from "@/lib/supabase/pos-venda-manutencao";
import { Alerta, Botao, Selo, classeBotao } from "@/components/ui";
import { diaDaSemana, diaDoMomento, diasEntre, formatarDia, formatarHora, somarDias } from "./regras";
import { alvoDe, dataDaManutencao, estaAberta, linkWhatsAppLimpeza, type ItemManutencao } from "./regras-manutencao";

/** Explicação única para os botões que dependem da tabela de manutenções. */
export const MOTIVO_SEM_TABELA =
  "Agendar e registrar ligam quando o cadastro de manutenções for ativado no banco.";

/** Aviso discreto no topo da seção enquanto a tabela não existe. */
export function AvisoSemTabela() {
  return (
    <Alerta
      tom="info"
      icone={Database}
      titulo="Mostrando a previsão calculada"
      descricao={
        <>
          Cada instalação concluída prevê uma limpeza de chaminé 12 meses depois. Por enquanto é só leitura:{" "}
          {MOTIVO_SEM_TABELA.charAt(0).toLowerCase() + MOTIVO_SEM_TABELA.slice(1)} O WhatsApp já funciona.
        </>
      }
    />
  );
}

/** Quadradinho com o dia, como numa agenda de papel. */
function Dia({ dia, vencido }: { dia: string; vencido: boolean }) {
  const [, mes, d] = dia.split("-");
  return (
    <span
      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none ${
        vencido ? "border-aura-danger/40 bg-aura-danger/5" : "border-aura-mist bg-aura-sunken/60"
      }`}
      aria-hidden
    >
      <span className={`text-[0.625rem] uppercase ${vencido ? "text-aura-danger" : "text-aura-graphite-soft"}`}>
        {diaDaSemana(dia)}
      </span>
      <span className={`mt-0.5 text-sm font-semibold tabular-nums ${vencido ? "text-aura-danger" : "text-aura-graphite"}`}>
        {d}
      </span>
      <span className="text-[0.5625rem] tabular-nums text-aura-graphite-soft">{mes}</span>
    </span>
  );
}

/** Link do WhatsApp com a mensagem da limpeza pronta (ou botão apagado sem telefone). */
export function BotaoWhatsAppLimpeza({ posVenda, tipo }: { posVenda: PosVenda; tipo?: TipoManutencao }) {
  const link = linkWhatsAppLimpeza(posVenda, tipo);
  if (!link) {
    return (
      <Botao tamanho="sm" icone={MessageCircle} disabled title="Sem telefone salvo para este cliente">
        WhatsApp
      </Botao>
    );
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={classeBotao("secundario", "sm", "text-aura-success")}
      aria-label={`Chamar ${posVenda.cliente} no WhatsApp para a manutenção`}
    >
      <MessageCircle size={13} aria-hidden />
      WhatsApp
    </a>
  );
}

type Acao = "agendar" | "concluir" | "cancelar";

/**
 * Uma manutenção na lista: dia, cliente, o que é e as ações (Agendar, Marcar
 * como feita, WhatsApp, Cancelar). Cada ação abre um painelzinho embaixo da
 * linha, sem janela por cima — no celular fica mais fácil.
 */
export function LinhaManutencao({
  item,
  hoje,
  mostrarLoja,
  disponivel,
  aoAbrirCliente,
  aoMudou,
}: {
  item: ItemManutencao;
  hoje: string;
  mostrarLoja: boolean;
  disponivel: boolean;
  aoAbrirCliente: (pv: PosVenda) => void;
  aoMudou: () => Promise<void>;
}) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dia = dataDaManutencao(item);
  const [data, setData] = useState(dia >= hoje ? dia : hoje);
  const [hora, setHora] = useState(item.hora ?? "");
  const [texto, setTexto] = useState("");

  const aberta = estaAberta(item);
  const vencida = aberta && dia < hoje;
  const atraso = vencida ? diasEntre(dia, hoje) : null;
  const pv = item.posVenda;

  function alternar(nova: Acao) {
    setErro(null);
    setTexto("");
    setAcao((atual) => (atual === nova ? null : nova));
  }

  async function executar(fn: () => Promise<ResultadoManutencao>) {
    setEnviando(true);
    setErro(null);
    const r = await fn();
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setAcao(null);
    await aoMudou();
  }

  const confirmar = () => {
    const alvo = alvoDe(item);
    if (acao === "agendar") return executar(() => agendarManutencao(alvo, data, hora || null));
    if (acao === "concluir")
      return executar(() =>
        concluirManutencao(alvo, { tipo: item.tipo, posVendaId: pv.id, empresa: pv.empresa, observacao: texto })
      );
    if (acao === "cancelar") return executar(() => cancelarManutencao(alvo, texto));
  };

  const semTabela = disponivel ? undefined : MOTIVO_SEM_TABELA;

  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {item.status === "realizada" ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-aura-success/10" aria-hidden>
              <CheckCircle2 size={18} className="text-aura-success" />
            </span>
          ) : (
            <Dia dia={dia} vencido={vencida} />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => aoAbrirCliente(pv)}
                className="truncate text-left text-sm font-medium text-aura-graphite hover:text-aura-petrol-600"
              >
                {pv.cliente}
              </button>
              {item.status === "agendada" && <Selo tom="marca">Agendada</Selo>}
              {!item.registro && (
                <span title="Calculada pela data da instalação + 12 meses">
                  <Selo>Previsão</Selo>
                </span>
              )}
              {mostrarLoja && <Selo>{pv.empresa}</Selo>}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-aura-graphite-soft">
              <span>{ROTULO_TIPO[item.tipo]}</span>
              {pv.produto && pv.produto !== "Cliente antigo" && <span className="max-w-[12rem] truncate">{pv.produto}</span>}
              {pv.telefone && <span className="tabular-nums">{pv.telefone}</span>}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums">
              {item.status === "realizada" ? (
                <span className="text-aura-success">
                  Feita em {formatarDia(diaDoMomento(item.realizadaEm) ?? dia)}
                </span>
              ) : item.status === "agendada" && item.dataAgendada ? (
                <span className={vencida ? "font-medium text-aura-danger" : "text-aura-graphite"}>
                  Agendada {formatarDia(item.dataAgendada)}
                  {item.hora ? ` · ${formatarHora(item.hora)}` : ""}
                  <span className="text-aura-graphite-soft"> (prevista {formatarDia(item.dataPrevista, true)})</span>
                </span>
              ) : (
                <span className={vencida ? "font-medium text-aura-danger" : "text-aura-graphite"}>
                  Prevista {formatarDia(item.dataPrevista)}
                </span>
              )}
              {atraso !== null && (
                <span className="font-medium text-aura-danger">
                  vencida há {atraso} dia{atraso === 1 ? "" : "s"}
                </span>
              )}
            </p>
            {item.observacao && <p className="mt-1 text-xs text-aura-graphite-soft">“{item.observacao}”</p>}
          </div>
        </div>

        {aberta && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Botao
              tamanho="sm"
              icone={CalendarPlus}
              onClick={() => alternar("agendar")}
              disabled={!disponivel}
              title={semTabela}
              aria-expanded={acao === "agendar"}
            >
              {item.status === "agendada" ? "Remarcar" : "Agendar"}
            </Botao>
            <Botao
              tamanho="sm"
              icone={Check}
              onClick={() => alternar("concluir")}
              disabled={!disponivel}
              title={semTabela}
              aria-expanded={acao === "concluir"}
            >
              Marcar como feita
            </Botao>
            <BotaoWhatsAppLimpeza posVenda={pv} tipo={item.tipo} />
            <Botao
              tamanho="sm"
              variante="fantasma"
              icone={X}
              onClick={() => alternar("cancelar")}
              disabled={!disponivel}
              title={semTabela}
              aria-expanded={acao === "cancelar"}
            >
              Cancelar
            </Botao>
          </div>
        )}
      </div>

      {acao && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmar();
          }}
          className="mt-3 flex flex-col gap-3 rounded-lg border border-aura-mist bg-aura-sunken/50 p-3 sm:ml-14"
        >
          {acao === "agendar" && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <div>
                <label className="aura-label" htmlFor={`m-data-${item.chave}`}>Dia</label>
                <input
                  id={`m-data-${item.chave}`}
                  type="date"
                  required
                  min={hoje}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="aura-input"
                />
              </div>
              <div>
                <label className="aura-label" htmlFor={`m-hora-${item.chave}`}>Hora</label>
                <input
                  id={`m-hora-${item.chave}`}
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="aura-input"
                />
              </div>
            </div>
          )}
          {(acao === "concluir" || acao === "cancelar") && (
            <div>
              <label className="aura-label" htmlFor={`m-obs-${item.chave}`}>
                {acao === "concluir" ? "Observação (opcional)" : "Motivo (opcional)"}
              </label>
              <input
                id={`m-obs-${item.chave}`}
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={
                  acao === "concluir"
                    ? "Ex.: chaminé com pouca fuligem, vedação trocada"
                    : "Ex.: cliente não usa mais a lareira"
                }
                className="aura-input"
              />
              {acao === "concluir" && ["limpeza_chamine", "revisao"].includes(item.tipo) && (
                <p className="mt-1.5 text-xs text-aura-graphite-soft">
                  A próxima fica prevista para {formatarDia(somarMeses(hoje, 12))}, um ano depois de hoje.
                </p>
              )}
            </div>
          )}
          {erro && (
            <p role="alert" className="text-xs text-aura-danger">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" tamanho="sm" variante={acao === "cancelar" ? "perigo-suave" : "primario"} disabled={enviando}>
              {enviando
                ? "Salvando..."
                : acao === "agendar"
                  ? "Salvar agendamento"
                  : acao === "concluir"
                    ? "Confirmar que foi feita"
                    : "Cancelar esta manutenção"}
            </Botao>
            <Botao tamanho="sm" variante="fantasma" onClick={() => setAcao(null)} disabled={enviando}>
              Voltar
            </Botao>
          </div>
        </form>
      )}
    </li>
  );
}

/**
 * "Programar primeira limpeza": para quem não tem previsão (cliente antigo,
 * sem data de instalação). Escolhe o dia e cria a manutenção prevista.
 */
export function ProgramarLimpeza({
  posVenda,
  hoje,
  disponivel,
  aoMudou,
}: {
  posVenda: PosVenda;
  hoje: string;
  disponivel: boolean;
  aoMudou: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(somarDias(hoje, 30));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await criarManutencao({
      posVendaId: posVenda.id,
      empresa: posVenda.empresa,
      tipo: "limpeza_chamine",
      dataPrevista: data,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setAberto(false);
    await aoMudou();
  }

  if (!aberto) {
    return (
      <Botao
        tamanho="sm"
        icone={CalendarPlus}
        onClick={() => setAberto(true)}
        disabled={!disponivel}
        title={disponivel ? undefined : MOTIVO_SEM_TABELA}
      >
        Programar primeira limpeza
      </Botao>
    );
  }

  return (
    <form onSubmit={salvar} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="aura-label" htmlFor={`prog-${posVenda.id}`}>Previsão da limpeza</label>
        <input
          id={`prog-${posVenda.id}`}
          type="date"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="aura-input"
        />
      </div>
      <Botao type="submit" tamanho="sm" variante="primario" disabled={enviando}>
        {enviando ? "Salvando..." : "Programar"}
      </Botao>
      <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(false)} disabled={enviando}>
        Voltar
      </Botao>
      {erro && (
        <p role="alert" className="w-full text-xs text-aura-danger">
          {erro}
        </p>
      )}
    </form>
  );
}

/** Formulário de manutenção avulsa: escolhe o cliente, o tipo e a data. */
export function NovaManutencao({
  clientes,
  hoje,
  aoMudou,
  aoFechar,
}: {
  clientes: PosVenda[];
  hoje: string;
  aoMudou: () => Promise<void>;
  aoFechar: () => void;
}) {
  const [posVendaId, setPosVendaId] = useState("");
  const [tipo, setTipo] = useState<TipoManutencao>("limpeza_chamine");
  const [data, setData] = useState(somarDias(hoje, 7));
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const pv = clientes.find((c) => c.id === posVendaId);
    if (!pv) {
      setErro("Escolha o cliente.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const r = await criarManutencao({ posVendaId: pv.id, empresa: pv.empresa, tipo, dataPrevista: data, observacao });
    setEnviando(false);
    if (!r.ok) {
      // 23505: já existe uma em aberto do mesmo tipo para este cliente.
      setErro(r.disponivel ? `${r.erro} Se já existe uma em aberto do mesmo tipo, remarque aquela.` : r.erro);
      return;
    }
    await aoMudou();
    aoFechar();
  }

  return (
    <form onSubmit={salvar} className="aura-card flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-aura-graphite">
        <Plus size={15} className="text-aura-petrol-600" aria-hidden />
        Nova manutenção
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="aura-label" htmlFor="nova-m-cliente">Cliente</label>
          <select
            id="nova-m-cliente"
            required
            value={posVendaId}
            onChange={(e) => setPosVendaId(e.target.value)}
            className="aura-input"
          >
            <option value="">Escolha…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cliente}
                {c.produto && c.produto !== "Cliente antigo" ? ` · ${c.produto}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="aura-label" htmlFor="nova-m-tipo">Tipo</label>
          <select
            id="nova-m-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoManutencao)}
            className="aura-input"
          >
            {(Object.keys(ROTULO_TIPO) as TipoManutencao[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="aura-label" htmlFor="nova-m-data">Previsão</label>
          <input
            id="nova-m-data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="aura-input"
          />
        </div>
      </div>
      <div>
        <label className="aura-label" htmlFor="nova-m-obs">Observação (opcional)</label>
        <input
          id="nova-m-obs"
          type="text"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: cliente pediu revisão da porta de vidro"
          className="aura-input"
        />
      </div>
      {erro && (
        <p role="alert" className="text-xs text-aura-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="primario" tamanho="sm" disabled={enviando}>
          {enviando ? "Salvando..." : "Criar manutenção"}
        </Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={aoFechar} disabled={enviando}>
          Fechar
        </Botao>
      </div>
    </form>
  );
}
