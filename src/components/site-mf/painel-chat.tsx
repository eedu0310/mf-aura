"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Plus, Settings2, Trash2, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DIAS, horarioEmTexto, type Horario, type Turno } from "@/lib/site-mf/horario";

/** Igual a lib/site-mf/chat.ts (que é do servidor). */
interface Atalho {
  slug: string;
  titulo: string;
  subtitulo: string;
  icone: string;
}
const ICONES = [
  { id: "catalogo", nome: "Catálogo" },
  { id: "chama", nome: "Chama (tecnologia)" },
  { id: "celular", nome: "Celular (realidade aumentada)" },
  { id: "cubo", nome: "Cubo (bloco 3D)" },
  { id: "manual", nome: "Manual" },
  { id: "documento", nome: "Documento" },
];

interface Resumo {
  naoLidas: number;
  online: { id: string; nome: string }[];
  disponivel: boolean;
  podeConfigurar: boolean;
  config: {
    ativo: boolean;
    saudacao: string;
    atendente_padrao_id: string | null;
    atalhos: Atalho[];
    whatsapp: string | null;
    horario: Horario;
    mensagem_fora_horario: string;
  } | null;
  equipe: { id: string; nome: string }[];
}

/**
 * Faixa no topo do Atendimento: quem está online no chat do site, o
 * interruptor "estou disponível" e, para o gestor, a configuração do widget
 * com o código para colar no site.
 */
