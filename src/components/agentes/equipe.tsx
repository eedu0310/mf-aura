"use client";

/**
 * EQUIPE: a lista de todos os agentes, por setor, para quem quer a visão de
 * planilha — tipo, quem criou, agenda, estado, achados e gasto x orçamento.
 * O gestor mestre liga/desliga e muda o orçamento na própria linha.
 */
import { useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import type { MesaAgente } from "@/lib/agentes/tipos";
import { Alerta, Botao, EstadoVazio, Selo } from "@/components/ui";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import {
  AvatarAgente,
  BarraOrcamento,
  CRIADO_POR,
  ESTADOS,
  Esqueleto,
  LuzStatus,
  SETORES,
  TIPOS_AGENTE,
  dolar,
  numero,
  useEscritorio,
} from "./comum";
import { ChaveAtivo, EditorOrcamento } from "./controles";
import { GavetaAgente } from "./gaveta-agente";

export function EquipeAgentes() {
  const { estado, erro, carregando, recarregar } = useEscritorio();
  const acesso = usarMeuAcesso();
  const souMestre = acesso.gestorMestre && acesso.gestorAprovado;
  const [abertoId, setAbertoId] = useState<string | null>(null);

  if (carregando && !estado) {
    return (
      <div className="aura-card space-y-3 p-5" aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Esqueleto key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!estado) {
    return (
      <Alerta
        tom="perigo"
        titulo="Não consegui carregar a equipe"
        descricao={erro ?? "Tente de novo em instantes."}
        acao={
          <Botao tamanho="sm" icone={RefreshCw} onClick={() => void recarregar()}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }

  const mesas = estado.mesas;
  const equipeAtiva = estado.ativo;
  const grupos = [
    ...SETORES.map((s) => ({ id: s.id as string, rotulo: s.rotulo, mesas: mesas.filter((m) => m.setor === s.id) })),
    { id: "outros", rotulo: "Outros", mesas: mesas.filter((m) => !SETORES.some((s) => s.id === m.setor)) },
  ].filter((g) => g.mesas.length > 0);
  const aberta = mesas.find((m) => m.id === abertoId) ?? null;

  if (mesas.length === 0) {
    return <EstadoVazio icone={Bot} titulo="Nenhum agente na equipe ainda" descricao="A lista aparece quando o servidor registrar os agentes." />;
  }

  return (
    <div className="space-y-4">
      {!equipeAtiva && (
        <Alerta
          tom="atencao"
          titulo="Equipe aguardando ativação"
          descricao="Os comandos (ligar, desligar, orçamento) liberam depois que a migração 108 for autorizada e aplicada no banco."
        />
      )}
      {erro && <Alerta tom="atencao" titulo="A última atualização falhou" descricao={erro} />}

      {/* Tabela no computador; cartões empilhados no celular. */}
      <div className="aura-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="aura-tabela">
            <thead>
              <tr>
                <th className="text-left">Agente</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Agenda</th>
                <th className="text-left">Estado</th>
                <th className="text-right">Achados</th>
                <th className="text-left">Custo 30d / orçamento</th>
                {souMestre && <th className="text-center">Ligado</th>}
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g.id}>
                <tr>
                  <td colSpan={souMestre ? 7 : 6} className="!bg-aura-sunken/50 !py-1.5">
                    <span className="aura-rotulo">{g.rotulo}</span>
                    <span className="ml-2 text-xs text-aura-graphite-soft">{g.mesas.length}</span>
                  </td>
                </tr>
                {g.mesas.map((m) => (
                  <Linha
                    key={m.id}
                    mesa={m}
                    souMestre={souMestre}
                    equipeAtiva={equipeAtiva}
                    aoAbrir={setAbertoId}
                    aoMudar={recarregar}
                  />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <div className="space-y-5 md:hidden">
        {grupos.map((g) => (
          <section key={g.id}>
            <p className="aura-rotulo mb-2">
              {g.rotulo} · {g.mesas.length}
            </p>
            <div className="space-y-2">
              {g.mesas.map((m) => (
                <CartaoAgente
                  key={m.id}
                  mesa={m}
                  souMestre={souMestre}
                  equipeAtiva={equipeAtiva}
                  aoAbrir={setAbertoId}
                  aoMudar={recarregar}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <GavetaAgente
        mesa={aberta}
        falas={estado.falas}
        equipeAtiva={equipeAtiva}
        souMestre={souMestre}
        aoFechar={() => setAbertoId(null)}
        aoMudar={recarregar}
      />
    </div>
  );
}

interface PropsLinha {
  mesa: MesaAgente;
  souMestre: boolean;
  equipeAtiva: boolean;
  aoAbrir: (id: string) => void;
  aoMudar: () => void | Promise<void>;
}

function NomeAgente({ mesa, aoAbrir }: { mesa: MesaAgente; aoAbrir: (id: string) => void }) {
  return (
    <button type="button" onClick={() => aoAbrir(mesa.id)} className="flex min-w-0 items-center gap-2.5 text-left">
      <AvatarAgente icone={mesa.icone} tamanho="sm" apagado={!mesa.ativo} destaque={mesa.setor === "direcao"} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-aura-graphite hover:text-aura-petrol-600">{mesa.nome}</span>
        <span className="block truncate text-xs text-aura-graphite-soft">{mesa.cargo}</span>
      </span>
    </button>
  );
}

function Linha({ mesa, souMestre, equipeAtiva, aoAbrir, aoMudar }: PropsLinha) {
  const e = ESTADOS[mesa.estado] ?? ESTADOS.ocioso;
  return (
    <tr>
      <td className="max-w-[16rem]">
        <NomeAgente mesa={mesa} aoAbrir={aoAbrir} />
      </td>
      <td>
        <span className="block text-xs text-aura-graphite">{TIPOS_AGENTE[mesa.tipo] ?? mesa.tipo}</span>
        <span className="block text-[0.6875rem] text-aura-graphite-soft">por {CRIADO_POR[mesa.criadoPor] ?? mesa.criadoPor}</span>
      </td>
      <td className="text-xs text-aura-graphite-soft">{mesa.agendaTexto || "—"}</td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-xs text-aura-graphite">
          <LuzStatus estado={mesa.estado} className="!h-2 !w-2" />
          {e.rotulo}
        </span>
      </td>
      <td className="text-right text-xs tabular-nums">
        <span className={mesa.achadosAbertos > 0 ? "text-aura-gold-700" : "text-aura-graphite"}>{numero(mesa.achadosAbertos)}</span>
        <span className="text-aura-graphite-soft"> abertos · {numero(mesa.achadosResolvidos30d)} resolvidos</span>
      </td>
      <td className="min-w-[11rem]">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums text-aura-graphite">{dolar(mesa.custo30dUsd)}</span>
          <span className="text-aura-graphite-soft">
            <EditorOrcamento mesa={mesa} podeEditar={souMestre && equipeAtiva} aoMudar={aoMudar} />
          </span>
        </div>
        <BarraOrcamento gasto={mesa.custo30dUsd} orcamento={mesa.orcamentoMensalUsd} className="mt-1.5" />
      </td>
      {souMestre && (
        <td className="text-center">
          <ChaveAtivo mesa={mesa} habilitado={equipeAtiva} aoMudar={aoMudar} />
        </td>
      )}
    </tr>
  );
}

function CartaoAgente({ mesa, souMestre, equipeAtiva, aoAbrir, aoMudar }: PropsLinha) {
  const e = ESTADOS[mesa.estado] ?? ESTADOS.ocioso;
  return (
    <div className="aura-card space-y-3 p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <NomeAgente mesa={mesa} aoAbrir={aoAbrir} />
        </div>
        {souMestre && <ChaveAtivo mesa={mesa} habilitado={equipeAtiva} aoMudar={aoMudar} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={e.tom}>
          <LuzStatus estado={mesa.estado} className="!h-2 !w-2" />
          {e.rotulo}
        </Selo>
        <Selo>{TIPOS_AGENTE[mesa.tipo] ?? mesa.tipo}</Selo>
        <Selo>por {CRIADO_POR[mesa.criadoPor] ?? mesa.criadoPor}</Selo>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-aura-graphite-soft">Agenda</dt>
          <dd className="text-aura-graphite">{mesa.agendaTexto || "—"}</dd>
        </div>
        <div>
          <dt className="text-aura-graphite-soft">Achados</dt>
          <dd className="tabular-nums text-aura-graphite">
            {numero(mesa.achadosAbertos)} abertos · {numero(mesa.achadosResolvidos30d)} resolvidos
          </dd>
        </div>
      </dl>
      <div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums text-aura-graphite">{dolar(mesa.custo30dUsd)} em 30 dias</span>
          <span className="text-aura-graphite-soft">
            <EditorOrcamento mesa={mesa} podeEditar={souMestre && equipeAtiva} aoMudar={aoMudar} />
          </span>
        </div>
        <BarraOrcamento gasto={mesa.custo30dUsd} orcamento={mesa.orcamentoMensalUsd} className="mt-1.5" />
      </div>
    </div>
  );
}
