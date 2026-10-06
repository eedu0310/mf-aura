"use client";

import { useState } from "react";
import { X, Search, Check, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { ehPerda, nomesDasEtapas, primeiraEtapa } from "@/lib/funil";
import type { Etapa, Probabilidade } from "@/lib/types";

const PROBABILIDADES: Probabilidade[] = ["Baixa", "Média", "Alta"];

function formatarValor(valor: string) {
  const centavos = Number(valor.replace(/\D/g, ""));
  if (!centavos) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

export function NewOpportunityModal({ onClose }: { onClose: () => void }) {
  const { addOportunidade, relacionamentos, addRelacionamento, funil } = useAppData();
  const [busca, setBusca] = useState("");
  const [relacionamentoId, setRelacionamentoId] = useState<string | null>(null);
  const [relacionamentoNome, setRelacionamentoNome] = useState<string | null>(null);
  const [produto, setProduto] = useState("");
  const [valor, setValor] = useState("");
  // O valor inicial vem do funil DA LOJA, não escrito à mão. A lista do
  // <select> já vinha do funil, mas quem não mexia no campo salvava
  // "Prospecção" — numa loja que renomeasse a primeira etapa, o negócio
  // nascia numa coluna inexistente e não aparecia no quadro.
  const [etapa, setEtapa] = useState<Etapa>(() => primeiraEtapa(funil));
  const [probabilidade, setProbabilidade] = useState<Probabilidade>("Média");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const resultados =
    busca.trim().length > 0 && !relacionamentoId
      ? relacionamentos.filter((r) => r.nome.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 6)
      : [];

  function selecionar(id: string, nome: string) {
    setRelacionamentoId(id);
    setRelacionamentoNome(nome);
    setBusca(nome);
  }

  function limparSelecao() {
    setRelacionamentoId(null);
    setRelacionamentoNome(null);
    setBusca("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valorNumerico = Number(valor.replace(/\D/g, "")) / 100;
    
    if (!valorNumerico || !busca.trim()) {
      setMensagem({ tipo: "erro", texto: "Preencha todos os campos obrigatórios" });
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      let finalRelacionamentoId = relacionamentoId;
      let finalRelacionamentoNome = relacionamentoNome;

      // Se o relacionamento não foi selecionado, criar automaticamente
      if (!relacionamentoId) {

        const novoRelacionamento = await addRelacionamento({
          vendedorId: "", // Será preenchido pelo contexto com user.id
          nome: busca.trim(),
          categoria: "Cliente Final",
          temperatura: "ativo",
          proximoContato: new Date().toISOString().slice(0, 10),
        });


        if (novoRelacionamento) {
          finalRelacionamentoId = novoRelacionamento.id;
          finalRelacionamentoNome = novoRelacionamento.nome;
          setMensagem({
            tipo: "sucesso",
            texto: `✅ Cliente '${novoRelacionamento.nome}' adicionado aos Relacionamentos!`,
          });
        } else {
          setMensagem({ tipo: "erro", texto: "❌ Erro ao criar relacionamento" });
          setSalvando(false);
          return;
        }
      }


      // Criar oportunidade
      const novaOportunidade = await addOportunidade({
        cliente: finalRelacionamentoNome || busca.trim(),
        relacionamentoId: finalRelacionamentoId || "",
        produto: produto.trim() || "Não especificado",
        valor: valorNumerico,
        etapa,
        probabilidade,
      });


      if (novaOportunidade) {
        setMensagem({
          tipo: "sucesso",
          texto: "✅ Oportunidade criada com sucesso!",
        });

        // Fechar modal após 1.5 segundos
        setTimeout(() => {
          setSalvando(false);
          onClose();
        }, 1500);
      } else {
        setMensagem({ tipo: "erro", texto: "❌ Erro ao salvar oportunidade" });
        setSalvando(false);
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar:", erro);
      setMensagem({ 
        tipo: "erro", 
        texto: `❌ Erro: ${erro instanceof Error ? erro.message : "Desconhecido"}` 
      });
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-aura-graphite">
            Nova oportunidade
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            aria-label="Fechar"
            className="text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensagem de feedback */}
        {mensagem && (
          <div
            className={`mb-4 flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm ${
              mensagem.tipo === "sucesso"
                ? "bg-aura-success/10 text-aura-success"
                : "bg-aura-danger/10 text-aura-danger"
            }`}
          >
            <AlertCircle size={16} />
            <p>{mensagem.texto}</p>
          </div>
        )}

        <form onSubmit={salvar} className="flex flex-col gap-4">
          {/* Campo: Cliente / Parceiro */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Cliente / Parceiro *
            </label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aura-graphite-soft" />
              <input
                type="text"
                autoFocus
                required
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  if (relacionamentoId) {
                    setRelacionamentoId(null);
                    setRelacionamentoNome(null);
                  }
                }}
                placeholder="Digite o nome do cliente..."
                className="w-full rounded-xl border border-aura-mist bg-white py-2.5 pl-9 pr-9 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              />
              {relacionamentoId && (
                <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-success" />
              )}
            </div>

            {/* Sugestões de clientes existentes */}
            {resultados.length > 0 && (
              <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-aura-mist bg-white shadow-sm">
                {resultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selecionar(r.id, r.nome)}
                    className="w-full border-b border-aura-mist/50 px-4 py-2.5 text-left text-sm text-aura-graphite hover:bg-aura-bg last:border-b-0"
                  >
                    {r.nome}
                  </button>
                ))}
              </div>
            )}

            {/* Aviso se não encontrou e está digitando */}
            {busca.trim().length > 0 && resultados.length === 0 && !relacionamentoId && (
              <p className="mt-2 text-xs text-aura-warning">
                ⚠️ Cliente não encontrado. Será criado automaticamente ao salvar!
              </p>
            )}
          </div>

          {/* Campo: Produto/Serviço */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Produto/Serviço</label>
            <input
              type="text"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              placeholder="Ex: Painel de vidro, Execução de obra..."
              className="w-full rounded-xl border border-aura-mist bg-white py-2.5 px-3.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          {/* Campo: Valor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Valor (R$) *</label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(formatarValor(e.target.value))}
              placeholder="R$ 0,00"
              required
              className="w-full rounded-xl border border-aura-mist bg-white py-2.5 px-3.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          {/* Campos: Etapa e Probabilidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Etapa</label>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value as Etapa)}
                className="w-full rounded-xl border border-aura-mist bg-white py-2.5 px-3.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              >
                {nomesDasEtapas(funil)
                  .filter((e) => !ehPerda(e, funil))
                  .map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Probabilidade</label>
              <select
                value={probabilidade}
                onChange={(e) => setProbabilidade(e.target.value as Probabilidade)}
                className="w-full rounded-xl border border-aura-mist bg-white py-2.5 px-3.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              >
                {PROBABILIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="flex-1 rounded-full border border-aura-mist py-2.5 text-sm font-medium text-aura-graphite hover:bg-aura-bg disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !valor.trim() || !busca.trim()}
              className="flex-1 rounded-full bg-aura-petrol-700 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Criar oportunidade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
