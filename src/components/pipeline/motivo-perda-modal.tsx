"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { diaEmSaoPaulo } from "@/lib/fuso";
import type { Oportunidade } from "@/lib/types";
import { classeBotao } from "@/components/ui";

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
      alert("Selecione o motivo da perda.");
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
          await updateOportunidade(props.oportunidade.id, {
            motivoPerda: formData.motivoPerda as any,
            descricaoPerda: descricao,
            dataPerda: diaEmSaoPaulo(),
          });
        }
        if (props.onConfirm) {
          await props.onConfirm(formData);
        }
      }

      fechar();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert(error instanceof Error ? error.message : "Não consegui registrar o motivo da perda.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-xl p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-base font-semibold text-aura-graphite">
              Registrar Motivo da Perda
            </p>
            <p className="mt-0.5 text-sm text-aura-graphite-soft">
              {clienteNome}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className={classeBotao("fantasma", "sm", "h-8 w-8 px-0")}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Motivo da Perda - OBRIGATÓRIO */}
          <div>
            <label className="aura-label mb-2.5">
              Motivo da Perda *
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOTIVOS_PERDA.map((motivo) => (
                <label
                  key={motivo}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-aura-mist p-3 transition hover:bg-aura-sunken has-[:checked]:border-aura-petrol-500 has-[:checked]:bg-aura-petrol-500/5"
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
                    className="h-4 w-4 accent-aura-petrol-600"
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
            <p className="aura-rotulo mb-4">
              Informações Adicionais
            </p>

            <div className="space-y-4">
              {/* Objeção */}
              <div>
                <label className="aura-label">
                  Objeção
                </label>
                <textarea
                  value={formData.objecao}
                  onChange={(e) =>
                    setFormData({ ...formData, objecao: e.target.value })
                  }
                  placeholder="Qual foi a objeção principal?"
                  rows={2}
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Concorrente */}
              <div>
                <label className="aura-label">
                  Concorrente (se informado)
                </label>
                <input
                  type="text"
                  value={formData.concorrente}
                  onChange={(e) =>
                    setFormData({ ...formData, concorrente: e.target.value })
                  }
                  placeholder="Qual concorrente venceu?"
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Condição Solicitada */}
              <div>
                <label className="aura-label">
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
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Desconto Solicitado */}
              <div>
                <label className="aura-label">
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
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Desconto Concedido */}
              <div>
                <label className="aura-label">
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
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Contrapartida */}
              <div>
                <label className="aura-label">
                  Contrapartida
                </label>
                <textarea
                  value={formData.contrapartida}
                  onChange={(e) =>
                    setFormData({ ...formData, contrapartida: e.target.value })
                  }
                  placeholder="Qual foi oferecido em troca?"
                  rows={2}
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Responsável pela Aprovação */}
              <div>
                <label className="aura-label">
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
                  className="aura-input"
                  disabled={salvando}
                />
              </div>

              {/* Resultado */}
              <div>
                <label className="aura-label">
                  Resultado
                </label>
                <textarea
                  value={formData.resultado}
                  onChange={(e) =>
                    setFormData({ ...formData, resultado: e.target.value })
                  }
                  placeholder="Qual foi o resultado final?"
                  rows={2}
                  className="aura-input"
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
              className={classeBotao("perigo", "md", "flex-1")}
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
              className={classeBotao("secundario", "md", "flex-1")}
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
