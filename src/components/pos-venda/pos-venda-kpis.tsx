"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, CalendarClock, ClipboardCheck, Star, Timer } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { StatCard, type Tom } from "@/components/ui";
import { diasEntre, ehVenda, estaAtrasada, estaEmAndamento, temReclamacaoAberta, type Filtro } from "./regras";

const COR_DO_VALOR: Record<Tom, string> = {
  neutro: "text-aura-graphite",
  marca: "text-aura-petrol-600",
  sucesso: "text-aura-success",
  atencao: "text-aura-gold-700",
  perigo: "text-aura-danger",
  ouro: "text-aura-gold-700",
};

/**
 * Número que também é filtro: mesmo visual do StatCard, mas é um botão.
 * Clicar aplica o filtro correspondente; clicar de novo tira.
 */
function KpiFiltro({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "neutro",
  ativo,
  aoClicar,
  dica,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  icone: LucideIcon;
  tom?: Tom;
  ativo: boolean;
  aoClicar: () => void;
  /** O que o clique mostra (vira a dica ao passar o mouse). */
  dica: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      title={ativo ? "Tirar este filtro" : dica}
      className={`aura-card aura-card-interativo p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-petrol-500 ${
        ativo ? "border-aura-petrol-500 ring-1 ring-aura-petrol-500/30" : ""
      }`}
    >
      <span className="flex items-center gap-1.5">
        <Icone size={13} className={COR_DO_VALOR[tom]} aria-hidden />
        <span className="aura-rotulo truncate">{rotulo}</span>
      </span>
      <span className={`mt-2 block font-display text-2xl font-semibold tabular-nums ${COR_DO_VALOR[tom]}`}>{valor}</span>
      {detalhe && <span className="mt-1 block truncate text-xs text-aura-graphite-soft">{detalhe}</span>}
    </button>
  );
}

/**
 * A fileira de números do topo. Tudo calculado aqui, a partir dos campos que
 * já vêm do banco. Cliente antigo não é venda: fica fora da taxa de
 * avaliação, da nota média e do prazo até a instalação.
 */
export function PosVendaKpis({
  itens,
  hoje,
  filtro,
  aoFiltrar,
}: {
  itens: PosVenda[];
  hoje: string;
  filtro: Filtro;
  aoFiltrar: (f: Filtro) => void;
}) {
  const alternar = (f: Filtro) => aoFiltrar(filtro === f ? "todas" : f);

  const emAndamento = itens.filter(estaEmAndamento).length;
  const atrasadas = itens.filter((i) => estaAtrasada(i, hoje)).length;
  const pendentes = itens.filter((i) => i.status === "instalacao_pendente").length;
  const reclamacoes = itens.filter(temReclamacaoAberta).length;

  const vendas = itens.filter(ehVenda);
  const avaliaram = vendas.filter((i) => i.avaliouLoja).length;
  const taxa = vendas.length > 0 ? Math.round((avaliaram / vendas.length) * 100) : null;

  // Soma e divisor do mesmo grupo: antes somava as notas de todos (cliente
  // antigo e quem tinha nota sem "avaliou") e dividia só por quem avaliou,
  // então a média podia passar de 5 ou cair sem motivo.
  const comNota = vendas.filter((i) => i.notaAvaliacao);
  const notaMedia = comNota.length > 0 ? comNota.reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / comNota.length : null;

  // Prazo da venda até a instalação: só nas concluídas, em que a data de
  // agendamento é a data em que a instalação de fato aconteceu.
  const prazos = vendas
    .filter((i) => i.status === "pos_venda_realizado")
    .map((i) => diasEntre(i.dataVenda, i.dataAgendamento))
    .filter((d): d is number => d !== null && d >= 0);
  const prazoMedio = prazos.length > 0 ? Math.round(prazos.reduce((s, d) => s + d, 0) / prazos.length) : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <KpiFiltro
        rotulo="Em andamento"
        valor={emAndamento}
        detalhe={`${vendas.length} venda${vendas.length === 1 ? "" : "s"} no total`}
        icone={Activity}
        tom="marca"
        ativo={filtro === "em_andamento"}
        aoClicar={() => alternar("em_andamento")}
        dica="Ver só as que estão em andamento"
      />
      <KpiFiltro
        rotulo="Atrasadas"
        valor={atrasadas}
        detalhe={pendentes > 0 ? `+ ${pendentes} pendente${pendentes === 1 ? "" : "s"} de reagendar` : "instalações com data vencida"}
        icone={CalendarClock}
        tom={atrasadas > 0 ? "perigo" : "neutro"}
        ativo={filtro === "atrasadas"}
        aoClicar={() => alternar("atrasadas")}
        dica="Ver só as instalações atrasadas"
      />
      <KpiFiltro
        rotulo="Reclamações abertas"
        valor={reclamacoes}
        detalhe={reclamacoes > 0 ? "aguardando solução" : "nenhuma em aberto"}
        icone={AlertTriangle}
        tom={reclamacoes > 0 ? "perigo" : "neutro"}
        ativo={filtro === "reclamacoes"}
        aoClicar={() => alternar("reclamacoes")}
        dica="Ver só as reclamações abertas"
      />
      <KpiFiltro
        rotulo="Taxa de avaliação"
        valor={taxa === null ? "—" : `${taxa}%`}
        detalhe={`${avaliaram} de ${vendas.length} vendas avaliaram`}
        icone={ClipboardCheck}
        tom={taxa !== null && taxa >= 50 ? "sucesso" : "neutro"}
        ativo={filtro === "sem_avaliacao"}
        aoClicar={() => alternar("sem_avaliacao")}
        dica="Ver quem ainda não avaliou"
      />
      <KpiFiltro
        rotulo="Nota média"
        valor={notaMedia === null ? "—" : notaMedia.toFixed(1).replace(".", ",")}
        detalhe={comNota.length > 0 ? `${comNota.length} avaliaç${comNota.length === 1 ? "ão" : "ões"}` : "sem notas ainda"}
        icone={Star}
        tom="ouro"
        ativo={filtro === "avaliadas"}
        aoClicar={() => alternar("avaliadas")}
        dica="Ver só quem avaliou"
      />
      <StatCard
        rotulo="Venda → instalação"
        valor={prazoMedio === null ? "—" : `${prazoMedio} dia${prazoMedio === 1 ? "" : "s"}`}
        detalhe={prazos.length > 0 ? `média de ${prazos.length} concluída${prazos.length === 1 ? "" : "s"}` : "sem concluídas com data"}
        icone={Timer}
      />
    </div>
  );
}
