"use client";

/**
 * Relatório de atendimento dos leads, na tela, para imprimir e em Excel.
 * Recebe os leads já filtrados por loja e vendedor (os filtros da página) e
 * acrescenta o período. Cada número vem de montarLinhas/resumir, os mesmos
 * que vão para o Excel, para a tela e o arquivo nunca discordarem.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { Lead } from "@/lib/supabase/leads";
import { buscarAtividadesDosLeads } from "@/lib/supabase/leads";
import {
  SITUACAO_TEXTO,
  dataBR,
  dataHoraBR,
  formatarDuracao,
  montarLinhas,
  noPeriodo,
  periodoDoAtalho,
  porcentagem,
  resumir,
  resumoPorVendedor,
  type AtalhoPeriodo,
  type AtividadeDoLead,
  type SituacaoAtendimento,
} from "@/lib/leads/atendimento";
import { exportarAtendimentoExcel } from "@/lib/leads/exportar-atendimento";

const ATALHOS: { valor: AtalhoPeriodo; texto: string }[] = [
  { valor: "hoje", texto: "Hoje" },
  { valor: "7_dias", texto: "Últimos 7 dias" },
  { valor: "30_dias", texto: "Últimos 30 dias" },
  { valor: "este_mes", texto: "Este mês" },
  { valor: "mes_passado", texto: "Mês passado" },
  { valor: "tudo", texto: "Tudo" },
  { valor: "escolher", texto: "Escolher datas" },
];

const COR_SITUACAO: Record<SituacaoAtendimento, string> = {
  no_prazo: "text-aura-success",
  fora_do_prazo: "text-aura-warning",
  aguardando: "text-aura-graphite-soft",
  atrasado: "font-medium text-aura-danger",
  perdido_sem_atendimento: "font-medium text-aura-danger",
};

export function RelatorioAtendimento({
  leads,
  nomes,
  lojaTexto,
  vendedorTexto,
}: {
  leads: Lead[];
  nomes: Map<string, string>;
  lojaTexto: string;
  vendedorTexto: string;
}) {
  const [atalho, setAtalho] = useState<AtalhoPeriodo>("este_mes");
  const [inicio, setInicio] = useState(() => periodoDoAtalho("este_mes").inicio);
  const [fim, setFim] = useState(() => periodoDoAtalho("este_mes").fim);
  const [atividades, setAtividades] = useState<Map<string, AtividadeDoLead[]> | null>(null);
  const [gerandoExcel, setGerandoExcel] = useState(false);

  // As atividades dos clientes dizem quando cada lead foi atendido.
  const relIds = useMemo(
    () => [...new Set(leads.map((l) => l.relacionamentoId).filter((id): id is string => Boolean(id)))].sort(),
    [leads],
  );
  const chaveRel = relIds.join(",");
  useEffect(() => {
    let vivo = true;
    setAtividades(null);
    buscarAtividadesDosLeads(relIds).then((m) => {
      if (vivo) setAtividades(m);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveRel]);

  function escolherAtalho(a: AtalhoPeriodo) {
    setAtalho(a);
    if (a !== "escolher") {
      const p = periodoDoAtalho(a);
      setInicio(p.inicio);
      setFim(p.fim);
    }
  }

  const linhas = useMemo(() => {
    if (!atividades) return [];
    return noPeriodo(montarLinhas(leads, nomes, atividades), inicio, fim).sort(
      (a, b) => b.chegouEm.getTime() - a.chegouEm.getTime(),
    );
  }, [leads, nomes, atividades, inicio, fim]);
  const total = useMemo(() => resumir("total", "Total", linhas), [linhas]);
  const porVendedor = useMemo(() => resumoPorVendedor(linhas), [linhas]);

  const periodoTexto =
    !inicio && !fim ? "Todo o histórico" : inicio === fim ? dataBR(inicio) : `${dataBR(inicio) || "início"} a ${dataBR(fim) || "hoje"}`;

  async function baixarExcel() {
    setGerandoExcel(true);
    try {
      await exportarAtendimentoExcel({ loja: lojaTexto, vendedor: vendedorTexto, inicio, fim }, total, porVendedor, linhas);
    } catch (e) {
      console.error("Erro ao gerar o Excel do atendimento:", e);
      window.alert("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setGerandoExcel(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho que só aparece no papel. */}
      <header className="hidden print:block">
        <div className="flex items-end justify-between border-b-2 border-aura-navy-950 pb-2">
          <div>
            <p className="font-display text-xl font-bold text-aura-graphite">Relatório de atendimento dos leads</p>
            <p className="text-[11px] text-aura-graphite-soft">AURA · Grupo MF</p>
          </div>
          <div className="text-right text-[11px] text-aura-graphite-soft">
            <p><strong className="text-aura-graphite">Loja:</strong> {lojaTexto}</p>
            <p><strong className="text-aura-graphite">Vendedor:</strong> {vendedorTexto}</p>
            <p><strong className="text-aura-graphite">Período:</strong> {periodoTexto}</p>
            <p>Gerado em {dataHoraBR(new Date())}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="flex flex-col gap-1 text-xs text-aura-graphite-soft">
          Período
          <select
            value={atalho}
            onChange={(e) => escolherAtalho(e.target.value as AtalhoPeriodo)}
            className="rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite"
          >
            {ATALHOS.map((a) => (
              <option key={a.valor} value={a.valor}>{a.texto}</option>
            ))}
          </select>
        </label>
        {atalho === "escolher" && (
          <>
            <label className="flex flex-col gap-1 text-xs text-aura-graphite-soft">
              De
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-aura-graphite-soft">
              Até
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite" />
            </label>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!atividades}
            className="flex items-center gap-1.5 rounded-full border border-aura-mist bg-white px-3.5 py-1.5 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-50"
          >
            <Printer size={14} />
            Imprimir ou PDF
          </button>
          <button
            type="button"
            onClick={baixarExcel}
            disabled={!atividades || gerandoExcel}
            className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {gerandoExcel ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Baixar Excel
          </button>
        </div>
      </div>

      {!atividades ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-aura-graphite-soft">
          <Loader2 size={18} className="animate-spin" />
          Montando o relatório...
        </div>
      ) : (
        <>
          <p className="text-xs text-aura-graphite-soft print:hidden">
            {lojaTexto} · {vendedorTexto} · {periodoTexto} · pela data em que o lead chegou
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4" data-cartao>
            <Cartao rotulo="Leads recebidos" valor={String(total.recebidos)} />
            <Cartao
              rotulo="Atendidos"
              valor={String(total.atendidos)}
              detalhe={`${porcentagem(total.atendidos, total.recebidos)} dos recebidos`}
            />
            <Cartao
              rotulo="Atendidos no prazo"
              valor={String(total.noPrazo)}
              detalhe={`${porcentagem(total.noPrazo, total.recebidos)} dos recebidos · ${total.foraDoPrazo} fora do prazo`}
            />
            <Cartao
              rotulo="Sem atendimento"
              valor={String(total.semAtendimento)}
              detalhe={`${total.atrasados} com o prazo vencido`}
              alerta={total.atrasados > 0}
            />
          </div>
          <p className="text-xs text-aura-graphite-soft">
            Tempo até o primeiro atendimento (mediana): <strong className="text-aura-graphite">{formatarDuracao(total.medianaMinutos)}</strong>
            {" · "}Perdidos: <strong className="text-aura-graphite">{total.perdidos}</strong>
          </p>

          <section className="rounded-2xl border border-aura-mist bg-white p-4" data-cartao>
            <h2 className="mb-3 text-sm font-semibold text-aura-graphite">Por vendedor</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-aura-mist text-left text-aura-graphite-soft">
                    <th className="py-2 pr-3 font-medium">Vendedor</th>
                    <th className="py-2 pr-3 text-right font-medium">Recebidos</th>
                    <th className="py-2 pr-3 text-right font-medium">Atendidos</th>
                    <th className="py-2 pr-3 text-right font-medium">No prazo</th>
                    <th className="py-2 pr-3 text-right font-medium">Fora do prazo</th>
                    <th className="py-2 pr-3 text-right font-medium">Sem atendimento</th>
                    <th className="py-2 pr-3 text-right font-medium">Perdidos</th>
                    <th className="py-2 text-right font-medium">Tempo até atender</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porVendedor, total].map((r) => (
                    <tr key={r.chave} className={`border-b border-aura-mist/60 ${r.chave === "total" ? "font-semibold" : ""}`}>
                      <td className="py-2 pr-3 text-aura-graphite">{r.nome}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.recebidos}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.atendidos} <span className="text-aura-graphite-soft">({porcentagem(r.atendidos, r.recebidos)})</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.noPrazo} <span className="text-aura-graphite-soft">({porcentagem(r.noPrazo, r.recebidos)})</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.foraDoPrazo}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${r.atrasados ? "text-aura-danger" : ""}`}>
                        {r.semAtendimento}
                        {r.atrasados ? <span className="text-aura-graphite-soft"> ({r.atrasados} vencidos)</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.perdidos}</td>
                      <td className="py-2 text-right tabular-nums">{formatarDuracao(r.medianaMinutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-aura-mist bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-aura-graphite">Lead por lead ({linhas.length})</h2>
            {linhas.length === 0 ? (
              <p className="py-6 text-center text-sm text-aura-graphite-soft">Nenhum lead chegou neste período com esses filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-aura-mist text-left text-aura-graphite-soft">
                      <th className="py-2 pr-3 font-medium">Chegou</th>
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 font-medium">Vendedor</th>
                      <th className="py-2 pr-3 font-medium">Origem</th>
                      <th className="py-2 pr-3 font-medium">Atendido em</th>
                      <th className="py-2 pr-3 text-right font-medium">Levou</th>
                      <th className="py-2 pr-3 font-medium">Como</th>
                      <th className="py-2 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.lead.id} className="border-b border-aura-mist/60 align-top">
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{dataHoraBR(l.chegouEm)}</td>
                        <td className="py-2 pr-3">
                          <span className="text-aura-graphite">{l.lead.nome || "Contato novo"}</span>
                          <span className="block text-aura-graphite-soft">{l.lead.telefone}</span>
                        </td>
                        <td className="py-2 pr-3">
                          {l.vendedor}
                          <span className="block text-aura-graphite-soft">{l.lead.empresa}</span>
                        </td>
                        <td className="py-2 pr-3">{l.lead.origem}</td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{dataHoraBR(l.atendidoEm)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{formatarDuracao(l.minutosAteAtender)}</td>
                        <td className="py-2 pr-3">{l.como ?? "—"}</td>
                        <td className={`py-2 ${COR_SITUACAO[l.situacao]}`}>
                          {SITUACAO_TEXTO[l.situacao]}
                          {l.lead.motivoPerda ? <span className="block text-aura-graphite-soft">Motivo: {l.lead.motivoPerda}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-[11px] leading-relaxed text-aura-graphite-soft">
            <strong>Atendido</strong> é o que aconteceu primeiro depois que o lead chegou: a vendedora mandou mensagem pelo
            WhatsApp ligado na AURA, tocou em &quot;Marcar como respondido&quot; ou registrou uma atividade com o cliente.
            A atividade que a IA cria sozinha ao abrir a oportunidade não conta. <strong>No prazo</strong> é atender antes do
            prazo de resposta do lead. Quem responde pelo celular com o WhatsApp desconectado da AURA aparece como sem
            atendimento até registrar o contato.
          </p>
        </>
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${alerta ? "border-aura-danger/40" : "border-aura-mist"}`}>
      <p className="text-xs text-aura-graphite-soft">{rotulo}</p>
      <p className={`font-display text-2xl font-semibold tabular-nums ${alerta ? "text-aura-danger" : "text-aura-graphite"}`}>{valor}</p>
      {detalhe && <p className="text-[11px] text-aura-graphite-soft">{detalhe}</p>}
    </div>
  );
}
