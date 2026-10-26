"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, X, CheckCircle2, MapPin, ArrowRightLeft } from "lucide-react";
import { EMPRESAS } from "@/lib/companies";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ConversaSite } from "./conversa-site";
import { PainelChat } from "./painel-chat";
import { ClientesParceiros, type EnvioCliente } from "./clientes-parceiros";
import { EditarContato } from "./editar-contato";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { Pencil, Trash2 } from "lucide-react";

interface Envio {
  id: string;
  created_at: string;
  dados: Record<string, string | boolean>;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  perfil: string | null;
  origem_url: string | null;
  utm: Record<string, string> | null;
  formulario: string | null;
  transferido_para: string | null;
  transferido_em: string | null;
  lead: { status: string; empresa: string; respondido_em: string | null; prazo_resposta: string | null; dono: string | null } | null;
  conversa: { id: string; status: string; nao_lidas: number; ultima_mensagem: string | null; ultima_em: string; visitante_visto_em: string | null } | null;
  destino: "lead" | "cliente";
  etapa: "novo" | "em_atendimento" | "resolvido";
  responsavel: string | null;
  nota: string | null;
}

type Filtro = "abertos" | "atendidos" | "transferidos" | "todos";

/** Cidade → loja que atende. Só sugestão: quem decide é quem transfere. */
const CIDADES_DA_LOJA: { empresa: string; cidades: string[] }[] = [
  { empresa: "A&G Aquecimento", cidades: ["garibaldi", "carlos barbosa", "boa vista do sul", "coronel pilar", "barão"] },
  { empresa: "Sole Aquecimento", cidades: ["bento goncalves", "farroupilha", "monte belo do sul", "pinto bandeira", "santa tereza", "veranopolis"] },
  {
    empresa: "LF Lareiras",
    cidades: ["sao sebastiao do cai", "porto alegre", "montenegro", "novo hamburgo", "sao leopoldo", "canoas", "caxias do sul", "gramado", "canela", "feliz", "bom principio"],
  },
];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function lojaSugerida(cidade: string | null): string | null {
  if (!cidade) return null;
  const c = semAcento(cidade.split("/")[0]);
  return CIDADES_DA_LOJA.find((l) => l.cidades.some((x) => c.includes(x)))?.empresa ?? null;
}

function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function situacao(e: Envio): { texto: string; classe: string } {
  if (e.transferido_para) return { texto: `Transferido · ${e.transferido_para}`, classe: "bg-violet-100 text-violet-900" };
  if (e.lead?.status === "respondido") return { texto: "Atendido · no pipeline", classe: "bg-emerald-100 text-emerald-900" };
  const vencido = e.lead?.prazo_resposta && new Date(e.lead.prazo_resposta).getTime() < Date.now();
  return vencido
    ? { texto: "Esperando resposta · prazo vencido", classe: "bg-red-100 text-red-900" }
    : { texto: "Esperando resposta", classe: "bg-amber-100 text-amber-900" };
}

/** Precisa de alguém: lead ainda sem atendimento, ou cliente escreveu no chat e ninguém leu. */
function esperando(e: Envio) {
  return (!e.transferido_para && e.lead?.status !== "respondido") || (e.conversa?.status === "aberta" && e.conversa.nao_lidas > 0);
}

