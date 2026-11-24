"use client";

import { useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { HistoricoCompras } from "./historico-compras";
import { DuplaPanel } from "@/components/atendimento/dupla-panel";
import { FichaGestor } from "./ficha-gestor";
import { useUserProfile } from "@/lib/user-profile-context";
import type { Relacionamento, CategoriaRelacionamento, TemperaturaRelacionamento } from "@/lib/types";
import { formatarTelefone } from "@/lib/format-phone";
import { classeBotao } from "@/components/ui";

/**
 * O carimbo que o Supervisor gravava em todo contato criado por ele.
 *
 * Eram 175 cadastros com este texto no campo de anotações do vendedor. Ele
 * parou de ser escrito, mas os antigos continuam no banco: mostrá-los aqui
 * encheria a ficha de um aviso que não diz nada e ensinaria a equipe a
 * ignorar o lugar onde a anotação de verdade mora.
 */
const CARIMBO_ANTIGO = "Criado automaticamente pelo Supervisor AURA";

function observacaoUtil(texto?: string | null): string {
  const t = (texto ?? "").trim();
  if (!t || t.startsWith(CARIMBO_ANTIGO)) return "";
  return t;
}


const CATEGORIAS: CategoriaRelacionamento[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Consultor",
  "Obra",
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
  const { updateRelacionamento, deleteRelacionamento, nomesPorOwnerId, meuId, recarregar } =
    useAppData();
  const { profile } = useUserProfile();
  const souGestor = profile.cargo === "Gestor";
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const [formData, setFormData] = useState({
    nome: relacionamento.nome,
    categoria: relacionamento.categoria,
    telefone: relacionamento.telefone || "",
    email: relacionamento.email || "",
    cidade: relacionamento.cidade || "",
    endereco: relacionamento.endereco || "",
    responsavel: relacionamento.responsavel || "",
    observacao: observacaoUtil(relacionamento.observacao),
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
        endereco: formData.endereco,
        responsavel: formData.responsavel,
        observacao: formData.observacao,
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-base font-semibold text-aura-graphite">
              {editando ? "Editar Relacionamento" : "Detalhes do Relacionamento"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-aura-graphite-soft">
              ID: {relacionamento.id.slice(0, 8)}...
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
            {/* Para o gestor: origem, quem atende, valor, sinais de que está
                esfriando e o botão para pedir atenção ao vendedor. */}
            {souGestor && <FichaGestor relacionamentoId={relacionamento.id} />}

            {/* Informações */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Nome</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.nome}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Categoria</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.categoria}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Telefone</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.telefone || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Email</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.email || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Cidade</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.cidade || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Endereço</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.endereco || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Responsável</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.responsavel || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Temperatura</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.temperatura}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Próximo Contato</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.proximoContato}
                </p>
              </div>
              <div className="rounded-lg border border-aura-mist bg-aura-sunken/50 px-3.5 py-2.5">
                <p className="aura-rotulo">Último Contato</p>
                <p className="mt-1 text-sm font-medium text-aura-graphite">
                  {relacionamento.ultimoContato || "-"}
                </p>
              </div>
            </div>

            {/*
              A observação é lida com muito mais frequência do que escrita, e
              é texto corrido — por isso fica fora da grade, em largura cheia.
              Ela só aparece quando existe: um quadro vazio em toda ficha é
              ruído que ensina a pessoa a ignorar o lugar.
            */}
            {observacaoUtil(relacionamento.observacao) ? (
              <div className="rounded-lg border border-aura-mist bg-aura-surface p-4">
                <p className="aura-rotulo">
                  Observações sobre o cadastro
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-aura-graphite">
                  {observacaoUtil(relacionamento.observacao)}
                </p>
              </div>
            ) : null}

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
                Nome *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="aura-label">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="aura-label">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            <div>
              <label className="aura-label">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>
            <div>
              <label className="aura-label">Endereço</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, bairro"
                className="aura-input"
              />
            </div>
            <div>
              <label className="aura-label">Responsável</label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Quem resolve do lado do cliente"
                className="aura-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="aura-label">
                Observações sobre o cadastro
              </label>
              {/*
                Do CADASTRO, não do negócio: como o escritório trabalha, com
                quem falar, o que já foi combinado. A coluna já existia no
                banco e nenhuma tela a usava — o campo estava lá e ninguém
                conseguia preencher.
              */}
              <textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={4}
                placeholder="Ex.: falei com o João, que é quem fecha. Prefere orçamento por e-mail. Atende de terça a sexta."
                className="aura-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="aura-label">
                  Categoria
                </label>
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaRelacionamento })}
                  className="aura-input"
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
                <label className="aura-label">
                  Temperatura
                </label>
                <select
                  value={formData.temperatura}
                  onChange={(e) => setFormData({ ...formData, temperatura: e.target.value as TemperaturaRelacionamento })}
                  className="aura-input"
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
              <label className="aura-label">
                Próximo Contato
              </label>
              <input
                type="text"
                value={formData.proximoContato}
                onChange={(e) => setFormData({ ...formData, proximoContato: e.target.value })}
                className="aura-input"
                disabled={salvando}
              />
            </div>

            {/* Botões de Edição */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={salvarEdicoes}
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

        <div className="mt-5">
          <DuplaPanel
            relacionamento={relacionamento}
            nomesPorId={nomesPorOwnerId}
            souODono={
              !meuId || !relacionamento.ownerId || relacionamento.ownerId === meuId
            }
            onAtualizado={recarregar}
          />
        </div>

        <div className="mt-5">
          <HistoricoCompras relacionamentoId={relacionamento.id} />
        </div>
      </div>
    </div>
  );
}
