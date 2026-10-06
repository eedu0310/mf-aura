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
};

const STATUS_ORDEM: StatusPosVenda[] = [
  "aguardando_instalacao",
  "agendamento_realizado",
  "instalacao_pendente",
  "reclamacao",
  "pos_venda_realizado",
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">{pv.cliente}</p>
            <p className="text-xs text-aura-graphite-soft">
              {pv.produto} · {formatarMoeda(pv.valor)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-aura-graphite-soft hover:text-aura-graphite">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDEM.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    status === s
                      ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                      : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Data instalação</label>
              <input
                type="date"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Hora</label>
              <input
                type="time"
                value={horaAgendamento}
                onChange={(e) => setHoraAgendamento(e.target.value)}
                className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: instalador João, cliente prefere período da manhã"
              className="w-full resize-none rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
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
              className="w-full resize-none rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
            />
            {reclamacao.trim() && (
              <label className="mt-2 flex items-center gap-2 text-sm text-aura-graphite">
                <input
                  type="checkbox"
                  checked={reclamacaoResolvida}
                  onChange={(e) => setReclamacaoResolvida(e.target.checked)}
                  className="h-4 w-4 rounded border-aura-mist text-aura-petrol-700"
                />
                Reclamação já resolvida
              </label>
            )}
          </div>

          <div className="rounded-xl border border-aura-mist bg-aura-bg p-3.5">
            <label className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
              <input
                type="checkbox"
                checked={avaliouLoja}
                onChange={(e) => setAvaliouLoja(e.target.checked)}
                className="h-4 w-4 rounded border-aura-mist text-aura-petrol-700"
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
                        className={n <= notaAvaliacao ? "fill-aura-gold text-aura-gold" : "text-aura-mist"}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={comentarioAvaliacao}
                  onChange={(e) => setComentarioAvaliacao(e.target.value)}
                  placeholder="Comentário da avaliação (opcional)"
                  className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
                />
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copiarLinkAvaliacao}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-aura-mist bg-white py-2 text-xs font-medium text-aura-petrol-600 hover:bg-aura-petrol-700/5"
              >
                {linkCopiado ? <Check size={13} /> : <Link2 size={13} />}
                {linkCopiado ? "Copiado!" : "Copiar link"}
              </button>
              <button
                type="button"
                onClick={enviarPorWhatsApp}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-aura-success/30 bg-aura-success/10 py-2 text-xs font-medium text-aura-success hover:bg-aura-success/20"
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
            className="flex items-center justify-center gap-1.5 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white hover:bg-aura-petrol-600 disabled:opacity-60"
          >
            <Check size={15} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
