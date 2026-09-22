"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Paperclip, X } from "lucide-react";
import { SearchRelationshipField } from "./search-relationship-field";
import { ChoiceChips } from "./choice-chips";
import { CamposFaltando } from "./campos-faltando";
import {
  LocationCaptureField,
  type ActivityLocation,
} from "./location-capture-field";
import { agoraIso, moedaParaNumero } from "./activity-date";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import type { Relacionamento } from "@/lib/types";

const TAMANHO_MAXIMO_MB = 5;
const FORMAS_PAGAMENTO = [
  "À vista",
  "Pix",
  "Dinheiro",
  "Cartão",
  "Financiamento",
  "Boleto",
];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

export function VendaForm({ onConcluir }: { onConcluir: () => void }) {
  const { addVenda, addAtividade } = useAppData();
  const { profile } = useUserProfile();
  const [quemComprou, setQuemComprou] = useState<Relacionamento | null>(null);
  const [valorOriginal, setValorOriginal] = useState("");
  const [valorFechado, setValorFechado] = useState("");
  const [produto, setProduto] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("1");
  const [entradaValor, setEntradaValor] = useState("0");
  const [taxaFinanceira, setTaxaFinanceira] = useState("0");
  const [origem, setOrigem] = useState<string | null>(null);
  const [foiIndicada, setFoiIndicada] = useState<string | null>(null);
  const [indicadoPor, setIndicadoPor] = useState<Relacionamento | null>(null);
  const [possibilidadeFutura, setPossibilidadeFutura] = useState("");
  const [dataPossibilidadeFutura, setDataPossibilidadeFutura] = useState("");
  const [orcamento, setOrcamento] = useState<File | null>(null);
  const [localizacao, setLocalizacao] = useState<ActivityLocation>({});
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const original = moedaParaNumero(valorOriginal);
  const fechado = moedaParaNumero(valorFechado);
  const entrada = moedaParaNumero(entradaValor);
  const taxa = Number(taxaFinanceira.replace(",", ".")) || 0;
  const parcelas = Math.max(Number(quantidadeParcelas) || 1, 1);
  const descontoValor = Math.max(original - fechado, 0);
  const descontoPercentual =
    original > 0 ? (descontoValor / original) * 100 : 0;
  const valorParcela = Math.max(fechado - entrada, 0) / parcelas;
  const pagamentoAVista = ["À vista", "Pix", "Dinheiro"].includes(
    formaPagamento || "",
  );

  const camposFaltando = useMemo(
    () =>
      [
        !quemComprou && "Quem comprou",
        !produto.trim() && "Produto",
        original <= 0 && "Valor original",
        fechado <= 0 && "Valor fechado",
        fechado > original && "O valor fechado não pode superar o original",
        !formaPagamento && "Forma de pagamento",
        !origem && "Origem da venda",
        !foiIndicada && "Informe se houve indicação",
        foiIndicada === "Sim" && !indicadoPor && "Quem indicou",
        !possibilidadeFutura.trim() && "Possibilidade futura de venda",
        !dataPossibilidadeFutura && "Agendamento futuro da possibilidade",
        !pagamentoAVista && parcelas < 1 && "Quantidade de parcelas",
        entrada > fechado && "A entrada não pode superar o valor fechado",
      ].filter(Boolean) as string[],
    [
      entrada,
      fechado,
      foiIndicada,
      formaPagamento,
      indicadoPor,
      origem,
      original,
      pagamentoAVista,
      parcelas,
      produto,
      quemComprou,
      dataPossibilidadeFutura,
      possibilidadeFutura,
    ],
  );

  const podeConcluir = camposFaltando.length === 0 && !enviando;

  function seleccionarArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    setErroArquivo(null);
    if (!arquivo) return;

    if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      setErroArquivo(`Arquivo muito grande (máx. ${TAMANHO_MAXIMO_MB} MB).`);
      event.target.value = "";
      return;
    }

    setOrcamento(arquivo);
  }

  async function concluir() {
    if (!quemComprou || !formaPagamento || !origem || !podeConcluir) return;

    setEnviando(true);
    setErro("");

    try {
      const hoje = new Date().toISOString().split("T")[0];
      const ocorridaEm = agoraIso();
      const parcelasFinais = pagamentoAVista ? 1 : parcelas;
      const entradaFinal = pagamentoAVista ? fechado : entrada;
      const valorParcelaFinal = pagamentoAVista ? fechado : valorParcela;

      const venda = await addVenda(
        {
          vendedorId: "",
          cliente: quemComprou.nome,
          produto: produto.trim(),
          valor: fechado,
          valorOriginal: original,
          valorFechado: fechado,
          descontoValor,
          descontoPercentual,
          formaPagamento,
          tipo: formaPagamento,
          quantidadeParcelas: parcelasFinais,
          valorParcela: valorParcelaFinal,
          entradaValor: entradaFinal,
          taxaFinanceira: pagamentoAVista ? 0 : taxa,
          comissaoBase: fechado,
          origem,
          data: hoje,
          empresa: profile.empresa,
          loja: profile.empresa,
          relacionamentoId: quemComprou.id,
          indicadorId: foiIndicada === "Sim" ? indicadoPor?.id : undefined,
          status: "fechada",
          descricao: `Venda ${formaPagamento}${
            parcelasFinais > 1 ? ` em ${parcelasFinais} parcelas` : ""
          }`,
        },
        orcamento || undefined,
      );

      if (!venda) {
        setErro("Não foi possível guardar a venda.");
        return;
      }

      const proximoContatoEm = new Date(`${dataPossibilidadeFutura}T09:00:00`).toISOString();

      const actividade = await addAtividade({
        vendedorId: "",
        empresa: profile.empresa,
        tipo: "Venda",
        titulo: `Venda fechada · ${profile.empresa}`,
        contexto: quemComprou.nome,
        anotacoes: `${produto.trim()} — ${formatarMoeda(
          fechado,
        )} — ${formaPagamento}${
          parcelasFinais > 1 ? ` — ${parcelasFinais}x` : ""
        }${orcamento ? " — orçamento anexado" : ""} — possibilidade futura: ${possibilidadeFutura.trim()}`,
        resultado: "Venda fechada",
        objetivo: produto.trim(),
        proximoPasso: "Pós-venda",
        quando: ocorridaEm,
        ocorridaEm,
        proximoContatoEm,
        relacionamentoId: quemComprou.id,
        clienteNome: quemComprou.nome,
        clienteTelefone: quemComprou.telefone,
        clienteEmail: quemComprou.email,
        clienteCategoria: quemComprou.categoria,
        ...localizacao,
        metadata: {
          venda_id: venda.id,
          valor_original: original,
          valor_fechado: fechado,
          desconto_valor: descontoValor,
          desconto_percentual: descontoPercentual,
          forma_pagamento: formaPagamento,
          quantidade_parcelas: parcelasFinais,
          valor_parcela: valorParcelaFinal,
          entrada_valor: entradaFinal,
          taxa_financeira: pagamentoAVista ? 0 : taxa,
            indicado_por: indicadoPor?.nome || null,
            possibilidade_futura: possibilidadeFutura.trim(),
            data_possibilidade_futura: dataPossibilidadeFutura,
        },
      });

      if (!actividade) {
        setErro(
          "A venda foi guardada, mas não foi possível criar a actividade.",
        );
        return;
      }

      onConcluir();
    } catch (error) {
      console.error("Erro ao guardar venda:", error);
      setErro("Ocorreu um erro ao guardar a venda.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SearchRelationshipField
        label="Quem comprou?"
        value={quemComprou}
        onChange={setQuemComprou}
      />

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-aura-mist bg-aura-bg p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Possibilidade futura de venda *</label>
          <input value={possibilidadeFutura} onChange={(e) => setPossibilidadeFutura(e.target.value)} placeholder="Ex.: churrasqueira, forno de pizza, solar..." className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Agendar retorno futuro *</label>
          <input type="date" value={dataPossibilidadeFutura} onChange={(e) => setDataPossibilidadeFutura(e.target.value)} className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-aura-graphite">
            Valor original
          </p>
          <input
            type="text"
            inputMode="decimal"
            value={valorOriginal}
            onChange={(event) => setValorOriginal(event.target.value)}
            placeholder="R$ 0,00"
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm outline-none focus:border-aura-petrol-500"
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-aura-graphite">
            Valor fechado
          </p>
          <input
            type="text"
            inputMode="decimal"
            value={valorFechado}
            onChange={(event) => setValorFechado(event.target.value)}
            placeholder="R$ 0,00"
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm outline-none focus:border-aura-petrol-500"
          />
        </div>
      </div>

      {original > 0 && fechado > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-aura-mist bg-aura-bg p-4 text-sm">
          <div>
            <p className="text-xs text-aura-graphite-soft">Desconto</p>
            <p className="font-semibold text-aura-graphite">
              {formatarMoeda(descontoValor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-aura-graphite-soft">Percentual</p>
            <p className="font-semibold text-aura-graphite">
              {descontoPercentual.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-aura-mist bg-aura-bg px-4 py-3">
        <span className="text-sm text-aura-graphite-soft">Empresa</span>
        <span className="text-sm font-medium text-aura-graphite">
          {profile.empresa}
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-aura-graphite">Produto</p>
        <input
          type="text"
          value={produto}
          onChange={(event) => setProduto(event.target.value)}
          placeholder="Ex.: Lareira a pellet MF Forma 12 kW"
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm outline-none focus:border-aura-petrol-500"
        />
      </div>

      <ChoiceChips
        label="Forma de pagamento"
        options={FORMAS_PAGAMENTO}
        value={formaPagamento}
        onChange={(valor) => {
          setFormaPagamento(valor);
          if (["À vista", "Pix", "Dinheiro"].includes(valor)) {
            setQuantidadeParcelas("1");
          }
        }}
      />

      {!pagamentoAVista && formaPagamento && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-aura-mist bg-aura-bg p-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs text-aura-graphite-soft">
              Parcelas
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={quantidadeParcelas}
              onChange={(event) => setQuantidadeParcelas(event.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-aura-graphite-soft">
              Entrada
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={entradaValor}
              onChange={(event) => setEntradaValor(event.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-aura-graphite-soft">
              Taxa financeira %
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={taxaFinanceira}
              onChange={(event) => setTaxaFinanceira(event.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <p className="sm:col-span-3 text-xs text-aura-graphite-soft">
            Parcela estimada: <strong>{formatarMoeda(valorParcela)}</strong>
          </p>
        </div>
      )}

      <ChoiceChips
        label="Origem"
        options={[
          "Google",
          "Instagram",
          "Meta",
          "Loja",
          "Telefone",
          "Cliente antigo",
          "Arquiteto",
          "Construtora",
          "Feira",
          "Outro",
        ]}
        value={origem}
        onChange={setOrigem}
      />

      <ChoiceChips
        label="Esta venda foi indicada por alguém?"
        options={["Sim", "Não"]}
        value={foiIndicada}
        onChange={setFoiIndicada}
      />

      {foiIndicada === "Sim" && (
        <div className="rounded-xl border border-aura-mist bg-aura-bg p-4">
          <SearchRelationshipField
            label="Quem indicou?"
            value={indicadoPor}
            onChange={setIndicadoPor}
          />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-aura-graphite">
          Orçamento (opcional) — até {TAMANHO_MAXIMO_MB} MB
        </p>
        {orcamento ? (
          <div className="flex items-center justify-between rounded-xl border border-aura-mist bg-aura-bg px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-aura-graphite">
              <Paperclip size={14} className="shrink-0" />
              <span className="truncate">{orcamento.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setOrcamento(null)}
              aria-label="Remover arquivo"
              className="text-aura-graphite-soft hover:text-aura-danger"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-aura-mist py-3 text-sm font-medium text-aura-graphite hover:bg-aura-bg">
            <Paperclip size={15} />
            Anexar PDF, imagem ou planilha
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
              onChange={seleccionarArquivo}
              className="hidden"
            />
          </label>
        )}
        {erroArquivo && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-aura-danger">
            <AlertCircle size={12} />
            {erroArquivo}
          </p>
        )}
      </div>

      <LocationCaptureField value={localizacao} onChange={setLocalizacao} />

      <CamposFaltando campos={camposFaltando} />
      {erro && <p className="text-sm text-aura-danger">{erro}</p>}

      <button
        type="button"
        disabled={!podeConcluir}
        onClick={() => void concluir()}
        className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-aura-petrol-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? (
          <>
            <Loader2 size={14} className="animate-spin" />A guardar...
          </>
        ) : (
          "Concluir venda"
        )}
      </button>
    </div>
  );
}