export function PainelChat() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [mudando, setMudando] = useState(false);
  const [configurando, setConfigurando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/site/chat/equipe?resumo=1", { cache: "no-store" });
      if (r.ok) setResumo(await r.json());
    } catch {
      // tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = window.setInterval(() => void carregar(), 60_000);
    window.addEventListener("aura:chat-site-mudou", carregar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("aura:chat-site-mudou", carregar);
    };
  }, [carregar]);

  async function alternar() {
    if (!resumo) return;
    setMudando(true);
    await fetch("/api/site/chat/equipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "presenca", disponivel: !resumo.disponivel }),
    }).catch(() => {});
    await carregar();
    setMudando(false);
  }

  if (!resumo) return null;
  const nomes = resumo.online.map((p) => p.nome.split(" ")[0]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-aura-mist bg-white px-4 py-3">
      <button
        type="button"
        role="switch"
        aria-checked={resumo.disponivel}
        disabled={mudando}
        onClick={() => void alternar()}
        className="flex min-h-10 items-center gap-2.5 text-sm font-medium text-aura-graphite disabled:opacity-60"
      >
        <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${resumo.disponivel ? "bg-emerald-500" : "bg-aura-mist"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${resumo.disponivel ? "left-[22px]" : "left-0.5"}`} />
        </span>
        {resumo.disponivel ? "Estou online no chat do site" : "Estou fora do chat do site"}
      </button>
      <span className="text-xs text-aura-graphite-soft">
        {nomes.length ? `Online agora: ${nomes.join(", ")}` : "Ninguém online agora: o site mostra o atendente padrão e a mensagem fica esperando aqui."}
      </span>
      {resumo.podeConfigurar && (
        <button
          type="button"
          onClick={() => setConfigurando(true)}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
        >
          <Settings2 size={14} /> Configurar chat
        </button>
      )}
      {configurando && resumo.config && (
        <ConfigChat
          resumo={resumo}
          onFechar={() => setConfigurando(false)}
          onSalvo={async () => {
            setConfigurando(false);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function ConfigChat({ resumo, onFechar, onSalvo }: { resumo: Resumo; onFechar: () => void; onSalvo: () => void }) {
  const c = resumo.config!;
  const [ativo, setAtivo] = useState(c.ativo);
  const [saudacao, setSaudacao] = useState(c.saudacao);
  const [atendente, setAtendente] = useState(c.atendente_padrao_id ?? "");
  const [atalhos, setAtalhos] = useState<Atalho[]>(c.atalhos ?? []);
  const [whatsapp, setWhatsapp] = useState(c.whatsapp ?? "");
  const [horario, setHorario] = useState<Horario>(c.horario ?? {});
  const [foraHorario, setForaHorario] = useState(c.mensagem_fora_horario ?? "");
  const [formularios, setFormularios] = useState<{ slug: string; nome: string; titulo: string | null; destino: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const origem = typeof window === "undefined" ? "https://crm.mflaser.com.br" : window.location.origin;
  const codigo = `<script src="${origem}/widget-mf.js" async></script>`;

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    void sb
      ?.from("site_formularios")
      .select("slug, nome, titulo, destino")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setFormularios((data ?? []) as { slug: string; nome: string; titulo: string | null; destino: string }[]));
  }, []);

  function mudarAtalho(i: number, patch: Partial<Atalho>) {
    setAtalhos((l) => l.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }
  function moverAtalho(i: number, d: -1 | 1) {
    setAtalhos((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  function mudarTurno(dia: string, k: number, lado: 0 | 1, valor: string) {
    setHorario((h) => {
      const turnos: Turno[] = [...(h[dia] ?? [])].map((t) => [t[0], t[1]] as Turno);
      while (turnos.length <= k) turnos.push(["", ""]);
      turnos[k][lado] = valor;
      return { ...h, [dia]: turnos };
    });
  }
  function ligarDia(dia: string, aberto: boolean) {
    setHorario((h) => ({ ...h, [dia]: aberto ? [["08:00", "12:00"], ["13:30", "18:00"]] : [] }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    // Turno vazio (sem as duas horas) não vai.
    const limpo: Horario = {};
    for (const { dia } of DIAS) limpo[dia] = (horario[dia] ?? []).filter((t) => t[0] && t[1]);
    try {
      const r = await fetch("/api/site/chat/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "config", ativo, saudacao, atendentePadraoId: atendente || null, atalhos, whatsapp, horario: limpo, mensagemForaHorario: foraHorario }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui salvar.");
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const entrada = "min-h-11 rounded-xl border border-aura-mist bg-white px-3 text-sm font-normal outline-none focus:border-aura-petrol-500";
  const pequena = "min-h-9 w-full min-w-0 rounded-lg border border-aura-mist bg-white px-2 text-sm font-normal outline-none focus:border-aura-petrol-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label="Configurar o chat do site" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-semibold text-aura-graphite">Chat do site da MF</p>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          <label className="flex items-center gap-2.5 text-sm font-medium text-aura-graphite">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
            Chat ligado no site
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
            Saudação
            <textarea rows={2} value={saudacao} maxLength={300} onChange={(e) => setSaudacao(e.target.value)} className={`${entrada} py-2`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
              Atendente quando ninguém está online
              <select value={atendente} onChange={(e) => setAtendente(e.target.value)} className={entrada}>
                <option value="">Equipe MF</option>
                {resumo.equipe.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
              WhatsApp do botão (com DDI e DDD)
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="555135361422" className={`${entrada} font-data`} />
            </label>
          </div>

          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium text-aura-graphite">Materiais gratuitos no widget</p>
            <p className="text-xs text-aura-graphite-soft">
              Cada atalho abre um formulário dentro do widget. Se o formulário é de cliente/parceiro (manuais, blocos 3D), o pedido não vira lead. Crie os formulários na aba Formulários.
            </p>
            {atalhos.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-aura-mist p-3 sm:grid-cols-[1fr_1fr_auto]">
                <select value={a.slug} onChange={(e) => mudarAtalho(i, { slug: e.target.value })} className={pequena} aria-label="Formulário">
                  {!formularios.some((f) => f.slug === a.slug) && <option value={a.slug}>{a.slug} (desligado)</option>}
                  {formularios.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.nome}
                      {f.destino === "cliente" ? " · cliente/parceiro" : " · vira lead"}
                    </option>
                  ))}
                </select>
                <select value={a.icone} onChange={(e) => mudarAtalho(i, { icone: e.target.value })} className={pequena} aria-label="Ícone">
                  {ICONES.map((ic) => (
                    <option key={ic.id} value={ic.id}>
                      Ícone: {ic.nome}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button type="button" aria-label="Subir" onClick={() => moverAtalho(i, -1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" aria-label="Descer" onClick={() => moverAtalho(i, 1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" aria-label="Tirar atalho" onClick={() => setAtalhos((l) => l.filter((_, j) => j !== i))} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg hover:text-red-700">
                    <Trash2 size={15} />
                  </button>
                </div>
                <input value={a.titulo} maxLength={60} onChange={(e) => mudarAtalho(i, { titulo: e.target.value })} placeholder="Título (ex.: Quero o catálogo)" className={pequena} aria-label="Título" />
                <input value={a.subtitulo} maxLength={90} onChange={(e) => mudarAtalho(i, { subtitulo: e.target.value })} placeholder="Texto menor" className={`${pequena} sm:col-span-2`} aria-label="Texto menor" />
              </div>
            ))}
            {atalhos.length < 8 && formularios.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const f = formularios.find((x) => !atalhos.some((a) => a.slug === x.slug)) ?? formularios[0];
                  setAtalhos((l) => [...l, { slug: f.slug, titulo: f.titulo || f.nome, subtitulo: "", icone: "documento" }]);
                }}
                className="inline-flex min-h-9 w-fit items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite"
              >
                <Plus size={13} /> Atalho
              </button>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium text-aura-graphite">Horário de atendimento</p>
            <p className="text-xs text-aura-graphite-soft">Aparece no widget. Fora dele o chat continua aberto e o cliente recebe o aviso abaixo.</p>
            <div className="flex flex-col gap-1.5">
              {DIAS.map(({ dia, nome }) => {
                const turnos = horario[dia] ?? [];
                const aberto = turnos.length > 0;
                return (
                  <div key={dia} className="flex items-start gap-2 text-sm">
                    <label className="flex min-h-9 w-28 shrink-0 items-center gap-2 text-aura-graphite">
                      <input type="checkbox" checked={aberto} onChange={(e) => ligarDia(dia, e.target.checked)} /> {nome}
                    </label>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {aberto ? (
                      [0, 1].map((k) => (
                        <span key={k} className="flex items-center gap-1 [&_input]:w-auto">
                          <input type="time" value={turnos[k]?.[0] ?? ""} onChange={(e) => mudarTurno(dia, k, 0, e.target.value)} className={pequena} aria-label={`${nome} turno ${k + 1} abre`} />
                          <span className="text-aura-graphite-soft">às</span>
                          <input type="time" value={turnos[k]?.[1] ?? ""} onChange={(e) => mudarTurno(dia, k, 1, e.target.value)} className={pequena} aria-label={`${nome} turno ${k + 1} fecha`} />
                          {k === 0 && <span className="px-1 text-aura-graphite-soft">e</span>}
                        </span>
                      ))
                    ) : (
                      <span className="flex min-h-9 items-center text-aura-graphite-soft">Fechado</span>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-aura-graphite-soft">No widget: {horarioEmTexto(horario) || "sem horário (sempre aberto)"}</p>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
              Aviso fora do horário
              <textarea rows={2} maxLength={300} value={foraHorario} onChange={(e) => setForaHorario(e.target.value)} className={`${entrada} py-2`} />
            </label>
          </section>

          <div className="rounded-xl border border-aura-mist bg-aura-bg p-3">
            <p className="text-sm font-medium text-aura-graphite">Código para colar no site</p>
            <p className="mt-1 text-xs leading-relaxed text-aura-graphite-soft">
              No WordPress, no mesmo lugar onde está o código do Bitrix (Betheme → Theme Options, ou Elementor → Código personalizado). Tire o do Bitrix e cole este no lugar.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 font-data text-xs text-aura-graphite">{codigo}</pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(codigo);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist bg-white px-3 text-xs font-medium text-aura-graphite"
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar código"}
            </button>
          </div>
        </div>

        {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aura-petrol-700 px-5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
          >
            {salvando && <Loader2 size={16} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
