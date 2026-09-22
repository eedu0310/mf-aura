"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, MessageCircle, ShieldQuestion, Target } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { FUNIL, MANUAL, MENSAGENS, OBJECOES, PINNED } from "@/lib/mapa-comercial-conteudo";

type Mensagem = { t: string; copy?: string; d?: string };
type Modulo = { title: string; desc?: string; children?: readonly { t: string; d?: string; copy?: string }[] };

export function FunilAtendimento() {
  const { relacionamentos } = useAppData();
  const [secao, setSecao] = useState<"funil" | "mensagens" | "objecoes" | "manual">("funil");
  const [aberta, setAberta] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [busca, setBusca] = useState("");
  const cliente = relacionamentos.find((item) => item.id === clienteId);
  const telefone = cliente?.telefone?.replace(/\D/g, "") || "";
  const nomeCliente = cliente?.nome || "cliente";
  const mensagens = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = (MENSAGENS as readonly Modulo[]).flatMap((modulo) => (modulo.children ?? []).map((item) => ({ ...item, modulo: modulo.title })));
    return termo ? todos.filter((item) => `${item.t}${item.d ?? ""}${item.copy ?? ""}`.toLowerCase().includes(termo)) : todos;
  }, [busca]);

  function personalizar(texto: string) {
    return texto.replaceAll("[Nome]", nomeCliente);
  }

  async function copiar(id: string, texto: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const area = document.createElement("textarea");
        area.value = texto;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
    } catch (error) {
      console.error("Não foi possível copiar a mensagem:", error);
      return;
    }
    setCopiada(id);
    window.setTimeout(() => setCopiada(null), 1400);
  }

  function MensagemCard({ item, id }: { item: Mensagem; id: string }) {
    const texto = personalizar(item.copy ?? item.d ?? "");
    return <article className="rounded-xl border border-aura-mist bg-white p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-aura-graphite">{item.t}</p>{item.d && <p className="mt-1 text-[0.7rem] leading-relaxed text-aura-graphite-soft">{item.d}</p>}<p className="mt-2 whitespace-pre-line rounded-lg bg-aura-bg p-2.5 text-xs leading-relaxed text-aura-graphite">{texto}</p></div><button type="button" onClick={() => void copiar(id, texto)} className="shrink-0 rounded-lg p-1.5 text-aura-petrol-700 hover:bg-aura-bg" aria-label={`Copiar ${item.t}`}>{copiada === id ? <Check size={15} /> : <Copy size={15} />}</button></div>{telefone ? <a className="mt-2 inline-flex items-center gap-1 text-[0.7rem] font-medium text-aura-success underline" href={`https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle size={12} /> Enviar para {cliente?.nome}</a> : <p className="mt-2 text-[0.7rem] text-aura-graphite-soft">Selecione um cliente com WhatsApp cadastrado para enviar direto.</p>}</article>;
  }

  return <section className="overflow-hidden rounded-2xl border border-aura-mist bg-white" aria-labelledby="funil-atendimento-titulo">
    <div className="border-b border-aura-mist px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700"><Target size={18} /></span><div><h2 id="funil-atendimento-titulo" className="text-sm font-semibold text-aura-graphite">Mapa Comercial completo</h2><p className="text-xs text-aura-graphite-soft">Funil, cadências, mensagens, objeções e manual de vendas.</p></div></div><div className="mt-4 flex gap-1 overflow-x-auto">{([["funil", "Funil"], ["mensagens", "Mensagens"], ["objecoes", "Objeções"], ["manual", "Manual"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setSecao(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${secao === id ? "bg-aura-petrol-700 text-white" : "bg-aura-bg text-aura-graphite-soft"}`}>{label}</button>)}</div>{secao !== "funil" && <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs outline-none focus:border-aura-petrol-500"><option value="">Selecione o cliente do CRM para WhatsApp</option>{relacionamentos.filter((item) => item.telefone).map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.telefone}</option>)}</select>{secao === "mensagens" && <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar mensagem, obra, caro, follow-up..." className="rounded-lg border border-aura-mist px-3 py-2 text-xs outline-none focus:border-aura-petrol-500" />}</div>}</div>
    {secao === "funil" && <div className="space-y-2 p-4">{(FUNIL as readonly Modulo[]).map((modulo) => <div key={modulo.title} className="overflow-hidden rounded-xl border border-aura-mist"><button type="button" onClick={() => setAberta(aberta === modulo.title ? null : modulo.title)} className="flex w-full items-center justify-between px-3 py-3 text-left"><span><span className="block text-xs font-semibold text-aura-graphite">{modulo.title}</span>{modulo.desc && <span className="mt-1 block text-[0.7rem] text-aura-graphite-soft">{modulo.desc}</span>}</span><ChevronDown size={15} className={aberta === modulo.title ? "rotate-180" : ""} /></button>{aberta === modulo.title && <div className="space-y-2 border-t border-aura-mist bg-aura-bg p-3">{(modulo.children ?? []).map((item) => <div key={item.t} className="rounded-lg bg-white p-3"><p className="text-xs font-semibold text-aura-graphite">{item.t}</p>{item.d && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-aura-graphite-soft">{item.d}</p>}</div>)}</div>}</div>)}</div>}
    {secao === "mensagens" && <div className="space-y-4 p-4">{PINNED.map((item, index) => <MensagemCard key={`pinned-${index}`} item={item} id={`pinned-${index}`} />)}{(MENSAGENS as readonly Modulo[]).map((modulo) => { const itens = mensagens.filter((item) => item.modulo === modulo.title); return <div key={modulo.title}><button type="button" onClick={() => setAberta(aberta === modulo.title ? null : modulo.title)} className="flex w-full items-center justify-between rounded-xl bg-aura-bg px-3 py-3 text-left"><span><span className="block text-xs font-semibold text-aura-graphite">{modulo.title}</span><span className="text-[0.7rem] text-aura-graphite-soft">{modulo.children?.length ?? 0} mensagens de cadência</span></span><ChevronDown size={15} className={aberta === modulo.title ? "rotate-180" : ""} /></button>{aberta === modulo.title && <div className="mt-2 space-y-2">{itens.map((item, index) => <MensagemCard key={`${modulo.title}-${index}`} item={{ t: item.t, copy: item.copy ?? "", d: item.d }} id={`${modulo.title}-${index}`} />)}</div>}</div>})}</div>}
    {secao === "objecoes" && <div className="space-y-2 p-4">{(OBJECOES as readonly Mensagem[]).map((item, index) => <MensagemCard key={item.t} item={item} id={`objecao-${index}`} />)}<div className="flex items-center gap-2 border-t border-aura-mist pt-3 text-[0.7rem] text-aura-graphite-soft"><ShieldQuestion size={14} /> Toda objeção deve terminar com um próximo passo claro.</div></div>}
    {secao === "manual" && <div className="space-y-2 p-4">{(MANUAL as readonly Modulo[]).map((modulo) => <div key={modulo.title} className="overflow-hidden rounded-xl border border-aura-mist"><button type="button" onClick={() => setAberta(aberta === modulo.title ? null : modulo.title)} className="flex w-full items-center justify-between px-3 py-3 text-left"><span><span className="block text-xs font-semibold text-aura-graphite">{modulo.title}</span>{modulo.desc && <span className="mt-1 block text-[0.7rem] text-aura-graphite-soft">{modulo.desc}</span>}</span><ChevronDown size={15} className={aberta === modulo.title ? "rotate-180" : ""} /></button>{aberta === modulo.title && <div className="space-y-2 border-t border-aura-mist bg-aura-bg p-3">{(modulo.children ?? []).map((item) => <div key={item.t} className="rounded-lg bg-white p-3"><p className="text-xs font-semibold text-aura-graphite">{item.t}</p>{item.d && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-aura-graphite-soft">{item.d}</p>}{item.copy && <button type="button" onClick={() => void copiar(item.t, item.copy ?? "")} className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-aura-petrol-700"><Copy size={12} /> Copiar texto</button>}</div>)}</div>}</div>)}</div>}
  </section>;
}
