"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Check, Loader2, Plus, Settings, Trash2, Wallet } from "lucide-react";

// Mesma paleta dos outros gráficos do sistema.
const COR = { serie: "#2a78d6", texto: "#52514e", tinta: "#0b0b0b" };

interface Resposta {
  saldo: {
    depositado: number;
    gasto: number;
    saldo: number;
    alerta: number;
    bloquearSemSaldo: boolean;
    precoEntrada: number;
    precoSaida: number;
  };
  gastoHoje: number;
  gastoMes: number;
  mediaDiaria: number;
  diasRestantes: number | null;
  porFuncao: { funcao: string; custo: number; chamadas: number }[];
  porDia: { dia: string; custo: number }[];
  creditos: { id: string; valor_usd: number; descricao: string | null; criado_em: string }[];
}

const dolar = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const NOMES: Record<string, string> = {
  coach: "AURA Coach",
  recados: "Recados da AURA",
  whatsapp: "Supervisor do WhatsApp",
  relatorio: "Relatórios",
  rascunho: "Rascunho por voz",
  "tarefas-do-dia": "Tarefas do dia",
  "resumo-gestor": "Resumo do gestor",
  texto: "Outros textos",
  chat: "Outras chamadas",
};

/** Controle de custo da IA: saldo, consumo e depósitos. */
export function CustoIAPainel() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/gestor/custo-ia", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui carregar.");
      setDados(json);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function depositar() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/gestor/custo-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: n, descricao }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui registrar.");
      setValor("");
      setDescricao("");
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui registrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function ajustar(patch: Record<string, unknown>) {
    await fetch("/api/gestor/custo-ia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await carregar();
  }

  async function removerDeposito(id: string) {
    setConfirmando(null);
    await fetch(`/api/gestor/custo-ia?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
      </div>
    );
  }

  if (!dados) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro ?? "Sem dados."}</p>;
  }

  const s = dados.saldo;
  const semDeposito = s.depositado <= 0;
  const noVermelho = !semDeposito && s.saldo <= 0;
  const perto = !semDeposito && !noVermelho && s.saldo <= s.alerta;

  return (
    <div className="space-y-5">
      {/* Aviso de saldo */}
      {noVermelho && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Saldo zerado.</strong> Deposite para a AURA continuar analisando conversas e gerando
            recados. {s.bloquearSemSaldo ? "O bloqueio está ligado: a IA já parou." : "O bloqueio está desligado, então a IA continua consumindo."}
          </span>
        </p>
      )}
      {perto && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Saldo abaixo de {dolar(s.alerta)}.{" "}
            {dados.diasRestantes != null && `No ritmo atual dura cerca de ${dados.diasRestantes} dia(s).`}
          </span>
        </p>
      )}

      {/* Números */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
            <Wallet size={13} /> Saldo
          </p>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              noVermelho ? "text-red-600" : perto ? "text-amber-600" : "text-aura-graphite"
            }`}
          >
            {semDeposito ? "—" : dolar(s.saldo)}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            {semDeposito
              ? "Registre o primeiro depósito para acompanhar o saldo"
              : `${dolar(s.depositado)} depositado`}
          </p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">Gasto hoje</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-aura-graphite">{dolar(dados.gastoHoje)}</p>
          <p className="mt-1 text-xs text-aura-graphite-soft">Média de {dolar(dados.mediaDiaria)} por dia</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">Gasto no mês</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-aura-graphite">{dolar(dados.gastoMes)}</p>
          <p className="mt-1 text-xs text-aura-graphite-soft">{dolar(s.gasto)} desde o início</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">Dura até</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-aura-graphite">
            {semDeposito || dados.diasRestantes == null
              ? "—"
              : dados.diasRestantes > 365
                ? "+1 ano"
                : `${dados.diasRestantes} dias`}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">No ritmo dos últimos 7 dias</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Depósito */}
        <section className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-aura-graphite">Registrar depósito</h3>
          <p className="mb-3 text-xs text-aura-graphite-soft">
            Anote aqui o que você colocou de crédito no painel da Anthropic. O saldo desta tela é o
            que você depositou menos o que o sistema já consumiu.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="Valor em dólar (ex.: 50)"
              className="min-w-36 flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observação (opcional)"
              className="min-w-36 flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void depositar()}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-aura-navy-950 px-4 py-2 text-sm font-medium text-aura-gold disabled:opacity-60"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Registrar
            </button>
          </div>

          {dados.creditos.length > 0 && (
            <ul className="mt-4 divide-y divide-aura-mist border-t border-aura-mist">
              {dados.creditos.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-aura-graphite">{dolar(Number(c.valor_usd))}</p>
                    <p className="truncate text-xs text-aura-graphite-soft">
                      {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </p>
                  </div>
                  {confirmando === c.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void removerDeposito(c.id)}
                        className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white"
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-aura-graphite-soft hover:bg-aura-bg"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(c.id)}
                      aria-label="Remover depósito"
                      className="shrink-0 rounded-lg p-2 text-aura-graphite-soft hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Consumo por dia */}
        <section className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-aura-graphite">Consumo dos últimos 30 dias</h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados.porDia} margin={{ top: 4, right: 14, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="dia"
                  tickFormatter={diaCurto}
                  interval={6}
                  tick={{ fontSize: 11, fill: COR.texto }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => (v ? `$${v.toFixed(2)}` : "0")}
                  tick={{ fontSize: 11, fill: COR.texto }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium">{diaCurto(String(label))}</p>
                        <p>{dolar(Number(payload[0].value))}</p>
                      </div>
                    ) : null
                  }
                />
                <Area type="monotone" dataKey="custo" stroke={COR.serie} fill={COR.serie} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
            Para onde foi
          </h4>
          {dados.porFuncao.length === 0 ? (
            <p className="py-4 text-center text-sm text-aura-graphite-soft">Nenhum consumo registrado ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {dados.porFuncao.map((f) => (
                <li key={f.funcao} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-aura-graphite">{NOMES[f.funcao] ?? f.funcao}</span>
                  <span className="shrink-0 tabular-nums text-aura-graphite-soft">
                    {dolar(f.custo)} · {f.chamadas} chamada{f.chamadas !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Ajustes */}
      <section className="rounded-2xl border border-aura-mist bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAjustes((v) => !v)}
          className="flex w-full items-center gap-2 px-5 py-4 text-left text-sm font-semibold text-aura-graphite"
        >
          <Settings size={15} className="text-aura-graphite-soft" />
          Preços e alerta
          <span className="ml-auto text-xs font-medium text-aura-petrol-700">{ajustes ? "Fechar" : "Abrir"}</span>
        </button>

        {ajustes && (
          <div className="space-y-4 border-t border-aura-mist px-5 py-4">
            <p className="text-xs text-aura-graphite-soft">
              O custo é calculado a partir dos tokens que cada chamada consome. Confira estes valores no
              seu painel da Anthropic — se o seu contrato tiver preço diferente, ajuste aqui.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-aura-graphite">
                Entrada (US$ por 1 milhão)
                <input
                  type="number"
                  step="0.01"
                  defaultValue={s.precoEntrada}
                  onBlur={(e) => void ajustar({ precoEntrada: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
                />
              </label>
              <label className="text-sm text-aura-graphite">
                Saída (US$ por 1 milhão)
                <input
                  type="number"
                  step="0.01"
                  defaultValue={s.precoSaida}
                  onBlur={(e) => void ajustar({ precoSaida: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
                />
              </label>
              <label className="text-sm text-aura-graphite">
                Avisar quando o saldo cair abaixo de
                <input
                  type="number"
                  step="1"
                  defaultValue={s.alerta}
                  onBlur={(e) => void ajustar({ alerta: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
                />
              </label>
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-aura-mist bg-aura-bg/50 p-3">
              <input
                type="checkbox"
                checked={s.bloquearSemSaldo}
                onChange={(e) => void ajustar({ bloquear: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm text-aura-graphite">
                Parar a IA quando o saldo zerar
                <span className="mt-0.5 block text-xs text-aura-graphite-soft">
                  A AURA continua funcionando com os recados calculados por regra, sem chamar a IA — assim
                  você não é cobrado além do que depositou. Enquanto não houver nenhum depósito registrado,
                  este bloqueio não age.
                </span>
              </span>
            </label>

            {s.bloquearSemSaldo && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check size={13} /> Bloqueio ligado.
              </p>
            )}
          </div>
        )}
      </section>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
