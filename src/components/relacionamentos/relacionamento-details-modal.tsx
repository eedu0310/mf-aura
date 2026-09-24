"use client";

import { useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Relacionamento, CategoriaRelacionamento, TemperaturaRelacionamento } from "@/lib/types";
import { formatarTelefone } from "@/lib/format-phone";

const CATEGORIAS: CategoriaRelacionamento[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Distribuidor",
  "Outro",
];

const TEMPERATURAS: TemperaturaRelacionamento[] = ["quente", "ativo", "esfriando", "frio"];

export function RelacionamentoDetailsModal({
  relacionamento,
  onClose,
  onDelete,
}: {
  relacionamento: Relacionamento;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { updateRelacionamento, deleteRelacionamento } = useAppData();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const [formData, setFormData] = useState({
    nome: relacionamento.nome,
    categoria: relacionamento.categoria,
    telefone: relacionamento.telefone || "",
    email: relacionamento.email || "",
    cidade: relacionamento.cidade || "",
    temperatura: relacionamento.temperatura,
    proximoContato: relacionamento.proximoContato,
  });

  async function salvarEdicoes() {
    setSalvando(true);
    try {
      await updateRelacionamento(relacionamento.id, {
        nome: formData.nome,
        categoria: formData.categoria,
        telefone: formData.telefone || undefined,
        email: formData.email || undefined,
        cidade: formData.cidade || undefined,
        temperatura: formData.temperatura,
        proximoContato: formData.proximoContato,
      });
      setEditando(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      window.alert(error instanceof Error ? error.message : "Não consegui salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm("Tem certeza que deseja excluir este relacionamento?")) return;
    setDeletando(true);
    try {
      await deleteRelacionamento(relacionamento.id);
      onDelete(relacionamento.id);
      onClose();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      window.alert(error instanceof Error ? error.message : "Não foi possível excluir o relacionamento.");
    } finally {
      setDeletando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">
              {editando ? "Editar Relacionamento" : "Detalhes do Relacionamento"}
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              ID: {relacionamento.id.slice(0, 8)}...
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
                <p className="text-xs font-medium text-aura-graphite-soft">Nome</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.nome}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Categoria</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.categoria}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Telefone</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.telefone || "-"}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Email</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.email || "-"}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Cidade</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.cidade || "-"}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Temperatura</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.temperatura}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Próximo Contato</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.proximoContato}
                </p>
              </div>
              <div className="rounded-xl bg-aura-bg p-4">
                <p className="text-xs font-medium text-aura-graphite-soft">Último Contato</p>
                <p className="mt-1 text-sm font-semibold text-aura-graphite">
                  {relacionamento.ultimoContato || "-"}
                </p>
              </div>
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
                Nome *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Categoria
                </label>
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaRelacionamento })}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Temperatura
                </label>
                <select
                  value={formData.temperatura}
                  onChange={(e) => setFormData({ ...formData, temperatura: e.target.value as TemperaturaRelacionamento })}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                >
                  {TEMPERATURAS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Próximo Contato
              </label>
              <input
                type="text"
                value={formData.proximoContato}
                onChange={(e) => setFormData({ ...formData, proximoContato: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                disabled={salvando}
              />
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
