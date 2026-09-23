"use client";

import { useState } from "react";
import { X, Trash2, Download, Upload, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Oportunidade, Etapa, Probabilidade } from "@/lib/types";

const ETAPAS: Etapa[] = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados", "Perdidos"];
const PROBABILIDADES: Probabilidade[] = ["Baixa", "Média", "Alta"];

export function OportunidadeDetailsModal({
  oportunidade,
  onClose,
  onDelete,
}: {
  oportunidade: Oportunidade;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { updateOportunidade, deleteOportunidade } = useAppData();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [uploadandoOrcamento, setUploadandoOrcamento] = useState(false);

  const [formData, setFormData] = useState({
    cliente: oportunidade.cliente,
    produto: oportunidade.produto || "",
    valor: oportunidade.valor,
    etapa: oportunidade.etapa,
    probabilidade: oportunidade.probabilidade,
  });

  async function salvarEdicoes() {
    setSalvando(true);
    try {
      updateOportunidade(oportunidade.id, {
        cliente: formData.cliente,
        produto: formData.produto || undefined,
        valor: formData.valor,
        etapa: formData.etapa as Etapa,
        probabilidade: formData.probabilidade as Probabilidade,
      });
      setEditando(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm("Tem certeza que deseja excluir esta oportunidade?")) return;
    setDeletando(true);
    try {
      deleteOportunidade(oportunidade.id);
      onDelete(oportunidade.id);
      onClose();
    } catch (error) {
      console.error("Erro ao excluir:", error);
    } finally {
      setDeletando(false);
    }
  }

  async function handleUploadOrcamento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadandoOrcamento(true);
    try {
      // Aqui você implementaria o upload do arquivo
      // Por enquanto, apenas mostramos um feedback
      alert(`Orçamento "${file.name}" será anexado em breve`);
    } finally {
      setUploadandoOrcamento(false);
    }
  }

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">
              {editando ? "Editar Oportunidade" : "Detalhes da Oportunidade"}
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              ID: {oportunidade.id.slice(0, 8)}...
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando || deletando}
            className="text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {!editando ? (
          // MODO VISUALIZAÇÃO
          <div className="space-y-6">
            {/* Informações */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Cliente</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {oportunidade.cliente}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Produto</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {oportunidade.produto || "-"}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Valor</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {formatarMoeda(oportunidade.valor)}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Etapa</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {oportunidade.etapa}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Probabilidade</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {oportunidade.probabilidade}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Empresa</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {oportunidade.empresa || "-"}
                </p>
              </div>
            </div>

            {/* Upload de Orçamento */}
            <div className="rounded-xl border border-aura-mist p-4">
              <div className="flex items-center gap-2 mb-3">
                <Upload size={16} className="text-aura-petrol-600" />
                <p className="text-sm font-medium text-aura-graphite">Anexar Orçamento</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-aura-mist bg-aura-bg/50 px-4 py-8 transition hover:border-aura-petrol-300">
                <input
                  type="file"
                  onChange={handleUploadOrcamento}
                  disabled={uploadandoOrcamento}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                />
                <div className="text-center">
                  {uploadandoOrcamento ? (
                    <Loader2 size={24} className="mx-auto animate-spin text-aura-petrol-600" />
                  ) : (
                    <>
                      <p className="text-sm font-medium text-aura-graphite">
                        Clique para selecionar ou arraste um arquivo
                      </p>
                      <p className="mt-1 text-xs text-aura-graphite-soft">
                        PDF, DOC, DOCX, XLS, XLSX
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="flex-1 rounded-lg bg-aura-petrol-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={deletando}
                className="rounded-lg border border-aura-danger bg-aura-danger/10 px-4 py-2.5 text-sm font-medium text-aura-danger hover:bg-aura-danger/20 disabled:opacity-50"
              >
                {deletando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          </div>
        ) : (
          // MODO EDIÇÃO
          <form className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Cliente *
              </label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Produto
              </label>
              <input
                type="text"
                value={formData.produto}
                onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Valor (R$) *
              </label>
              <input
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Etapa
                </label>
                <select
                  value={formData.etapa}
                  onChange={(e) => setFormData({ ...formData, etapa: e.target.value as Etapa })}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                >
                  {ETAPAS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Probabilidade
                </label>
                <select
                  value={formData.probabilidade}
                  onChange={(e) => setFormData({ ...formData, probabilidade: e.target.value as Probabilidade })}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                >
                  {PROBABILIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botões de Edição */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={salvarEdicoes}
                disabled={salvando}
                className="flex-1 rounded-lg bg-aura-petrol-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
              >
                {salvando ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Salvando...
                  </div>
                ) : (
                  "Salvar"
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={salvando}
                className="flex-1 rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm font-medium text-aura-graphite hover:bg-aura-bg disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}