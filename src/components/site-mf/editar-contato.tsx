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

  const entrada = "aura-input font-normal";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-label="Editar contato" className="w-full max-w-md aura-card rounded-b-none p-6 shadow-xl sm:rounded-b-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-semibold text-aura-graphite">Editar contato</p>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite">
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
        {erro && <p role="alert" className="mt-3 rounded-lg border border-aura-danger/30 bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">{erro}</p>}
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
              className="aura-btn aura-btn-fantasma text-aura-danger hover:bg-aura-danger/10 hover:text-aura-danger"
            >
              <Trash2 size={15} /> Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="aura-btn aura-btn-secundario">
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void enviar({ acao: "editar", nome, telefone, email, cidade })}
              className="aura-btn aura-btn-primario"
            >
              {ocupado && <Loader2 size={15} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
