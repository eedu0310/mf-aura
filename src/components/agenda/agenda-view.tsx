"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin } from "lucide-react";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { useAppData } from "@/lib/app-data-context";
import { CompromissoModal } from "./compromisso-modal";
import {
  criarCompromisso,
  listarCompromissos,
  type Compromisso,
} from "@/lib/supabase/compromissos";
import { parseDataLocal } from "@/lib/date-local";

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

  // ========== PRÓXIMAS ATIVIDADES (PRÓXIMOS 7 DIAS) ==========
  const proximasAtividades = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const semanaDepois = new Date(hoje);
    semanaDepois.setDate(semanaDepois.getDate() + 7);

    return todasAtividades
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

    const atividadesCount = todasAtividades.filter((a) => {
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
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-aura-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aura-petrol-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-white/50">
            Organize seus contatos e próximas atividades.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <AuraInsightCard pagina="agenda" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* CALENDÁRIO */}
          <div className="lg:col-span-1 rounded-2xl border border-aura-mist bg-white p-6">
            {/* Controles do Mês */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={mesAnterior}
                className="rounded-lg border border-aura-mist p-2 hover:bg-aura-bg transition"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="font-semibold text-aura-graphite capitalize">{nomeMes}</p>
              <button
                onClick={mesProximo}
                className="rounded-lg border border-aura-mist p-2 hover:bg-aura-bg transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Dias da Semana */}
            <div className="mb-3 grid grid-cols-7 gap-1">
              {diasSemana.map((dia) => (
                <div key={dia} className="text-center text-xs font-medium text-aura-graphite-soft py-2">
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
                    className={`aspect-square rounded-lg p-1 text-sm font-medium transition flex flex-col items-center justify-center ${
                      ehHoje
                        ? "bg-aura-petrol-700 text-white ring-2 ring-aura-petrol-300"
                        : ehSelecionado
                        ? "bg-aura-petrol-100 text-aura-petrol-700"
                        : mesCorreto
                        ? "hover:bg-aura-bg text-aura-graphite"
                        : "text-aura-graphite-soft"
                    }`}
                  >
                    <span>{dia.getDate()}</span>
                    {atividades > 0 && (
                      <span className={`text-xs ${ehHoje ? "bg-white text-aura-petrol-700" : "bg-aura-petrol-100 text-aura-petrol-700"} rounded-full w-4 h-4 flex items-center justify-center`}>
                        {atividades}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PRÓXIMAS ATIVIDADES E AGENDAMENTO */}
          <div className="lg:col-span-2 space-y-6">
            {/* Atividades do Dia */}
            <div className="rounded-2xl border border-aura-mist bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-aura-petrol-600" />
                  <p className="text-lg font-semibold text-aura-graphite">
                    {diaSelecionado ? formatarData(diaSelecionado) : "Hoje"}
                  </p>
                </div>
                <button
                  onClick={() => setModalAberto(true)}
                  className="flex items-center gap-2 rounded-lg bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 transition"
                >
                  <Plus size={16} />
                  Agendar
                </button>
              </div>

              {compromissosDia.length > 0 || atividadesDia.length > 0 ? (
                <div className="space-y-3">
                  {compromissosDia.map((compromisso) => (
                    <div key={compromisso.id} className="rounded-lg border border-aura-gold/40 bg-aura-gold/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-aura-graphite">{compromisso.titulo}</p>
                          {compromisso.subtitulo && <p className="mt-1 text-xs text-aura-graphite-soft">{compromisso.subtitulo}</p>}
                          <div className="mt-2 flex items-center gap-2 text-xs text-aura-graphite-soft">
                            <Clock size={12} /> {compromisso.hora || "Horário não definido"}
                            {compromisso.relacionamentoNome && <><span>·</span><span>{compromisso.relacionamentoNome}</span></>}
                          </div>
                        </div>
                        <span className="rounded-full bg-aura-gold/20 px-2 py-1 text-xs font-medium text-aura-graphite">Agenda</span>
                      </div>
                    </div>
                  ))}
                  {atividadesDia.map((a) => (
                    <div key={a.id} className="rounded-lg border border-aura-mist bg-aura-bg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-aura-graphite">{a.titulo}</p>
                          <p className="text-xs text-aura-graphite-soft mt-1">{a.contexto}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-aura-graphite-soft">
                            <Clock size={12} />
                            {formatarHora(a.quando || a.criadoEm)}
                          </div>
                        </div>
                        <span className="inline-block rounded-full bg-aura-petrol-100 px-2 py-1 text-xs font-medium text-aura-petrol-700 shrink-0">
                          {a.tipo}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-aura-graphite-soft py-8">
                  Nenhuma atividade agendada
                </p>
              )}
            </div>

            {/* Próximas Atividades */}
            <div className="rounded-2xl border border-aura-mist bg-white p-6">
              <p className="mb-4 text-lg font-semibold text-aura-graphite">Próximas Atividades</p>
              {proximasAtividades.length > 0 ? (
                <div className="space-y-3">
                  {proximasAtividades.map((a) => {
                    const dataAtividade = parseDataLocal(dataAgenda(a));
                    const hoje = new Date();
                    const dias = Math.ceil(
                      (dataAtividade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div key={a.id} className="rounded-lg border border-aura-mist bg-aura-bg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-aura-graphite">{a.titulo}</p>
                            <p className="text-xs text-aura-graphite-soft mt-1">{a.contexto}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-aura-graphite-soft">
                              <Calendar size={12} />
                              {formatarData(a.quando || a.criadoEm)}
                              <Clock size={12} />
                              {formatarHora(a.quando || a.criadoEm)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-medium rounded-full px-2 py-1 ${
                              dias === 0
                                ? "bg-red-100 text-red-700"
                                : dias === 1
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Em ${dias}d`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-aura-graphite-soft py-8">
                  Nenhuma atividade próxima
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Nova Atividade */}
      {modalAberto && (
        <CompromissoModal
          dataInicial={dataLocal(diaSelecionado ?? new Date())}
          onClose={() => setModalAberto(false)}
          onSalvar={async (dados) => {
            const criado = await criarCompromisso(dados);
            if (!criado) {
              alert("Não foi possível salvar o compromisso. Verifique o Supabase.");
              return;
            }
            setCompromissos((atual) => [...atual, criado]);
            setModalAberto(false);
          }}
        />
      )}
    </div>
  );
}
