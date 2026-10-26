"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MapPin, MessageCircle, Sparkles, UserCheck, X } from "lucide-react";
import { EMPRESAS } from "@/lib/companies";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";

export interface EnvioCliente {
  id: string;
  created_at: string;
  dados: Record<string, string | boolean>;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  perfil: string | null;
  formulario: string | null;
  etapa: "novo" | "em_atendimento" | "resolvido";
  responsavel: string | null;
  nota: string | null;
}

const ETAPAS: { id: EnvioCliente["etapa"]; nome: string; cor: string }[] = [
  { id: "novo", nome: "Novo", cor: "bg-amber-100 text-amber-900" },
  { id: "em_atendimento", nome: "Em atendimento", cor: "bg-sky-100 text-sky-900" },
  { id: "resolvido", nome: "Resolvido", cor: "bg-emerald-100 text-emerald-900" },
];

function quando(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function postar(corpo: Record<string, unknown>) {
  const r = await fetch("/api/site/atendimento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Não consegui salvar.");
  return j;
}

/**
 * Quem já é cliente ou parceiro (pediu manual, bloco 3D…): não é lead de
 * venda. Funil curto: Novo → Em atendimento → Resolvido, com um responsável
 * que pode ser de qualquer loja (o pós-venda da LF, por exemplo).
 */
export function ClientesParceiros({ envios, onMudou }: { envios: EnvioCliente[]; onMudou: () => void }) {
  const [aberto, setAberto] = useState<EnvioCliente | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-aura-graphite-soft">
        Pedidos de quem já tem lareira MF ou é parceiro (manuais, blocos 3D). Não entram na fila de vendas. Direcione para quem vai cuidar e acompanhe até resolver.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {ETAPAS.map((etapa) => {
          const lista = envios.filter((e) => (e.etapa ?? "novo") === etapa.id);
          return (
            <section key={etapa.id} className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white/60 p-3">
              <p className="flex items-center justify-between px-1 text-sm font-medium text-aura-graphite">
                {etapa.nome}
                <span className="rounded-full bg-aura-mist px-2 py-0.5 text-xs text-aura-graphite-soft">{lista.length}</span>
              </p>
              {lista.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-aura-graphite-soft">Nada aqui.</p>
              ) : (
                lista.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setAberto(e)}
                    className="flex flex-col gap-1.5 rounded-xl border border-aura-mist bg-white p-3 text-left transition hover:border-aura-petrol-500/40"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-aura-graphite">{e.nome || e.telefone || "Sem nome"}</span>
                      <span className="shrink-0 text-xs text-aura-graphite-soft">{quando(e.created_at)}</span>
                    </span>
                    <span className="w-fit rounded-full bg-aura-petrol-700/10 px-2 py-0.5 text-[0.7rem] font-medium text-aura-petrol-700">{e.formulario ?? "Formulário do site"}</span>
                    <span className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                      <MapPin size={12} /> {e.cidade || "Cidade não informada"}
                      {e.perfil ? ` · ${e.perfil}` : ""}
                    </span>
                    {e.responsavel && <span className="text-xs text-aura-graphite">com {e.responsavel.split(" - ")[0]}</span>}
                  </button>
                ))
              )}
            </section>
          );
        })}
      </div>

      {aberto && (
        <DetalheCliente
          envio={aberto}
          onFechar={() => setAberto(null)}
          onMudou={() => {
            setAberto(null);
            onMudou();
          }}
        />
      )}
    </div>
  );
}

function DetalheCliente({ envio, onFechar, onMudou }: { envio: EnvioCliente; onFechar: () => void; onMudou: () => void }) {
  const [empresa, setEmpresa] = useState(EMPRESA_DO_SITE);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string; cargo: string }[]>([]);
  const [pessoa, setPessoa] = useState("");
  const [recado, setRecado] = useState("");
  const [nota, setNota] = useState(envio.nota ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setPessoa("");
    fetch(`/api/site/vendedores?todos=1&empresa=${encodeURIComponent(empresa)}`)
      .then((r) => r.json())
      .then((j) => setPessoas(j.vendedores ?? []))
      .catch(() => setPessoas([]));
  }, [empresa]);

  async function fazer(corpo: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return;
    setOcupado(true);
    setErro(null);
    try {
      await postar({ envioId: envio.id, ...corpo });
      onMudou();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui salvar.");
    } finally {
      setOcupado(false);
    }
  }

  const proxima = envio.etapa === "novo" ? "em_atendimento" : envio.etapa === "em_atendimento" ? "resolvido" : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label={`Pedido de ${envio.nome ?? "cliente"}`} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">{envio.nome || "Sem nome"}</p>
            <p className="text-xs text-aura-graphite-soft">
              {envio.formulario ?? "Formulário do site"} · {new Date(envio.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {Object.entries(envio.dados ?? {}).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="capitalize text-aura-graphite-soft">{k}</dt>
              <dd className="break-words text-aura-graphite">{v === true ? "sim" : v === false ? "não" : String(v)}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="text-aura-graphite-soft">Situação</dt>
            <dd className="text-aura-graphite">
              {ETAPAS.find((e) => e.id === envio.etapa)?.nome ?? "Novo"}
              {envio.responsavel ? ` · com ${envio.responsavel.split(" - ")[0]}` : ""}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {envio.telefone && (
            <a
              href={`https://wa.me/${envio.telefone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-aura-petrol-700 px-4 text-sm font-medium text-white hover:bg-aura-petrol-600"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          {proxima && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void fazer({ acao: "etapa", etapa: proxima, nota })}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
            >
              <ArrowRight size={15} /> {proxima === "em_atendimento" ? "Estou atendendo" : "Resolvido"}
            </button>
          )}
        </div>

        <section className="mt-5 flex flex-col gap-2 rounded-xl border border-aura-mist p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
            <UserCheck size={15} /> Direcionar para alguém
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="min-h-10 rounded-xl border border-aura-mist bg-white px-3 text-sm" aria-label="Loja">
              {EMPRESAS.map((e) => (
                <option key={e.id} value={e.nome}>
                  {e.nome}
                </option>
              ))}
            </select>
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="min-h-10 rounded-xl border border-aura-mist bg-white px-3 text-sm" aria-label="Pessoa">
              <option value="">Escolha a pessoa</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} · {p.cargo}
                </option>
              ))}
            </select>
          </div>
          <input
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            placeholder="Recado (ex.: precisa do manual da Adatto 90)"
            className="min-h-10 rounded-xl border border-aura-mist px-3 text-sm"
          />
          <button
            type="button"
            disabled={ocupado || !pessoa}
            onClick={() => void fazer({ acao: "responsavel", vendedorId: pessoa, recado })}
            className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-aura-petrol-700 px-4 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {ocupado && <Loader2 size={15} className="animate-spin" />} Direcionar e avisar
          </button>
        </section>

        <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-aura-graphite">
          Anotação
          <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} className="rounded-xl border border-aura-mist px-3 py-2 text-sm font-normal" placeholder="O que foi feito, o que falta" />
        </label>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void fazer({ acao: "etapa", etapa: envio.etapa ?? "novo", nota })}
          className="mt-2 min-h-9 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite disabled:opacity-60"
        >
          Salvar anotação
        </button>

        <div className="mt-5 border-t border-aura-mist pt-4">
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              void fazer({ acao: "virar_lead" }, "Mandar para a fila de leads da MF como venda nova? Ele sai de Clientes e parceiros e entra no pipeline quando for atendido.")
            }
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
          >
            <Sparkles size={15} /> É venda nova: virar lead
          </button>
        </div>

        {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}
      </div>
    </div>
  );
}
