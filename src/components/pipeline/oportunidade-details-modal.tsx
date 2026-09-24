"use client";

import { useState } from "react";
import { X, Trash2, Download, Upload, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";
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
  const [erroOrcamento, setErroOrcamento] = useState<string | null>(null);
  const [orcamento, setOrcamento] = useState<{ path: string; nome: string } | null>(
    oportunidade.orcamentoPath
      ? { path: oportunidade.orcamentoPath, nome: oportunidade.orcamentoNome ?? "orçamento" }
      : null,
  );
  const { profile } = useUserProfile();

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
      await updateOportunidade(oportunidade.id, {
        cliente: formData.cliente,
        produto: formData.produto || undefined,
        valor: formData.valor,
        etapa: formData.etapa as Etapa,
        probabilidade: formData.probabilidade as Probabilidade,
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
    if (!confirm("Tem certeza que deseja excluir esta oportunidade?")) return;
    setDeletando(true);
    try {
      await deleteOportunidade(oportunidade.id);
      onDelete(oportunidade.id);
      onClose();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      window.alert(error instanceof Error ? error.message : "Não consegui excluir. Tente de novo.");
    } finally {
      setDeletando(false);
    }
  }

  const TAMANHO_MAXIMO_MB = 10;

  /** Envia o orçamento para o armazenamento da loja e guarda o caminho na oportunidade. */
  async function handleUploadOrcamento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroOrcamento(null);

    if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      setErroOrcamento(`O arquivo passa de ${TAMANHO_MAXIMO_MB} MB.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErroOrcamento("Armazenamento indisponível.");
      return;
    }

    setUploadandoOrcamento(true);
    try {
      const loja = oportunidade.empresa || profile.empresa;
      const nomeSeguro = file.name.replace(/[^\w.\-]+/g, "_");
      const caminho = `${loja}/oportunidades/${oportunidade.id}/${nomeSeguro}`;

      const { error: erroUpload } = await supabase.storage
        .from("orcamentos")
        .upload(caminho, file, { upsert: true });
      if (erroUpload) throw erroUpload;

      const { error: erroBanco } = await supabase
        .from("oportunidades")
        .update({ orcamento_path: caminho, orcamento_nome: file.name })
        .eq("id", oportunidade.id);
      if (erroBanco) throw erroBanco;

      setOrcamento({ path: caminho, nome: file.name });
    } catch (erro: any) {
      console.error("Erro ao anexar orçamento:", erro);
      setErroOrcamento(erro?.message ?? "Não consegui anexar o orçamento.");
    } finally {
      setUploadandoOrcamento(false);
      e.target.value = "";
    }
  }

  /** Abre o orçamento anexado por um link temporário e assinado. */
  async function baixarOrcamento() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !orcamento) return;
    const { data, error } = await supabase.storage
      .from("orcamentos")
      .createSignedUrl(orcamento.path, 60);
    if (error || !data?.signedUrl) {
      setErroOrcamento("Não consegui abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
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

            {/* Orçamento anexado */}
            <div className="rounded-xl border border-aura-mist p-4">
              <div className="mb-3 flex items-center gap-2">
                <Upload size={16} className="text-aura-petrol-600" />
                <p className="text-sm font-medium text-aura-graphite">Orçamento</p>
              </div>

              {orcamento ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-aura-mist bg-aura-bg/50 px-3 py-3">
                  <p className="min-w-0 truncate text-sm text-aura-graphite">{orcamento.nome}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void baixarOrcamento()}
                      className="flex items-center gap-1.5 rounded-lg border border-aura-mist px-3 py-1.5 text-xs font-medium text-aura-graphite hover:bg-white"
                    >
                      <Download size={13} /> Abrir
                    </button>
                    <label className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-aura-petrol-700 hover:underline">
                      Trocar
                      <input
                        type="file"
                        onChange={handleUploadOrcamento}
                        disabled={uploadandoOrcamento}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-aura-mist bg-aura-bg/50 px-4 py-8 transition hover:border-aura-petrol-300">
                  <input
                    type="file"
                    onChange={handleUploadOrcamento}
                    disabled={uploadandoOrcamento}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                  <div className="text-center">
                    {uploadandoOrcamento ? (
                      <Loader2 size={24} className="mx-auto animate-spin text-aura-petrol-600" />
                    ) : (
                      <>
                        <p className="text-sm font-medium text-aura-graphite">
                          Clique para anexar o orçamento
                        </p>
                        <p className="mt-1 text-xs text-aura-graphite-soft">
                          PDF, Word, Excel ou foto — até 10 MB
                        </p>
                      </>
                    )}
                  </div>
                </label>
              )}

              {erroOrcamento && (
                <p className="mt-2 text-xs text-aura-danger">{erroOrcamento}</p>
              )}
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