"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MapPin, MessageCircle, Pencil, Sparkles, Trash2, UserCheck, X } from "lucide-react";
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
export function ClientesParceiros({
  envios,
  onMudou,
  onEditar,
  onExcluir,
}: {
  envios: EnvioCliente[];
  onMudou: () => void;
  onEditar: (id: string) => void;
  /** Lixeira no cartão (só para gestor). */
  onExcluir?: (id: string) => void;
}) {
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
            <section key={etapa.id} className="flex flex-col gap-2 rounded-xl border border-aura-mist bg-aura-sunken/40 p-3">
              <p className="flex items-center justify-between px-1 text-sm font-medium text-aura-graphite">
                {etapa.nome}
                <span className="rounded-md bg-aura-surface px-1.5 py-0.5 text-xs tabular-nums text-aura-graphite-soft">{lista.length}</span>
              </p>
              {lista.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-aura-graphite-soft">Nada aqui.</p>
              ) : (
                lista.map((e) => (
                  <div key={e.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setAberto(e)}
                    className="aura-card aura-card-interativo flex w-full flex-col gap-1.5 rounded-lg p-3 text-left"
                  >
                    <span className={`flex items-start justify-between gap-2 ${onExcluir ? "pr-7" : ""}`}>
                      <span className="truncate text-sm font-medium text-aura-graphite">{e.nome || e.telefone || "Sem nome"}</span>
                      <span className="shrink-0 text-xs text-aura-graphite-soft">{quando(e.created_at)}</span>
                    </span>
                    <span className="aura-selo aura-selo-marca w-fit">{e.formulario ?? "Formulário do site"}</span>
                    <span className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                      <MapPin size={12} /> {e.cidade || "Cidade não informada"}
                      {e.perfil ? ` · ${e.perfil}` : ""}
                    </span>
                    {e.responsavel && <span className="text-xs text-aura-graphite">com {e.responsavel.split(" - ")[0]}</span>}
                  </button>
                  {onExcluir && (
                    <button
                      type="button"
                      onClick={() => onExcluir(e.id)}
                      aria-label={`Excluir ${e.nome || "contato"}`}
                      title="Excluir"
                      className="absolute right-1.5 top-1.5 rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>

      {aberto && (
        <DetalheCliente
          envio={aberto}
          onEditar={() => {
            const id = aberto.id;
            setAberto(null);
            onEditar(id);
          }}
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

function DetalheCliente({ envio, onFechar, onMudou, onEditar }: { envio: EnvioCliente; onFechar: () => void; onMudou: () => void; onEditar: () => void }) {
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label={`Pedido de ${envio.nome ?? "cliente"}`} className="max-h-[90vh] w-full max-w-lg overflow-y-auto aura-card rounded-b-none p-6 shadow-xl sm:rounded-b-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">{envio.nome || "Sem nome"}</p>
            <p className="text-xs text-aura-graphite-soft">
              {envio.formulario ?? "Formulário do site"} · {new Date(envio.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite">
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
              className="aura-btn aura-btn-primario"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={onEditar}
            className="aura-btn aura-btn-secundario"
          >
            <Pencil size={15} /> Editar
          </button>
          {proxima && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void fazer({ acao: "etapa", etapa: proxima, nota })}
              className="aura-btn aura-btn-secundario"
            >
              <ArrowRight size={15} /> {proxima === "em_atendimento" ? "Estou atendendo" : "Resolvido"}
            </button>
          )}
        </div>

        <section className="mt-5 flex flex-col gap-2 rounded-xl border border-aura-mist p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
            <UserCheck size={15} className="text-aura-petrol-600" /> Direcionar para alguém
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="aura-input" aria-label="Loja">
              {EMPRESAS.map((e) => (
                <option key={e.id} value={e.nome}>
                  {e.nome}
                </option>
              ))}
            </select>
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="aura-input" aria-label="Pessoa">
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
            className="aura-input"
          />
          <button
            type="button"
            disabled={ocupado || !pessoa}
            onClick={() => void fazer({ acao: "responsavel", vendedorId: pessoa, recado })}
            className="aura-btn aura-btn-primario w-fit"
          >
            {ocupado && <Loader2 size={15} className="animate-spin" />} Direcionar e avisar
          </button>
        </section>

        <label className="mt-4 flex flex-col gap-1.5 text-[0.8125rem] font-medium text-aura-graphite">
          Anotação
          <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} className="aura-input font-normal" placeholder="O que foi feito, o que falta" />
        </label>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void fazer({ acao: "etapa", etapa: envio.etapa ?? "novo", nota })}
          className="mt-2 aura-btn aura-btn-secundario aura-btn-sm"
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
            className="aura-btn aura-btn-secundario"
          >
            <Sparkles size={15} /> É venda nova: virar lead
          </button>
        </div>

        {erro && <p role="alert" className="mt-3 rounded-lg border border-aura-danger/30 bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">{erro}</p>}
      </div>
    </div>
  );
}