export function AtendimentoSite() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [aberto, setAberto] = useState<Envio | null>(null);
  const [transferindo, setTransferindo] = useState<Envio | null>(null);
  const [conversando, setConversando] = useState<Envio | null>(null);
  const [editandoContato, setEditandoContato] = useState<Envio | null>(null);
  const acesso = usarMeuAcesso();
  const podeExcluir = acesso.cargo === "Gestor" || acesso.cargo === "Diretor" || acesso.gestorMestre;
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/site/atendimento", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui carregar.");
      const lista: Envio[] = j.envios ?? [];
      // Chat com mensagem do cliente esperando vem primeiro.
      lista.sort((a, b) => (b.conversa?.nao_lidas ? 1 : 0) - (a.conversa?.nao_lidas ? 1 : 0));
      setEnvios(lista);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Lead novo do site aparece sozinho: escuta a fila de leads da loja.
    const sb = getSupabaseBrowserClient();
    const canal = sb
      ?.channel("aura-site-mf")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => void carregar())
      .subscribe();
    const t = setInterval(() => void carregar(), 60_000);
    // Mensagem nova no chat do site (o vigia da AURA avisa).
    const recarregar = () => void carregar();
    window.addEventListener("aura:chat-site-mensagem", recarregar);
    window.addEventListener("aura:chat-site-mudou", recarregar);
    return () => {
      clearInterval(t);
      window.removeEventListener("aura:chat-site-mensagem", recarregar);
      window.removeEventListener("aura:chat-site-mudou", recarregar);
      if (sb && canal) sb.removeChannel(canal);
    };
  }, [carregar]);

  // Veio do aviso "Responder agora": abre a conversa direto.
  useEffect(() => {
    if (carregando) return;
    const id = new URLSearchParams(window.location.search).get("conversa");
    if (!id) return;
    const alvo = envios.find((e) => e.conversa?.id === id);
    if (alvo) setConversando(alvo);
    const url = new URL(window.location.href);
    url.searchParams.delete("conversa");
    window.history.replaceState(null, "", url);
  }, [carregando, envios]);


  const deLeads = useMemo(() => envios.filter((e) => e.destino !== "cliente"), [envios]);
  const deClientes = useMemo(() => envios.filter((e) => e.destino === "cliente"), [envios]);

  const lista = useMemo(() => {
    return deLeads.filter((e) => {
      if (filtro === "todos") return true;
      if (filtro === "transferidos") return !!e.transferido_para;
      if (filtro === "atendidos") return !e.transferido_para && e.lead?.status === "respondido";
      return esperando(e);
    });
  }, [deLeads, filtro]);

  const contagem = useMemo(
    () => ({
      abertos: deLeads.filter(esperando).length,
      atendidos: deLeads.filter((e) => !e.transferido_para && e.lead?.status === "respondido").length,
      transferidos: deLeads.filter((e) => !!e.transferido_para).length,
      todos: deLeads.length,
    }),
    [deLeads],
  );

  /** Lixeira do cartão: tira o contato do Site MF (spam, teste, repetido). */
  async function excluir(e: { id: string; nome: string | null }) {
    if (!confirm(`Excluir ${e.nome || "este contato"}? Sai do Site MF, a conversa do chat é apagada e o lead também, se ainda não foi atendido. Não dá para desfazer.`)) return;
    setOcupado(true);
    try {
      const r = await fetch("/api/site/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "excluir", envioId: e.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não consegui excluir.");
      await carregar();
    } catch (err: any) {
      alert(err?.message || "Não consegui excluir.");
    } finally {
      setOcupado(false);
    }
  }

  async function marcarAtendido(e: Envio) {
    setOcupado(true);
    try {
      const r = await fetch("/api/site/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "atendido", envioId: e.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      await carregar();
      setAberto(null);
      setConversando(null);
    } catch (err: any) {
      alert(err?.message || "Não consegui marcar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PainelChat />

      <h2 className="font-display text-base font-semibold text-aura-graphite">Novos clientes · catálogo, tecnologia, realidade aumentada e chat</h2>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["abertos", "Esperando"],
            ["atendidos", "Atendidos"],
            ["transferidos", "Transferidos"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filtro === id ? "border-aura-petrol-700 bg-aura-petrol-700 text-white" : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
            }`}
          >
            {rotulo} · {contagem[id]}
          </button>
        ))}
      </div>

      <p className="text-xs text-aura-graphite-soft">
        Quem preenche um formulário ou começa o chat no site entra aqui e na fila de leads da MF, já distribuído para um vendedor. Clique num chat para responder: a resposta aparece na hora para o cliente no site.
      </p>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : erro ? (
        <p className="rounded-2xl border border-aura-danger/30 bg-aura-danger/5 p-4 text-sm text-aura-graphite">{erro}</p>
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-12 text-center text-sm text-aura-graphite-soft">
          Nenhum contato aqui.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((e) => {
            const s = situacao(e);
            return (
              <li key={e.id} className="relative">
                <button
                  type="button"
                  onClick={() => (e.conversa ? setConversando(e) : setAberto(e))}
                  className="flex h-full w-full flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-4 text-left transition hover:border-aura-petrol-500/40"
                >
                  <div className={`flex items-start justify-between gap-2 ${podeExcluir ? "pr-8" : ""}`}>
                    <p className="truncate font-medium text-aura-graphite">{e.nome || e.telefone || e.email || "Sem nome"}</p>
                    <span className="shrink-0 text-xs text-aura-graphite-soft">{quando(e.created_at)}</span>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
                        e.conversa ? "bg-[#CD1C1B]/10 text-[#9b1515]" : "bg-aura-petrol-700/10 text-aura-petrol-700"
                      }`}
                    >
                      {e.formulario ?? "Formulário do site"}
                    </span>
                    {e.conversa && e.conversa.nao_lidas > 0 && (
                      <span className="rounded-full bg-[#CD1C1B] px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                        {e.conversa.nao_lidas} nova{e.conversa.nao_lidas > 1 ? "s" : ""}
                      </span>
                    )}
                    {e.conversa?.visitante_visto_em && Date.now() - new Date(e.conversa.visitante_visto_em).getTime() < 60_000 && (
                      <span className="text-[0.7rem] font-medium text-emerald-700">● no site agora</span>
                    )}
                  </span>
                  {e.conversa?.ultima_mensagem && <p className="line-clamp-2 text-xs text-aura-graphite">{e.conversa.ultima_mensagem}</p>}
                  <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                    <MapPin size={12} /> {e.cidade || "Cidade não informada"}
                    {e.perfil ? ` · ${e.perfil}` : ""}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${s.classe}`}>{s.texto}</span>
                    {e.lead?.dono && !e.transferido_para && <span className="truncate text-xs text-aura-graphite-soft">com {e.lead.dono}</span>}
                  </div>
                </button>
                {podeExcluir && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void excluir(e)}
                    aria-label={`Excluir ${e.nome || "contato"}`}
                    title="Excluir"
                    className="absolute right-2 top-2 rounded-full p-2 text-aura-graphite-soft transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={() => setAberto(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-aura-graphite">{aberto.nome || "Sem nome"}</p>
                <p className="text-xs text-aura-graphite-soft">
                  {aberto.formulario ?? "Formulário do site"} · {new Date(aberto.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button type="button" onClick={() => setAberto(null)} aria-label="Fechar" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
                <X size={18} />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {Object.entries(aberto.dados ?? {}).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-aura-graphite-soft capitalize">{k}</dt>
                  <dd className="break-words text-aura-graphite">{v === true ? "sim" : v === false ? "não" : String(v)}</dd>
                </div>
              ))}
              {aberto.utm?.utm_campaign && (
                <div className="contents">
                  <dt className="text-aura-graphite-soft">Campanha</dt>
                  <dd className="text-aura-graphite">{aberto.utm.utm_campaign}</dd>
                </div>
              )}
              {aberto.origem_url && (
                <div className="contents">
                  <dt className="text-aura-graphite-soft">Página</dt>
                  <dd className="break-all text-aura-graphite">{aberto.origem_url}</dd>
                </div>
              )}
              <div className="contents">
                <dt className="text-aura-graphite-soft">Situação</dt>
                <dd className="text-aura-graphite">
                  {situacao(aberto).texto}
                  {aberto.lead?.dono && !aberto.transferido_para ? ` · com ${aberto.lead.dono}` : ""}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setEditandoContato(aberto);
                  setAberto(null);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50"
              >
                <Pencil size={16} /> {podeExcluir ? "Editar ou excluir" : "Editar dados"}
              </button>
              {aberto.telefone && (
                <a
                  href={`https://wa.me/${aberto.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-aura-petrol-700 px-4 text-sm font-medium text-white hover:bg-aura-petrol-600"
                >
                  <MessageCircle size={16} /> Chamar no WhatsApp
                </a>
              )}
              {!aberto.transferido_para && aberto.lead?.status !== "respondido" && (
                <>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void marcarAtendido(aberto)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} /> Atendido · vai para o pipeline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferindo(aberto);
                      setAberto(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50"
                  >
                    <ArrowRightLeft size={16} /> Transferir para vendedor
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="mt-4 flex flex-col gap-3 border-t border-aura-mist pt-5" aria-label="Clientes e parceiros">
        <h2 className="font-display text-base font-semibold text-aura-graphite">
          Clientes e parceiros · manuais e blocos 3D ·{" "}
          {deClientes.filter((e) => (e.etapa ?? "novo") !== "resolvido").length} em aberto
        </h2>
        {carregando ? (
          <div className="flex justify-center py-10 text-aura-graphite-soft">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <ClientesParceiros
            envios={deClientes as unknown as EnvioCliente[]}
            onMudou={() => void carregar()}
            onEditar={(id) => setEditandoContato(envios.find((x) => x.id === id) ?? null)}
            onExcluir={podeExcluir ? (id) => void excluir(envios.find((x) => x.id === id) ?? { id, nome: null }) : undefined}
          />
        )}
      </section>

      {conversando?.conversa && (
        <ConversaSite
          conversaId={conversando.conversa.id}
          podeAgir={!conversando.transferido_para && conversando.lead?.status !== "respondido" && conversando.lead?.empresa === EMPRESA_DO_SITE}
          ocupado={ocupado}
          onFechar={() => {
            setConversando(null);
            void carregar();
          }}
          onAtendido={() => void marcarAtendido(conversando)}
          onTransferir={() => {
            setTransferindo(conversando);
            setConversando(null);
          }}
          onEditar={() => {
            setEditandoContato(conversando);
            setConversando(null);
          }}
        />
      )}

      {editandoContato && (
        <EditarContato
          contato={editandoContato}
          podeExcluir={podeExcluir}
          onFechar={() => setEditandoContato(null)}
          onFeito={() => {
            setEditandoContato(null);
            void carregar();
          }}
        />
      )}

      {transferindo && (
        <TransferirLead
          envio={transferindo}
          onFechar={() => setTransferindo(null)}
          onFeito={async () => {
            setTransferindo(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function TransferirLead({ envio, onFechar, onFeito }: { envio: Envio; onFechar: () => void; onFeito: () => void }) {
  const sugerida = lojaSugerida(envio.cidade);
  const [empresa, setEmpresa] = useState<string>(sugerida ?? "");
  const [vendedores, setVendedores] = useState<{ id: string; nome: string; cargo: string }[]>([]);
  const [vendedorId, setVendedorId] = useState<string>("");
  const [recado, setRecado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setVendedorId("");
    setVendedores([]);
    if (!empresa) return;
    fetch(`/api/site/vendedores?empresa=${encodeURIComponent(empresa)}`)
      .then((r) => r.json())
      .then((j) => setVendedores(j.vendedores ?? []))
      .catch(() => setVendedores([]));
  }, [empresa]);

  async function transferir() {
    if (!empresa) return setErro("Escolha a loja.");
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/site/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "transferir", envioId: envio.id, empresa, vendedorId: vendedorId || null, recado }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui transferir.");
      onFeito();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui transferir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label="Transferir para vendedor" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">Transferir para vendedor</p>
            <p className="text-xs text-aura-graphite-soft">
              {envio.nome || "Sem nome"}
              {envio.cidade ? ` · ${envio.cidade}` : ""}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
            <X size={18} />
          </button>
        </div>

        {sugerida && (
          <p className="mt-4 rounded-xl border border-aura-mist bg-aura-bg px-3 py-2.5 text-sm text-aura-graphite">
            A AURA sugere a <strong>{sugerida}</strong>, que atende {envio.cidade?.split("/")[0]}.
          </p>
        )}

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-aura-graphite">Para qual loja</legend>
          {EMPRESAS.map((e) => (
            <label
              key={e.id}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${
                empresa === e.nome ? "border-aura-petrol-600 bg-aura-petrol-700/5" : "border-aura-mist"
              }`}
            >
              <input type="radio" name="loja" checked={empresa === e.nome} onChange={() => setEmpresa(e.nome)} />
              {e.nome === EMPRESA_DO_SITE ? "MF International (outro vendedor da MF)" : e.nome}
              {e.nome === sugerida && <span className="ml-auto text-xs font-medium text-aura-petrol-600">sugerida</span>}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
          Vendedor responsável
          <select
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            disabled={!empresa}
            className="min-h-11 rounded-xl border border-aura-mist bg-white px-3 text-sm font-normal"
          >
            <option value="">{empresa ? "Fila da loja (distribui sozinho)" : "Escolha a loja primeiro"}</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome} · {v.cargo}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
          Recado para quem recebe
          <textarea
            rows={3}
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            placeholder="Ex.: quer fogão a lenha, pediu para ver pessoalmente."
            className="rounded-xl border border-aura-mist px-3 py-2 text-sm font-normal"
          />
        </label>

        <p className="mt-3 text-xs leading-relaxed text-aura-graphite-soft">
          O lead vai com os dados do formulário e o recado. Entra na fila da loja escolhida e segue para o pipeline de lá quando for atendido. Aqui fica anotado para onde foi.
        </p>

        {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void transferir()}
            disabled={enviando || !empresa}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aura-petrol-700 px-5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
