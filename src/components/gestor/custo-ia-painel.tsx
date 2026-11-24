"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Loader2, Plus, Settings, Trash2, Wallet } from "lucide-react";
import { Alerta, Card, CardHeader, EstadoVazio, StatCard, classeBotao } from "@/components/ui";

// Petróleo da marca: a mesma cor nos dois temas. Os eixos usam currentColor.
const COR = { serie: "#138780" };

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
    return <Alerta tom="perigo" titulo={erro ?? "Sem dados."} />;
  }

  const s = dados.saldo;
  const semDeposito = s.depositado <= 0;
  const noVermelho = !semDeposito && s.saldo <= 0;
  const perto = !semDeposito && !noVermelho && s.saldo <= s.alerta;

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de saldo */}
      {noVermelho && (
        <Alerta
          tom="perigo"
          titulo="Saldo zerado."
          descricao={
            <>
              Deposite para a AURA continuar analisando conversas e gerando recados.{" "}
              {s.bloquearSemSaldo ? "O bloqueio está ligado: a IA já parou." : "O bloqueio está desligado, então a IA continua consumindo."}
            </>
          }
        />
      )}
      {perto && (
        <Alerta
          tom="atencao"
          titulo={`Saldo abaixo de ${dolar(s.alerta)}.`}
          descricao={
            dados.diasRestantes != null ? `No ritmo atual dura cerca de ${dados.diasRestantes} dia(s).` : undefined
          }
        />
      )}

      {/* Números */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icone={Wallet}
          rotulo="Saldo"
          tom={noVermelho ? "perigo" : perto ? "atencao" : "neutro"}
          valor={semDeposito ? "—" : dolar(s.saldo)}
          detalhe={
            semDeposito
              ? "Registre o primeiro depósito para acompanhar o saldo"
              : `${dolar(s.depositado)} depositado`
          }
        />
        <StatCard
          rotulo="Gasto hoje"
          valor={dolar(dados.gastoHoje)}
          detalhe={`Média de ${dolar(dados.mediaDiaria)} por dia`}
        />
        <StatCard
          rotulo="Gasto no mês"
          valor={dolar(dados.gastoMes)}
          detalhe={`${dolar(s.gasto)} desde o início`}
        />
        <StatCard
          rotulo="Dura até"
          valor={
            semDeposito || dados.diasRestantes == null
              ? "—"
              : dados.diasRestantes > 365
                ? "+1 ano"
                : `${dados.diasRestantes} dias`
          }
          detalhe="No ritmo dos últimos 7 dias"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Depósito */}
        <Card>
          <CardHeader
            icone={Plus}
            titulo="Registrar depósito"
            descricao="Anote aqui o que você colocou de crédito no painel da Anthropic. O saldo desta tela é o que você depositou menos o que o sistema já consumiu."
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="Valor em dólar (ex.: 50)"
              className="aura-input min-w-36 flex-1 basis-36"
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observação (opcional)"
              className="aura-input min-w-36 flex-1 basis-36"
            />
            <button
              type="button"
              onClick={() => void depositar()}
              disabled={salvando}
              className={classeBotao("primario")}
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
                        className={classeBotao("perigo", "sm")}
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className={classeBotao("fantasma", "sm")}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(c.id)}
                      aria-label="Remover depósito"
                      className="shrink-0 rounded-lg p-2 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Consumo por dia */}
        <Card>
          <CardHeader icone={Wallet} titulo="Consumo dos últimos 30 dias" />
          <div style={{ height: 180 }} className="text-aura-graphite-soft">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados.porDia} margin={{ top: 4, right: 14, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="dia"
                  tickFormatter={diaCurto}
                  interval={6}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => (v ? `$${v.toFixed(2)}` : "0")}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-aura-mist bg-aura-surface px-3 py-2 text-xs text-aura-graphite shadow-lg">
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

          <h4 className="aura-rotulo mb-2 mt-5">
            Para onde foi
          </h4>
          {dados.porFuncao.length === 0 ? (
            <EstadoVazio titulo="Nenhum consumo registrado ainda." className="py-6" />
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
        </Card>
      </div>

      {/* Ajustes */}
      <section className="aura-card">
        <button
          type="button"
          onClick={() => setAjustes((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl px-5 py-4 text-left text-sm font-semibold text-aura-graphite transition hover:bg-aura-sunken/50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
            <Settings size={16} className="text-aura-graphite-soft" />
          </span>
          Preços e alerta
          <span className="ml-auto text-xs font-medium text-aura-petrol-600">{ajustes ? "Fechar" : "Abrir"}</span>
        </button>

        {ajustes && (
          <div className="space-y-4 border-t border-aura-mist px-5 py-4">
            <p className="text-xs text-aura-graphite-soft">
              O custo é calculado a partir dos tokens que cada chamada consome. Confira estes valores no
              seu painel da Anthropic — se o seu contrato tiver preço diferente, ajuste aqui.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-aura-graphite">
                Entrada (US$ por 1 milhão)
                <input
                  type="number"
                  step="0.01"
                  defaultValue={s.precoEntrada}
                  onBlur={(e) => void ajustar({ precoEntrada: Number(e.target.value) })}
                  className="aura-input mt-1.5 font-normal"
                />
              </label>
              <label className="text-sm font-medium text-aura-graphite">
                Saída (US$ por 1 milhão)
                <input
                  type="number"
                  step="0.01"
                  defaultValue={s.precoSaida}
                  onBlur={(e) => void ajustar({ precoSaida: Number(e.target.value) })}
                  className="aura-input mt-1.5 font-normal"
                />
              </label>
              <label className="text-sm font-medium text-aura-graphite">
                Avisar quando o saldo cair abaixo de
                <input
                  type="number"
                  step="1"
                  defaultValue={s.alerta}
                  onBlur={(e) => void ajustar({ alerta: Number(e.target.value) })}
                  className="aura-input mt-1.5 font-normal"
                />
              </label>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-aura-mist bg-aura-sunken/50 p-3">
              <input
                type="checkbox"
                checked={s.bloquearSemSaldo}
                onChange={(e) => void ajustar({ bloquear: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-aura-petrol-600"
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
              <p className="flex items-center gap-1.5 text-xs font-medium text-aura-success">
                <Check size={13} /> Bloqueio ligado.
              </p>
            )}
          </div>
        )}
      </section>

      {erro && <Alerta tom="perigo" titulo={erro} />}
    </div>
  );
}
