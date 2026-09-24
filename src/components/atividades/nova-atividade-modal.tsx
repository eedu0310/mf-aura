"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import type { TipoAtividade } from "@/lib/types";

const TIPOS_ATIVIDADE: TipoAtividade[] = [
  "Ligação",
  "Email",
  "Visita",
  "Reunião",
  "Follow-up",
  "Outro",
];

export function NovaAtividadeModal({
  onClose,
  onCriada,
}: {
  onClose: () => void;
  onCriada: () => void;
}) {
  const { addAtividade, relacionamentos } = useAppData();
  const { profile } = useUserProfile();
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    tipo: "Ligação" as TipoAtividade,
    titulo: "",
    contexto: "",
    quando: new Date().toISOString().slice(0, 16),
    relacionamentoId: "",
    anotacoes: "",
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      await addAtividade({
        vendedorId: "",
        tipo: formData.tipo,
        titulo: formData.titulo,
        contexto: formData.contexto,
        quando: new Date(formData.quando).toISOString(),
        relacionamentoId: formData.relacionamentoId || undefined,
        anotacoes: formData.anotacoes || undefined,
        // A loja vem do perfil de quem está registrando: antes ficava fixo
        // em "LF Lareiras" e um vendedor da MF gravava na loja errada.
        empresa: profile.empresa,
      });

      onCriada();
      onClose();
    } catch (error) {
      console.error("Erro ao criar atividade:", error);
      alert("Erro ao criar atividade");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">
              Nova Atividade
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-5">
          {/* Tipo */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Tipo de Atividade *
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoAtividade })}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            >
              {TIPOS_ATIVIDADE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Título *
            </label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Ligar para João da Silva"
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            />
          </div>

          {/* Contexto */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Contexto *
            </label>
            <textarea
              value={formData.contexto}
              onChange={(e) => setFormData({ ...formData, contexto: e.target.value })}
              placeholder="Descrição detalhada da atividade"
              rows={3}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            />
          </div>

          {/* Data e Hora */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Data e Hora
            </label>
            <input
              type="datetime-local"
              value={formData.quando}
              onChange={(e) => setFormData({ ...formData, quando: e.target.value })}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            />
          </div>

          {/* Relacionamento */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Relacionamento (opcional)
            </label>
            <select
              value={formData.relacionamentoId}
              onChange={(e) => setFormData({ ...formData, relacionamentoId: e.target.value })}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            >
              <option value="">Selecionar...</option>
              {relacionamentos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Anotações */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Anotações
            </label>
            <textarea
              value={formData.anotacoes}
              onChange={(e) => setFormData({ ...formData, anotacoes: e.target.value })}
              placeholder="Anotações adicionais"
              rows={2}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              disabled={salvando}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 border-t border-aura-mist pt-5">
            <button
              type="submit"
              disabled={salvando || !formData.titulo || !formData.contexto}
              className="flex-1 rounded-lg bg-aura-petrol-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
            >
              {salvando ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Criando...
                </div>
              ) : (
                "Criar Atividade"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="flex-1 rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm font-medium text-aura-graphite hover:bg-aura-bg disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}