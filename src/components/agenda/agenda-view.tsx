"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock } from "lucide-react";
import { PageContainer, PageHeader, Card, CardHeader, Botao, classeBotao, Selo, EstadoVazio } from "@/components/ui";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { ConectarCalendario } from "./conectar-calendario";
import { useAppData } from "@/lib/app-data-context";
import { CompromissoModal } from "./compromisso-modal";
import {
  criarCompromisso,
  listarCompromissos,
  type Compromisso,
} from "@/lib/supabase/compromissos";
import { parseDataLocal } from "@/lib/date-local";

/**
 * A agenda mostra o que ainda vai acontecer, não o que já aconteceu.
 *
 * Antes ela listava TODA atividade do dia, incluindo as que o sistema grava
 * sozinho ("Oportunidade movida: Proposta → Fechados", "Atendimento pelo
 * WhatsApp"). Era isso que aparecia como anotação solta no meio dos
 * compromissos.
 */
const TIPOS_DE_AGENDA = ["Visita", "Reunião"];

function ehCompromissoReal(a: { tipo?: string; titulo?: string; origem?: string }) {
  if (!TIPOS_DE_AGENDA.includes(a.tipo ?? "")) return false;
  // Registro automático não é compromisso, mesmo quando o tipo bate.
  if (a.origem === "automatica") return false;
  if (/oportunidade movida|criada pela ia|atendimento pelo whatsapp/i.test(a.titulo ?? "")) return false;
  return true;
}

/**
 * Distancia em dias de CALENDARIO, nao em horas. Comparar com `new Date()`
 * fazia o compromisso das 07h de hoje cair em "Amanha" as 10h: a diferenca
 * ficava negativa e o arredondamento para cima a empurrava de volta.
 */
