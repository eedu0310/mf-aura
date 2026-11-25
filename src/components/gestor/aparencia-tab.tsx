"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarHeart, Check, Columns3, Loader2, Palette, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Alerta, Card, CardHeader, classeBotao } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AGENDA_SUGERIDA,
  APARENCIA_PADRAO,
  EVENTO_APARENCIA,
  FUNDOS,
  PALETAS,
  aplicarAparencia,
  normalizarAparencia,
  paletaDoDia,
  type ConfigAparencia,
  type IdFundo,
  type IdPaleta,
  type ItemAgenda,
  type Paleta,
} from "@/lib/aparencia";

/** "MM-DD" -> "DD/MM" e de volta (null se não for uma data válida). */
const paraTela = (mmdd: string) => `${mmdd.slice(3, 5)}/${mmdd.slice(0, 2)}`;
function doCampo(ddmm: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(ddmm.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Junta as sugestões que ainda não estão na agenda salva (desligadas). */
function comSugestoes(agenda: ItemAgenda[]): ItemAgenda[] {
  const ids = new Set(agenda.map((a) => a.id));
  return [...agenda, ...AGENDA_SUGERIDA.filter((s) => !ids.has(s.id))];
}

function previsualizar(paleta: IdPaleta, fundo: IdFundo) {
  window.dispatchEvent(new CustomEvent(EVENTO_APARENCIA, { detail: { paleta, fundo, guardar: false } }));
}

function AmostraPaleta({ p }: { p: Paleta }) {
  return (
    <div className="flex h-16 overflow-hidden rounded-lg border border-aura-mist">
      {[p.claro, p.escuro].map((a, i) => (
        <div key={i} className="flex flex-1" style={{ background: a.fundo }}>
          <div className="flex w-[38%] flex-col gap-1 p-1.5" style={{ background: a.menu }}>
            <span className="h-1.5 w-3/4 rounded-full" style={{ background: a.menuTexto, opacity: 0.5 }} />
            <span className="h-2.5 w-full rounded" style={{ background: a.acento }} />
            <span className="h-1.5 w-2/3 rounded-full" style={{ background: a.menuTexto, opacity: 0.35 }} />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-1 p-1.5">
            <span className="h-1.5 w-1/2 rounded-full" style={{ background: a.menuTexto, opacity: 0.18 }} />
            <span className="h-3 w-3/5 rounded" style={{ background: a.acento }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DESENHO: Record<IdFundo, string> = {
  liso: "none",
  pontos: "radial-gradient(rgba(120,110,100,.35) 1.1px, transparent 1.4px) 0 0/10px 10px",
  quadriculado:
    "linear-gradient(rgba(120,110,100,.18) 1px,transparent 1px) 0 0/12px 12px, linear-gradient(90deg,rgba(120,110,100,.18) 1px,transparent 1px) 0 0/12px 12px",
  diagonal: "repeating-linear-gradient(45deg, rgba(120,110,100,.18) 0 2px, transparent 2px 9px)",
  tijolo:
    "linear-gradient(rgba(120,110,100,.28) 1px,transparent 1px) 0 0/24px 10px, linear-gradient(90deg,rgba(120,110,100,.28) 1px,transparent 1px) 0 0/24px 20px, linear-gradient(90deg,rgba(120,110,100,.28) 1px,transparent 1px) 12px 10px/24px 20px",
  chamas:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='32'%3E%3Cpath d='M14 5c2 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1.5 2 3 2 4.5 1-2 1-5 1-8.5z' fill='none' stroke='%23a0603a' stroke-opacity='0.45' stroke-width='1'/%3E%3C/svg%3E\") 0 0/28px 32px",
  degrade: "linear-gradient(180deg, color-mix(in srgb, var(--aura-petrol-500) 30%, transparent), transparent 75%)",
  colunas:
    "linear-gradient(90deg, rgba(134,150,160,.25) 0 31%, transparent 31% 34.5%, rgba(255,166,92,.28) 34.5% 65.5%, transparent 65.5% 69%, rgba(0,168,132,.25) 69%)",
};

/**
 * Painel do Gestor › Ajustes › Aparência: a paleta do sistema, o fundo do
 * pipeline e as datas comemorativas que trocam a paleta sozinhas. Clicar
 * numa opção já mostra na tela (só para quem está escolhendo); a equipe só vê
 * depois de Salvar.
 */
export function AparenciaTab() {
  const [salvo, setSalvo] = useState<ConfigAparencia | null>(null);
  const [rascunho, setRascunho] = useState<ConfigAparencia>(APARENCIA_PADRAO);
  const [datasTexto, setDatasTexto] = useState<Record<string, { inicio: string; fim: string }>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const salvoRef = useRef<ConfigAparencia | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const sb = getSupabaseBrowserClient();
    const { data, error } = sb
      ? await sb.from("aparencia_config").select("paleta, fundo_pipeline, agenda").eq("id", true).maybeSingle()
      : { data: null, error: { message: "Banco não configurado." } };
    if (error) setErro("Não consegui ler a aparência salva. " + error.message);
    const base = normalizarAparencia(data ?? {});
    const c = { ...base, agenda: comSugestoes(data ? base.agenda : []) };
    setSalvo(c);
    salvoRef.current = c;
    setRascunho(c);
    setDatasTexto(Object.fromEntries(c.agenda.map((a) => [a.id, { inicio: paraTela(a.inicio), fim: paraTela(a.fim) }])));
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
    // Saiu da tela sem salvar: volta para a aparência que vale para todos.
    return () => {
      const s = salvoRef.current;
      if (s) previsualizar(paletaDoDia(s).paleta, s.fundoPipeline);
    };
  }, [carregar]);

  function mudar(parcial: Partial<ConfigAparencia>) {
    setOk(false);
    const novo = { ...rascunho, ...parcial };
    setRascunho(novo);
    // Escolheu uma paleta: mostra ela, mesmo que uma data comemorativa esteja
    // valendo hoje. Mudou só o fundo: mostra o que vale hoje.
    previsualizar(parcial.paleta ?? paletaDoDia(novo).paleta, novo.fundoPipeline);
  }

  function mudarData(id: string, parcial: Partial<ItemAgenda>) {
    setOk(false);
    setRascunho((r) => ({ ...r, agenda: r.agenda.map((a) => (a.id === id ? { ...a, ...parcial } : a)) }));
  }

  function campoData(id: string, t: { inicio: string; fim: string }, campo: "inicio" | "fim", invalida: boolean) {
    return (
      <input
        value={t[campo]}
        placeholder="dd/mm"
        inputMode="numeric"
        aria-label={campo === "inicio" ? "Começa em (dia/mês)" : "Termina em (dia/mês)"}
        onChange={(e) => {
          const valor = e.target.value.slice(0, 5);
          setDatasTexto((x) => ({ ...x, [id]: { ...t, [campo]: valor } }));
          const mmdd = doCampo(valor);
          if (mmdd) mudarData(id, { [campo]: mmdd });
        }}
        className={`aura-input !h-9 !w-20 text-center tabular-nums ${invalida && !doCampo(t[campo]) ? "!border-aura-danger" : ""}`}
      />
    );
  }

  function adicionarData() {
    const id = `data-${Date.now()}`;
    setRascunho((r) => ({
      ...r,
      agenda: [...r.agenda, { id, nome: "Nova data", paleta: "terracota", inicio: "01-01", fim: "01-07", ativo: true }],
    }));
    setDatasTexto((t) => ({ ...t, [id]: { inicio: "01/01", fim: "07/01" } }));
  }

  const datasInvalidas = useMemo(
    () =>
      rascunho.agenda.filter((a) => {
        const t = datasTexto[a.id];
        return t && (!doCampo(t.inicio) || !doCampo(t.fim));
      }),
    [rascunho.agenda, datasTexto],
  );

  const hoje = paletaDoDia(rascunho);
  const nomeDaPaleta = (id: IdPaleta) => PALETAS.find((p) => p.id === id)?.nome ?? id;
  const mudou = JSON.stringify(salvo) !== JSON.stringify(rascunho);

  async function salvar() {
    if (datasInvalidas.length) {
      setErro("Confira as datas marcadas em vermelho (use dia/mês, como 01/12).");
      return;
    }
    setSalvando(true);
    setErro(null);
    const sb = getSupabaseBrowserClient();
    const { data: u } = sb ? await sb.auth.getUser() : { data: { user: null } };
    const { data, error } = sb
      ? await sb
          .from("aparencia_config")
          .upsert({
            id: true,
            paleta: rascunho.paleta,
            fundo_pipeline: rascunho.fundoPipeline,
            agenda: rascunho.agenda,
            atualizado_em: new Date().toISOString(),
            atualizado_por: u.user?.id ?? null,
          })
          .select("id")
      : { data: null, error: { message: "Banco não configurado." } };
    setSalvando(false);
    if (error || !data?.length) {
      setErro(
        "Não consegui salvar. Só os gestores mestres (que veem todas as lojas) mudam a aparência." +
          (error ? ` (${error.message})` : ""),
      );
      return;
    }
    setSalvo(rascunho);
    salvoRef.current = rascunho;
    aplicarAparencia(paletaDoDia(rascunho).paleta, rascunho.fundoPipeline);
    setOk(true);
  }

  function desfazer() {
    if (!salvo) return;
    setRascunho(salvo);
    setDatasTexto(Object.fromEntries(salvo.agenda.map((a) => [a.id, { inicio: paraTela(a.inicio), fim: paraTela(a.fim) }])));
    previsualizar(paletaDoDia(salvo).paleta, salvo.fundoPipeline);
    setOk(false);
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-aura-graphite-soft" />
      </div>
    );
  }

  const fixas = PALETAS.filter((p) => !p.comemorativa);
  const especiais = PALETAS.filter((p) => p.comemorativa);

  return (
    <div className="space-y-5">
      <div className="aura-card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-aura-graphite">
            Hoje vale: <span className="text-aura-petrol-600">{nomeDaPaleta(hoje.paleta)}</span>
            {hoje.data && <span className="text-aura-graphite-soft"> (por causa de {hoje.data.nome})</span>}
          </p>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">
            Clicar numa opção já mostra na sua tela. A equipe toda só vê depois de salvar.
          </p>
        </div>
        <button type="button" onClick={desfazer} disabled={!mudou || salvando} className={classeBotao("fantasma", "md")}>
          <RotateCcw size={15} /> Desfazer
        </button>
        <button type="button" onClick={salvar} disabled={!mudou || salvando} className={classeBotao("primario", "md")}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar para todos
        </button>
      </div>

      {erro && <Alerta tom="perigo" titulo={erro} />}
      {ok && <Alerta tom="sucesso" titulo="Aparência salva. A equipe vê na próxima vez que abrir ou trocar de página." />}

      <Card>
        <CardHeader icone={Palette} titulo="Paleta do sistema" descricao="Cor do menu, dos botões e do fundo, no tema claro e no escuro." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {fixas.map((p) => (
            <BotaoPaleta key={p.id} p={p} ativa={rascunho.paleta === p.id} aoEscolher={() => mudar({ paleta: p.id })} />
          ))}
        </div>
        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-aura-graphite-soft">
          Datas comemorativas (também podem ficar fixas)
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {especiais.map((p) => (
            <BotaoPaleta key={p.id} p={p} ativa={rascunho.paleta === p.id} aoEscolher={() => mudar({ paleta: p.id })} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader icone={Columns3} titulo="Fundo do pipeline" descricao="O desenho atrás das colunas do quadro de negócios." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FUNDOS.map((f) => {
            const ativo = rascunho.fundoPipeline === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => mudar({ fundoPipeline: f.id })}
                aria-pressed={ativo}
                className={`rounded-xl border p-2 text-left transition ${
                  ativo ? "border-aura-petrol-500 ring-2 ring-aura-petrol-500/30" : "border-aura-mist hover:border-aura-petrol-300"
                }`}
              >
                <div className="h-14 rounded-lg border border-aura-mist bg-aura-bg" style={{ background: `${DESENHO[f.id]}, var(--aura-bg)`.replace("none, ", "") }} />
                <p className="mt-2 text-sm font-medium text-aura-graphite">{f.nome}</p>
                <p className="text-xs text-aura-graphite-soft">{f.descricao}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          icone={CalendarHeart}
          titulo="Datas comemorativas"
          descricao="Ligada, a data troca a paleta sozinha no período, todo ano. Fora dele, volta a paleta escolhida acima."
          acoes={
            <button type="button" onClick={adicionarData} className={classeBotao("secundario", "sm")}>
              <Plus size={14} /> Adicionar data
            </button>
          }
        />
        <div className="space-y-2">
          {rascunho.agenda.map((a) => {
            const t = datasTexto[a.id] ?? { inicio: paraTela(a.inicio), fim: paraTela(a.fim) };
            const sugerida = AGENDA_SUGERIDA.some((s) => s.id === a.id);
            const invalida = datasInvalidas.some((d) => d.id === a.id);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-aura-mist p-2.5">
                <label className="flex items-center gap-2 text-sm text-aura-graphite">
                  <input
                    type="checkbox"
                    checked={a.ativo}
                    onChange={(e) => mudarData(a.id, { ativo: e.target.checked })}
                    className="h-4 w-4 accent-[var(--aura-petrol-500)]"
                  />
                  <span className="sr-only">Ligar {a.nome}</span>
                </label>
                <input
                  value={a.nome}
                  onChange={(e) => mudarData(a.id, { nome: e.target.value.slice(0, 60) })}
                  className="aura-input !h-9 min-w-[10rem] flex-1"
                  aria-label="Nome da data"
                />
                <select
                  value={a.paleta}
                  onChange={(e) => mudarData(a.id, { paleta: e.target.value as IdPaleta })}
                  className="aura-input !h-9 w-auto"
                  aria-label="Paleta da data"
                >
                  {PALETAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-aura-graphite-soft">de</span>
                {campoData(a.id, t, "inicio", invalida)}
                <span className="text-xs text-aura-graphite-soft">até</span>
                {campoData(a.id, t, "fim", invalida)}
                {!sugerida && (
                  <button
                    type="button"
                    onClick={() => setRascunho((r) => ({ ...r, agenda: r.agenda.filter((x) => x.id !== a.id) }))}
                    className={classeBotao("fantasma", "sm")}
                    aria-label={`Remover ${a.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-aura-graphite-soft">
          Se duas datas se cruzarem, vale a que estiver mais acima na lista. Período que vira o ano (por exemplo, 20/12 até 06/01) funciona.
        </p>
      </Card>
    </div>
  );
}

function BotaoPaleta({ p, ativa, aoEscolher }: { p: Paleta; ativa: boolean; aoEscolher: () => void }) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={ativa}
      className={`rounded-xl border p-2 text-left transition ${
        ativa ? "border-aura-petrol-500 ring-2 ring-aura-petrol-500/30" : "border-aura-mist hover:border-aura-petrol-300"
      }`}
    >
      <AmostraPaleta p={p} />
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
        {ativa && <Check size={14} className="text-aura-petrol-600" />}
        {p.nome}
      </p>
      <p className="text-xs text-aura-graphite-soft">{p.descricao}</p>
    </button>
  );
}
