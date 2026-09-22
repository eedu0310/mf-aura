"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Oportunidade } from "@/lib/types";

const MOTIVOS_PERDA = [
  "Sem Orçamento",
  "Deixou de Responder",
  "Fechou Castellar",
  "Fechou Metávila",
  "Fechou Quatrun/Stal Kamin",
  "Fechou com loja concorrente",
  "Outros Motivos",
];

interface MotivoPerdaModalProps {
  oportunidade?: Oportunidade;
  clienteNome?: string;
  onClose?: () => void;
  onCancelar?: () => void;
  onConfirm?: (dados: any) => Promise<void>;
  onConfirmar?: (motivo: string, descricao: string) => Promise<void>;
}

export function MotivoPerdaModal(props: MotivoPerdaModalProps) {
  const clienteNome = props.clienteNome ?? props.oportunidade?.cliente ?? "";
  const fechar = props.onCancelar ?? props.onClose ?? (() => {});
  const { updateOportunidade } = useAppData();
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    motivoPerda: "",
    objecao: "",
    concorrente: "",
    condicaoSolicitada: "",
    descontoSolicitado: "",
    descontoConcedido: "",
    contrapartida: "",
    responsavelAprovacao: "",
    resultado: "",
  });

  async function salvar() {
    if (!formData.motivoPerda.trim()) {
      alert("Por favor, selecione um motivo da perda");
      return;
    }

    setSalvando(true);
    try {
      const descricao = JSON.stringify({
        objecao: formData.objecao,
        concorrente: formData.concorrente,
        condicaoSolicitada: formData.condicaoSolicitada,
        descontoSolicitado: formData.descontoSolicitado,
        descontoConcedido: formData.descontoConcedido,
        contrapartida: formData.contrapartida,
        responsavelAprovacao: formData.responsavelAprovacao,
        resultado: formData.resultado,
      });

      if (props.onConfirmar) {
        await props.onConfirmar(formData.motivoPerda, descricao);
      } else {
        if (props.oportunidade) {
          updateOportunidade(props.oportunidade.id, {
            motivoPerda: formData.motivoPerda as any,
            descricaoPerda: descricao,
            dataPerda: new Date().toISOString().slice(0, 10),
          });
        }
        if (props.onConfirm) {
          await props.onConfirm(formData);
        }
      }

      fechar();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao registrar motivo da perda");
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
              Registrar Motivo da Perda
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              {clienteNome}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Motivo da Perda - OBRIGATÓRIO */}
          <div>
            <label className="mb-2.5 block text-sm font-semibold text-aura-graphite">
              Motivo da Perda *
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOTIVOS_PERDA.map((motivo) => (
                <label
                  key={motivo}
                  className="flex items-center gap-3 rounded-lg border-2 border-aura-mist p-3 cursor-pointer transition hover:border-aura-petrol-300"
                >
                  <input
                    type="radio"
                    name="motivoPerda"
                    value={motivo}
                    checked={formData.motivoPerda === motivo}
                    onChange={(e) =>
                      setFormData({ ...formData, motivoPerda: e.target.value })
                    }
                    disabled={salvando}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-aura-graphite">
                    {motivo}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="border-t border-aura-mist pt-5">
            <p className="mb-4 text-sm font-semibold text-aura-graphite">
              Informações Adicionais
            </p>

            <div className="space-y-4">
              {/* Objeção */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Objeção
                </label>
                <textarea
                  value={formData.objecao}
                  onChange={(e) =>
                    setFormData({ ...formData, objecao: e.target.value })
                  }
                  placeholder="Qual foi a objeção principal?"
                  rows={2}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Concorrente */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Concorrente (se informado)
                </label>
                <input
                  type="text"
                  value={formData.concorrente}
                  onChange={(e) =>
                    setFormData({ ...formData, concorrente: e.target.value })
                  }
                  placeholder="Qual concorrente venceu?"
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Condição Solicitada */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Condição Solicitada
                </label>
                <textarea
                  value={formData.condicaoSolicitada}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condicaoSolicitada: e.target.value,
                    })
                  }
                  placeholder="Quais condições o cliente solicitou?"
                  rows={2}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Desconto Solicitado */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Desconto Solicitado
                </label>
                <input
                  type="text"
                  value={formData.descontoSolicitado}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descontoSolicitado: e.target.value,
                    })
                  }
                  placeholder="Ex: 15%"
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Desconto Concedido */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Desconto Concedido
                </label>
                <input
                  type="text"
                  value={formData.descontoConcedido}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descontoConcedido: e.target.value,
                    })
                  }
                  placeholder="Ex: 10%"
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Contrapartida */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Contrapartida
                </label>
                <textarea
                  value={formData.contrapartida}
                  onChange={(e) =>
                    setFormData({ ...formData, contrapartida: e.target.value })
                  }
                  placeholder="Qual foi oferecido em troca?"
                  rows={2}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Responsável pela Aprovação */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Responsável pela Aprovação
                </label>
                <input
                  type="text"
                  value={formData.responsavelAprovacao}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      responsavelAprovacao: e.target.value,
                    })
                  }
                  placeholder="Quem aprovou a negociação?"
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>

              {/* Resultado */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                  Resultado
                </label>
                <textarea
                  value={formData.resultado}
                  onChange={(e) =>
                    setFormData({ ...formData, resultado: e.target.value })
                  }
                  placeholder="Qual foi o resultado final?"
                  rows={2}
                  className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
                  disabled={salvando}
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 border-t border-aura-mist pt-5">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !formData.motivoPerda}
              className="flex-1 rounded-lg bg-aura-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-aura-danger/90 disabled:opacity-50"
            >
              {salvando ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Registrando...
                </div>
              ) : (
                "Confirmar Perda"
              )}
            </button>
            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
              className="flex-1 rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm font-medium text-aura-graphite hover:bg-aura-bg disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alias de compatibilidade para componentes antigos que ainda importam este nome.
export const MotivoPeridaModal = MotivoPerdaModal;
