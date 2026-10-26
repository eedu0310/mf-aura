"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

export interface ContatoEditavel {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
}

/**
 * Corrigir os dados de quem chegou pelo site, ou excluir (spam, teste,
 * repetido). Excluir só aparece para o gestor.
 */
export function EditarContato({
  contato,
  podeExcluir,
  onFechar,
  onFeito,
}: {
  contato: ContatoEditavel;
  podeExcluir: boolean;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const [nome, setNome] = useState(contato.nome ?? "");
  const [telefone, setTelefone] = useState(contato.telefone ?? "");
  const [email, setEmail] = useState(contato.email ?? "");
  const [cidade, setCidade] = useState(contato.cidade ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(corpo: Record<string, unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/site/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envioId: contato.id, ...corpo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não consegui salvar.");
      onFeito();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui salvar.");
    } finally {
      setOcupado(false);
    }
  }

  const entrada = "min-h-11 rounded-xl border border-aura-mist bg-white px-3 text-sm font-normal outline-none focus:border-aura-petrol-500";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label="Editar contato" className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-semibold text-aura-graphite">Editar contato</p>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-aura-graphite">
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-aura-graphite">
            WhatsApp
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(51) 99999-9999" className={entrada} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-aura-graphite">
            E-mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={entrada} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-aura-graphite">
            Cidade
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={entrada} />
          </label>
          <p className="text-xs text-aura-graphite-soft">A correção vale também para o lead na fila da MF e para a conversa do chat.</p>
        </div>
        {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {podeExcluir ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (confirm("Excluir este contato? Ele sai do Atendimento, a conversa do chat é apagada e o lead também, se ainda não foi atendido. Não dá para desfazer.")) {
                  void enviar({ acao: "excluir" });
                }
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 size={15} /> Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="min-h-11 rounded-full border border-aura-mist px-4 text-sm font-medium text-aura-graphite">
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void enviar({ acao: "editar", nome, telefone, email, cidade })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aura-petrol-700 px-5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
            >
              {ocupado && <Loader2 size={15} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