function diasAteODia(data: Date) {
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function AgendaView() {
  const { atividades, relacionamentos } = useAppData();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [modalAberto, setModalAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);

  const todasAtividades = Array.isArray(atividades) ? atividades : [];

  function dataLocal(data: Date) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function dataAgenda(atividade: any) {
    return atividade.proximoContatoEm || atividade.quando || atividade.criadoEm;
  }

  async function carregarCompromissos() {
    const dados = await listarCompromissos();
    if (dados) setCompromissos(dados);
  }

  useEffect(() => {
    void carregarCompromissos();
  }, []);

  // ========== CALENDÁRIO ==========
  const diasMes = useMemo(() => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasAntes = primeiroDia.getDay();
    const diasDepois = 6 - ultimoDia.getDay();

    const dias: (Date | null)[] = [];

    // Dias do mês anterior
    for (let i = diasAntes - 1; i >= 0; i--) {
      dias.push(new Date(ano, mes, -i));
    }

    // Dias do mês atual
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push(new Date(ano, mes, i));
    }

    // Dias do mês próximo
    for (let i = 1; i <= diasDepois; i++) {
      dias.push(new Date(ano, mes + 1, i));
    }

    return dias;
  }, [mesAtual]);

  // ========== ATIVIDADES DO DIA SELECIONADO ==========
  const atividadesDia = useMemo(() => {
    if (!diaSelecionado) {
      const hoje = new Date();
      return todasAtividades
        .filter(ehCompromissoReal)
        .filter((a) => {
          const data = parseDataLocal(dataAgenda(a));
          return (
            data.getDate() === hoje.getDate() &&
            data.getMonth() === hoje.getMonth() &&
            data.getFullYear() === hoje.getFullYear()
          );
        })
        .sort((a, b) => {
          const dataA = parseDataLocal(dataAgenda(a)).getTime();
          const dataB = parseDataLocal(dataAgenda(b)).getTime();
          return dataA - dataB;
        });
    }

    return todasAtividades
      .filter(ehCompromissoReal)
      .filter((a) => {
        const data = parseDataLocal(dataAgenda(a));
        return (
          data.getDate() === diaSelecionado.getDate() &&
          data.getMonth() === diaSelecionado.getMonth() &&
          data.getFullYear() === diaSelecionado.getFullYear()
        );
      })
      .sort((a, b) => {
        const dataA = parseDataLocal(dataAgenda(a)).getTime();
        const dataB = parseDataLocal(dataAgenda(b)).getTime();
        return dataA - dataB;
      });
  }, [diaSelecionado, todasAtividades]);

  const compromissosDia = useMemo(() => {
    const alvo = diaSelecionado ?? new Date();
    const data = dataLocal(alvo);
    return compromissos.filter((item) => item.data === data);
  }, [compromissos, diaSelecionado]);

  /**
   * Follow-up marcado é compromisso: o vendedor prometeu voltar a falar com
   * o cliente naquele dia. Antes isso não aparecia na agenda em lugar
   * nenhum — só na lista de relacionamentos, onde é fácil passar batido.
   * O que venceu e não foi feito continua aparecendo, marcado como atrasado.
   */
  const followupsDia = useMemo(() => {
    const alvo = dataLocal(diaSelecionado ?? new Date());
    const hoje = dataLocal(new Date());
    return (relacionamentos ?? [])
      .filter((r) => {
        const quando = (r.proximoContatoEm ?? "").slice(0, 10);
        if (!quando) return false;
        // No dia de hoje, mostra também o que ficou para trás.
        return alvo === hoje ? quando <= alvo : quando === alvo;
      })
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        quando: (r.proximoContatoEm ?? "").slice(0, 10),
        atrasado: (r.proximoContatoEm ?? "").slice(0, 10) < hoje,
      }))
      .sort((a, b) => a.quando.localeCompare(b.quando));
  }, [relacionamentos, diaSelecionado]);

  // ========== PRÓXIMAS ATIVIDADES (PRÓXIMOS 7 DIAS) ==========
  const proximasAtividades = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const semanaDepois = new Date(hoje);
    semanaDepois.setDate(semanaDepois.getDate() + 7);

    return todasAtividades
      .filter(ehCompromissoReal)
      .filter((a) => {
        const data = parseDataLocal(dataAgenda(a));
        data.setHours(0, 0, 0, 0);
        return data >= hoje && data <= semanaDepois;
      })
      .sort((a, b) => {
        const dataA = parseDataLocal(dataAgenda(a)).getTime();
        const dataB = parseDataLocal(dataAgenda(b)).getTime();
        return dataA - dataB;
      })
      .slice(0, 10);
  }, [todasAtividades]);

  // ========== CONTAR ATIVIDADES POR DIA ==========
  function contarAtividadesDia(dia: Date | null): number {
    if (!dia) return 0;

    const atividadesCount = todasAtividades.filter(ehCompromissoReal).filter((a) => {
      const data = parseDataLocal(dataAgenda(a));
      return (
        data.getDate() === dia.getDate() &&
        data.getMonth() === dia.getMonth() &&
        data.getFullYear() === dia.getFullYear()
      );
    }).length;
    const compromissosCount = compromissos.filter((item) => {
      const data = dataLocal(dia);
      return item.data === data;
    }).length;
    return atividadesCount + compromissosCount;
  }

  function isHoje(dia: Date | null): boolean {
    if (!dia) return false;
    const hoje = new Date();
    return (
      dia.getDate() === hoje.getDate() &&
      dia.getMonth() === hoje.getMonth() &&
      dia.getFullYear() === hoje.getFullYear()
    );
  }

  function mesAnterior() {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1));
  }

  function mesProximo() {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1));
  }

  function formatarData(data: Date | string): string {
    const d = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? parseDataLocal(data) : new Date(data);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatarHora(data: Date | string): string {
    const d = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? parseDataLocal(data) : new Date(data);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const nomeMes = mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <PageContainer>
      <PageHeader
        titulo="Agenda"
        descricao="Organize seus contatos e próximas atividades."
        icone={Calendar}
        acoes={
          <Botao variante="primario" icone={Plus} onClick={() => setModalAberto(true)}>
            Agendar
          </Botao>
        }
      />

      <div className="space-y-6">
        <AuraInsightCard pagina="agenda" />

        <ConectarCalendario />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* CALENDÁRIO */}
          <Card className="lg:col-span-1">
            {/* Controles do Mês */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={mesAnterior}
                aria-label="Mês anterior"
                className={classeBotao("fantasma", "sm", "w-8 px-0")}
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold capitalize text-aura-graphite">{nomeMes}</p>
              <button
                onClick={mesProximo}
                aria-label="Próximo mês"
                className={classeBotao("fantasma", "sm", "w-8 px-0")}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Dias da Semana */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {diasSemana.map((dia) => (
                <div key={dia} className="aura-rotulo py-2 text-center">
                  {dia}
                </div>
              ))}
            </div>

            {/* Dias do Mês */}
            <div className="grid grid-cols-7 gap-1">
              {diasMes.map((dia, idx) => {
                if (!dia) return <div key={`vazio-${idx}`} className="aspect-square" />;

                const atividades = contarAtividadesDia(dia);
                const ehHoje = isHoje(dia);
                const ehSelecionado = diaSelecionado &&
                  diaSelecionado.getFullYear() === dia.getFullYear() &&
                  diaSelecionado.getMonth() === dia.getMonth() &&
                  diaSelecionado.getDate() === dia.getDate();
                const mesCorreto = dia.getMonth() === mesAtual.getMonth();

                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSelecionado(dia)}
                    className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg p-1 text-sm tabular-nums transition ${
                      ehHoje
                        ? "bg-aura-petrol-600 font-semibold text-white"
                        : ehSelecionado
                        ? "bg-aura-petrol-500/12 font-semibold text-aura-petrol-600 ring-1 ring-aura-petrol-500/40"
                        : mesCorreto
                        ? "text-aura-graphite hover:bg-aura-sunken"
                        : "text-aura-graphite-soft/60 hover:bg-aura-sunken"
                    }`}
                  >
                    <span>{dia.getDate()}</span>
                    {atividades > 0 && (
                      <span
                        className={`flex h-4 min-w-4 items-center justify-center rounded px-1 text-[0.625rem] font-medium leading-none ${
                          ehHoje ? "bg-white/25 text-white" : "bg-aura-petrol-500/12 text-aura-petrol-600"
                        }`}
                      >
                        {atividades}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* PRÓXIMAS ATIVIDADES E AGENDAMENTO */}
          <div className="space-y-6 lg:col-span-2">
            {/* Atividades do Dia */}
            <Card>
              <CardHeader
                icone={Calendar}
                titulo={diaSelecionado ? formatarData(diaSelecionado) : "Hoje"}
                acoes={
                  <Botao variante="secundario" tamanho="sm" icone={Plus} onClick={() => setModalAberto(true)}>
                    Agendar
                  </Botao>
                }
              />

              {compromissosDia.length > 0 || atividadesDia.length > 0 || followupsDia.length > 0 ? (
                <div className="space-y-2">
                  {followupsDia.map((f) => (
                    <Link
                      key={`followup-${f.id}`}
                      href={`/relacionamentos?id=${f.id}`}
                      className={`block rounded-lg border p-3.5 transition hover:border-aura-petrol-500/50 hover:bg-aura-sunken/50 ${
                        f.atrasado ? "border-aura-danger/30" : "border-aura-mist"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-aura-graphite">Falar com {f.nome}</p>
                          <p className="mt-0.5 text-xs text-aura-graphite-soft">
                            {f.atrasado
                              ? `Follow-up venceu em ${f.quando.slice(8, 10)}/${f.quando.slice(5, 7)}`
                              : "Follow-up marcado para hoje"}
                          </p>
                        </div>
                        <Selo tom={f.atrasado ? "perigo" : "marca"} className="shrink-0">
                          {f.atrasado ? "Atrasado" : "Follow-up"}
                        </Selo>
                      </div>
                    </Link>
                  ))}
                  {compromissosDia.map((compromisso) => (
                    <div key={compromisso.id} className="rounded-lg border border-aura-mist p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-aura-graphite">{compromisso.titulo}</p>
                          {compromisso.subtitulo && <p className="mt-0.5 text-xs text-aura-graphite-soft">{compromisso.subtitulo}</p>}
                          <div className="mt-2 flex items-center gap-2 text-xs text-aura-graphite-soft">
                            <Clock size={12} /> {compromisso.hora || "Horário não definido"}
                            {compromisso.relacionamentoNome && <><span>·</span><span>{compromisso.relacionamentoNome}</span></>}
                          </div>
                        </div>
                        <Selo tom="ouro" className="shrink-0">Agenda</Selo>
                      </div>
                    </div>
                  ))}
                  {atividadesDia.map((a) => (
                    <div key={a.id} className="rounded-lg border border-aura-mist p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-aura-graphite">{a.titulo}</p>
                          <p className="mt-0.5 text-xs text-aura-graphite-soft">{a.contexto}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-aura-graphite-soft">
                            <Clock size={12} />
                            {formatarHora(a.quando || a.criadoEm)}
                          </div>
                        </div>
                        <Selo tom="marca" className="shrink-0">
                          {a.tipo}
                        </Selo>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EstadoVazio icone={Calendar} titulo="Nada marcado para este dia" />
              )}
            </Card>

            {/* Próximas Atividades */}
            <Card>
              <CardHeader icone={Clock} titulo="Próximas Atividades" />
              {proximasAtividades.length > 0 ? (
                <div className="space-y-2">
                  {proximasAtividades.map((a) => {
                    const dias = diasAteODia(parseDataLocal(dataAgenda(a)));

                    return (
                      <div key={a.id} className="rounded-lg border border-aura-mist p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-aura-graphite">{a.titulo}</p>
                            <p className="mt-0.5 text-xs text-aura-graphite-soft">{a.contexto}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs tabular-nums text-aura-graphite-soft">
                              <Calendar size={12} />
                              {formatarData(a.quando || a.criadoEm)}
                              <Clock size={12} />
                              {formatarHora(a.quando || a.criadoEm)}
                            </div>
                          </div>
                          <Selo
                            tom={dias === 0 ? "perigo" : dias === 1 ? "atencao" : "neutro"}
                            className="shrink-0"
                          >
                            {dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Em ${dias}d`}
                          </Selo>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EstadoVazio icone={Clock} titulo="Nenhuma atividade próxima" />
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de Nova Atividade */}
      {modalAberto && (
        <CompromissoModal
          dataInicial={dataLocal(diaSelecionado ?? new Date())}
          onClose={() => setModalAberto(false)}
          onSalvar={async (dados) => {
            try {
              const criado = await criarCompromisso(dados);
              setCompromissos((atual) => [...atual, criado]);
              setModalAberto(false);
            } catch (e) {
              // A causa real, não um palpite sobre a internet do vendedor.
              const motivo = e instanceof Error ? e.message : String(e);
              alert(`Não consegui salvar o compromisso.\n\nMotivo: ${motivo}`);
            }
          }}
        />
      )}
    </PageContainer>
  );
}
