"use client";

import { useEffect, useState } from "react";
import { X, Check, AlertTriangle, Star, Link2, MessageCircle } from "lucide-react";
import { atualizarPosVenda, type PosVenda, type StatusPosVenda } from "@/lib/supabase/pos-venda";
import { PosVendaTimeline } from "./pos-venda-timeline";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const STATUS_LABEL: Record<StatusPosVenda, string> = {
  aguardando_instalacao: "Aguardando Instalação",
  agendamento_realizado: "Instalação Agendada",
  instalacao_pendente: "Instalação Pendente",
  reclamacao: "Reclamação",
  pos_venda_realizado: "Pós-venda Concluído",
  cliente_antigo: "Cliente antigo",
};

const STATUS_ORDEM: StatusPosVenda[] = [
  "aguardando_instalacao",
  "agendamento_realizado",
  "instalacao_pendente",
  "reclamacao",
  "pos_venda_realizado",
  "cliente_antigo",
];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function PosVendaModal({
  posVenda: pv,
  onClose,
  onAtualizado,
}: {
  posVenda: PosVenda;
  onClose: () => void;
  onAtualizado: (atualizado: PosVenda) => void;
}) {
  const [status, setStatus] = useState<StatusPosVenda>(pv.status);
  const [dataAgendamento, setDataAgendamento] = useState(pv.dataAgendamento ?? "");
  const [horaAgendamento, setHoraAgendamento] = useState(pv.horaAgendamento ?? "");
  const [observacao, setObservacao] = useState(pv.observacao ?? "");
  const [reclamacao, setReclamacao] = useState(pv.reclamacao ?? "");
  const [reclamacaoResolvida, setReclamacaoResolvida] = useState(pv.reclamacaoResolvida);
  const [avaliouLoja, setAvaliouLoja] = useState(pv.avaliouLoja);
  const [notaAvaliacao, setNotaAvaliacao] = useState(pv.notaAvaliacao ?? 0);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState(pv.comentarioAvaliacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  // O telefone vem junto do pós-venda (o banco preenche a partir do cliente).
  // Antes era procurado por semelhança de nome, o que podia trazer o número
  // de outro cliente.
  const telefoneCliente = pv.telefone;

  function linkAvaliacao() {
    return `${window.location.origin}/avaliar/${pv.tokenAvaliacao}`;
  }

  function copiarLinkAvaliacao() {
    navigator.clipboard.writeText(linkAvaliacao());
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  function enviarPorWhatsApp() {
    const numero = telefoneCliente?.replace(/\D/g, "");
    const mensagem = encodeURIComponent(
      `Olá! Poderia avaliar sua experiência com a nossa loja? É rapidinho: ${linkAvaliacao()}`
    );
    const url = numero
      ? `https://wa.me/55${numero}?text=${mensagem}`
      : `https://wa.me/?text=${mensagem}`;
    window.open(url, "_blank");
  }

  async function salvar() {
    setSalvando(true);
    const patch: Partial<PosVenda> = {
      status,
      dataAgendamento: dataAgendamento || null,
      horaAgendamento: horaAgendamento || null,
      observacao: observacao.trim() || null,
      reclamacao: reclamacao.trim() || null,
      reclamacaoResolvida,
      avaliouLoja,
      notaAvaliacao: avaliouLoja && notaAvaliacao > 0 ? notaAvaliacao : null,
      comentarioAvaliacao: comentarioAvaliacao.trim() || null,
    };
    await atualizarPosVenda(pv.id, patch);
    setSalvando(false);
    onAtualizado({ ...pv, ...patch });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">{pv.cliente}</p>
            <p className="text-xs text-aura-graphite-soft">
              {pv.origem === "cliente_antigo"
                ? `Cliente antigo${pv.produto && pv.produto !== "Cliente antigo" ? ` · ${pv.produto}` : ""}`
                : `${pv.produto} · ${formatarMoeda(pv.valor)}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="aura-label">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDEM.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                    status === s
                      ? "border-aura-petrol-500/40 bg-aura-petrol-500/10 text-aura-petrol-600"
                      : "border-aura-mist bg-aura-surface text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="aura-label">Data instalação</label>
              <input
                type="date"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="aura-input"
              />
            </div>
            <div>
              <label className="aura-label">Hora</label>
              <input
                type="time"
                value={horaAgendamento}
                onChange={(e) => setHoraAgendamento(e.target.value)}
                className="aura-input"
              />
            </div>
          </div>

          <div>
            <label className="aura-label">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: instalador João, cliente prefere período da manhã"
              className="aura-input resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
              <AlertTriangle size={14} className="text-aura-warning" />
              Reclamação (se houver)
            </label>
            <textarea
              value={reclamacao}
              onChange={(e) => setReclamacao(e.target.value)}
              rows={2}
              placeholder="Descreva a reclamação do cliente"
              className="aura-input resize-none"
            />
            {reclamacao.trim() && (
              <label className="mt-2 flex items-center gap-2 text-sm text-aura-graphite">
                <input
                  type="checkbox"
                  checked={reclamacaoResolvida}
                  onChange={(e) => setReclamacaoResolvida(e.target.checked)}
                  className="h-4 w-4 rounded border-aura-mist accent-aura-petrol-600"
                />
                Reclamação já resolvida
              </label>
            )}
          </div>

          <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 p-3.5">
            <label className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
              <input
                type="checkbox"
                checked={avaliouLoja}
                onChange={(e) => setAvaliouLoja(e.target.checked)}
                className="h-4 w-4 rounded border-aura-mist accent-aura-petrol-600"
              />
              Cliente avaliou a loja
            </label>

            {avaliouLoja && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNotaAvaliacao(n)}
                      aria-label={`${n} estrelas`}
                    >
                      <Star
                        size={20}
                        className={n <= notaAvaliacao ? "fill-aura-gold text-aura-gold" : "text-aura-graphite-soft/30"}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={comentarioAvaliacao}
                  onChange={(e) => setComentarioAvaliacao(e.target.value)}
                  placeholder="Comentário da avaliação (opcional)"
                  className="aura-input"
                />
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copiarLinkAvaliacao}
                className="aura-btn aura-btn-secundario aura-btn-sm flex-1"
              >
                {linkCopiado ? <Check size={13} /> : <Link2 size={13} />}
                {linkCopiado ? "Copiado!" : "Copiar link"}
              </button>
              <button
                type="button"
                onClick={enviarPorWhatsApp}
                className="aura-btn aura-btn-secundario aura-btn-sm flex-1 text-aura-success"
              >
                <MessageCircle size={13} />
                {telefoneCliente ? "Enviar por WhatsApp" : "WhatsApp (sem número salvo)"}
              </button>
            </div>
          </div>

          <PosVendaTimeline posVendaId={pv.id} />

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="aura-btn aura-btn-primario aura-btn-lg w-full"
          >
            <Check size={15} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
