"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Download, Upload, Loader2, FileText } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { nomesDasEtapas } from "@/lib/funil";
import { entraNaPerda } from "@/lib/perda-oportunidade";
import { MotivoPerdaModal } from "./motivo-perda-modal";
import {
  listarOrcamentos,
  anexarOrcamento,
  linkDoOrcamento,
  removerOrcamento,
  type OrcamentoAnexo,
} from "@/lib/supabase/orcamentos";
import { useUserProfile } from "@/lib/user-profile-context";
import type { Oportunidade, Etapa, Probabilidade } from "@/lib/types";
import { classeBotao } from "@/components/ui";

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
  const { updateOportunidade, deleteOportunidade, funil } = useAppData();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [uploadandoOrcamento, setUploadandoOrcamento] = useState(false);
  const [erroOrcamento, setErroOrcamento] = useState<string | null>(null);
  /*
   * Lista, não um só. Havia uma coluna e o upload usava upsert: o segundo
   * orçamento sobrescrevia o primeiro. A casa faz vários até fechar.
   */
  const [orcamentos, setOrcamentos] = useState<OrcamentoAnexo[]>([]);
  const [carregandoOrcamentos, setCarregandoOrcamentos] = useState(true);
  const { profile } = useUserProfile();

  const [formData, setFormData] = useState({
    cliente: oportunidade.cliente,
    produto: oportunidade.produto || "",
    valor: oportunidade.valor,
    etapa: oportunidade.etapa,
    probabilidade: oportunidade.probabilidade,
  });

  /*
   * Trocar a etapa para a de perda pelo select também pede o motivo — antes
   * só o arrasto abria o modal, e a edição do card mandava para Perdidos sem
   * motivo nem data. O modal devolve o motivo e o save segue com ele.
   */
  const [pedindoMotivo, setPedindoMotivo] = useState(false);

  async function salvarEdicoes(perda?: { motivo: string; descricao: string }) {
    if (!perda && entraNaPerda(oportunidade.etapa, formData.etapa, funil)) {
      setPedindoMotivo(true);
      return;
    }
    setSalvando(true);
    try {
      await updateOportunidade(oportunidade.id, {
        cliente: formData.cliente,
        produto: formData.produto || undefined,
        valor: formData.valor,
        etapa: formData.etapa as Etapa,
        probabilidade: formData.probabilidade as Probabilidade,
        ...(perda
          ? { motivoPerda: perda.motivo as Oportunidade["motivoPerda"], descricaoPerda: perda.descricao }
          : {}),
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

  useEffect(() => {
    let vivo = true;
    setCarregandoOrcamentos(true);
    listarOrcamentos(oportunidade.id)
      .then((lista) => vivo && setOrcamentos(lista))
      .catch((e) => vivo && setErroOrcamento(e instanceof Error ? e.message : "Não consegui listar os orçamentos."))
      .finally(() => vivo && setCarregandoOrcamentos(false));
    return () => {
      vivo = false;
    };
  }, [oportunidade.id]);

  /** Envia o orçamento para o armazenamento da loja e guarda o caminho na oportunidade. */
  async function handleUploadOrcamento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroOrcamento(null);
    setUploadandoOrcamento(true);
    try {
      const novo = await anexarOrcamento({
        oportunidadeId: oportunidade.id,
        relacionamentoId: oportunidade.relacionamentoId ?? null,
        empresa: oportunidade.empresa || profile.empresa,
        arquivo: file,
      });
      setOrcamentos((atual) => [novo, ...atual]);
    } catch (erro) {
      console.error("Erro ao anexar orçamento:", erro);
      setErroOrcamento(erro instanceof Error ? erro.message : "Não consegui anexar o orçamento.");
    } finally {
      setUploadandoOrcamento(false);
      e.target.value = "";
    }
  }

  async function abrirOrcamento(anexo: OrcamentoAnexo) {
    setErroOrcamento(null);
    try {
      window.open(await linkDoOrcamento(anexo.path), "_blank", "noopener");
    } catch (erro) {
      setErroOrcamento(erro instanceof Error ? erro.message : "Não consegui abrir o arquivo.");
    }
  }

  async function excluirOrcamento(anexo: OrcamentoAnexo) {
    if (!window.confirm(`Remover o orçamento ${anexo.versao} (${anexo.nome})?`)) return;
    setErroOrcamento(null);
    try {
      await removerOrcamento(anexo);
      setOrcamentos((atual) => atual.filter((o) => o.id !== anexo.id));
    } catch (erro) {
      setErroOrcamento(erro instanceof Error ? erro.message : "Não consegui remover.");
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-base font-semibold text-aura-graphite">
              {editando ? "Editar Oportunidade" : "Detalhes da Oportunidade"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-aura-graphite-soft">
              ID: {oportunidade.id.slice(0, 8)}...
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando || deletando}
            className={classeBotao("fantasma", "sm", "h-8 w-8 px-0")}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {!editando ? (
          // MODO VISUALIZAÇÃO
          <div className="space-y-6">
            {/* Informações */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Cliente</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {oportunidade.cliente}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Produto</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {oportunidade.produto || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Valor</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {formatarMoeda(oportunidade.valor)}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Etapa</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {oportunidade.etapa}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Probabilidade</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {oportunidade.probabilidade}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Empresa</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {oportunidade.empresa || "-"}
                </p>
              </div>
            </div>

            {/* Orçamentos anexados — vários por negócio */}
            <div className="rounded-lg border border-aura-mist p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-aura-petrol-600" />
                  <p className="text-sm font-semibold text-aura-graphite">
                    Orçamentos{orcamentos.length > 0 ? ` (${orcamentos.length})` : ""}
                  </p>
                </div>
                <label className={classeBotao("secundario", "sm", "cursor-pointer")}>
                  {uploadandoOrcamento ? "Enviando..." : orcamentos.length ? "Anexar outro" : "Anexar orçamento"}
                  <input
                    type="file"
                    onChange={handleUploadOrcamento}
                    disabled={uploadandoOrcamento}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                </label>
              </div>

              {carregandoOrcamentos ? (
                <p className="flex items-center gap-2 text-xs text-aura-graphite-soft">
                  <Loader2 size={14} className="animate-spin" /> Carregando...
                </p>
              ) : orcamentos.length === 0 ? (
                <p className="text-xs text-aura-graphite-soft">
                  Nenhum orçamento ainda. PDF, Word, Excel ou foto — até 10 MB cada.
                </p>
              ) : (
                <ul className="divide-y divide-aura-mist">
                  {orcamentos.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="aura-selo aura-selo-marca shrink-0 tabular-nums">
                          {o.versao}º
                        </span>
                        <FileText size={14} className="shrink-0 text-aura-graphite-soft" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-aura-graphite">{o.nome}</p>
                          <p className="text-[11px] text-aura-graphite-soft">
                            {new Date(o.criadoEm).toLocaleDateString("pt-BR")}
                            {o.bytes ? ` · ${(o.bytes / 1024 / 1024).toFixed(1)} MB` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void abrirOrcamento(o)}
                          className={classeBotao("secundario", "sm")}
                        >
                          <Download size={12} /> Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluirOrcamento(o)}
                          className={classeBotao("fantasma", "sm", "w-[1.875rem] px-0 hover:text-aura-danger")}
                          aria-label="Remover"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
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
                className={classeBotao("primario", "md", "flex-1")}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={deletando}
                className={classeBotao("perigo-suave")}
                aria-label="Excluir"
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
              <label className="aura-label">
                Cliente *
              </label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="aura-label">
                Produto
              </label>
              <input
                type="text"
                value={formData.produto}
                onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="aura-label">
                Valor (R$) *
              </label>
              <input
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="aura-label">
                  Etapa
                </label>
                <select
                  value={formData.etapa}
                  onChange={(e) => setFormData({ ...formData, etapa: e.target.value as Etapa })}
                  className="aura-input"
                  disabled={salvando}
                >
                  {nomesDasEtapas(funil).map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="aura-label">
                  Probabilidade
                </label>
                <select
                  value={formData.probabilidade}
                  onChange={(e) => setFormData({ ...formData, probabilidade: e.target.value as Probabilidade })}
                  className="aura-input"
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
                onClick={() => void salvarEdicoes()}
                disabled={salvando}
                className={classeBotao("primario", "md", "flex-1")}
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
                className={classeBotao("secundario", "md", "flex-1")}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {pedindoMotivo && (
        <MotivoPerdaModal
          clienteNome={formData.cliente}
          onCancelar={() => setPedindoMotivo(false)}
          onConfirmar={async (motivo, descricao) => {
            setPedindoMotivo(false);
            await salvarEdicoes({ motivo, descricao });
          }}
        />
      )}
    </div>
  );
}