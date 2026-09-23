"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SearchRelationshipField } from "./search-relationship-field";
import { ChoiceChips } from "./choice-chips";
import { ResultRating } from "./result-rating";
import { ObservationField } from "./observation-field";
import { WhenPicker } from "./when-picker";
import { CamposFaltando } from "./campos-faltando";
import {
  LocationCaptureField,
  type ActivityLocation,
} from "./location-capture-field";
import { agoraIso, prazoParaIso } from "./activity-date";
import type { Relacionamento, TipoAtividade } from "@/lib/types";
import { useAppData } from "@/lib/app-data-context";
import { AuraRascunhoField, type RascunhoAtividadeAura } from "./aura-rascunho-field";

const TIPOS_PROSPECCAO = [
  "Cliente final",
  "Cliente novo",
  "Arquiteto",
  "Construtor",
  "Obra",
];
const ORIGENS = ["Marketing", "Loja", "Prospecção", "Indicação", "Site", "WhatsApp", "Outro"];

export function GenericActivityForm({
  tipoLabel,
  onConcluir,
}: {
  tipoLabel: string;
  onConcluir: () => void;
}) {
  const { addAtividade } = useAppData();
  const [quem, setQuem] = useState<Relacionamento | null>(null);
  const [subtipo, setSubtipo] = useState<string | null>(null);
  const [outroDetalhe, setOutroDetalhe] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [origem, setOrigem] = useState("");
  const [proximoPasso, setProximoPasso] = useState<string | null>(null);
  const [quando, setQuando] = useState<string | null>(null);
  const [localizacao, setLocalizacao] = useState<ActivityLocation>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const exigeRelacionamento = tipoLabel !== "Treinamento";
  const exigeSubtipo = tipoLabel === "Prospecção";
  const exigeData = proximoPasso !== "Encerrado";

  const camposFaltando = [
    exigeRelacionamento && !quem && "Com quem foi",
    exigeSubtipo && !subtipo && "Tipo de prospecção",
    tipoLabel === "Outro" && !outroDetalhe.trim() && "Explique qual foi a atividade",
    !resultado && "Como foi",
    !observacao.trim() && "Relato do atendimento (fale pelo microfone ou escreva)",
    !origem && "Origem do contato",
    !proximoPasso && "Próximo passo",
    exigeData && !quando && "Quando será o próximo contacto",
  ].filter(Boolean) as string[];

  const podeConcluir = camposFaltando.length === 0 && !salvando;

  function aplicarRascunho(rascunho: RascunhoAtividadeAura) {
    setObservacao((atual) => atual.trim() ? `${atual.trim()} ${rascunho.resumo}` : rascunho.resumo);
    if (rascunho.resultado) setResultado(rascunho.resultado);
    if (rascunho.proximoPasso) setProximoPasso(rascunho.proximoPasso);
    if (rascunho.origem) setOrigem(rascunho.origem);
    if (tipoLabel === "Prospecção" && TIPOS_PROSPECCAO.includes(rascunho.categoria)) setSubtipo(rascunho.categoria);
    if (rascunho.prazoDias > 0) {
      const data = new Date();
      data.setDate(data.getDate() + rascunho.prazoDias);
      setQuando(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`);
    }
  }

  async function concluir() {
    if (!resultado || !proximoPasso || (exigeRelacionamento && !quem)) return;

    setSalvando(true);
    setErro("");

    try {
      const ocorridaEm = agoraIso();
      const proximoContatoEm =
        proximoPasso === "Encerrado" ? undefined : prazoParaIso(quando);

      const actividade = await addAtividade({
        vendedorId: "",
        tipo: tipoLabel as TipoAtividade,
        subtipo: subtipo || undefined,
        titulo: `${tipoLabel}${resultado ? ` · ${resultado}` : ""}`,
        contexto: quem?.nome || tipoLabel,
        anotacoes: [observacao.trim(), tipoLabel === "Outro" ? `Detalhe: ${outroDetalhe.trim()}` : ""].filter(Boolean).join("\n") || undefined,
        resultado,
        proximoPasso,
        quando: ocorridaEm,
        ocorridaEm,
        proximoContatoEm,
        relacionamentoId: quem?.id,
        clienteNome: quem?.nome,
        clienteTelefone: quem?.telefone,
        clienteEmail: quem?.email,
        clienteCategoria: quem?.categoria,
        origem,
        ...localizacao,
        metadata: {
          prazo_selecionado: quando,
          outro_detalhe: tipoLabel === "Outro" ? outroDetalhe.trim() : null,
        },
      });

      if (!actividade) {
        setErro("Não foi possível guardar a actividade.");
        return;
      }

      onConcluir();
    } catch (error) {
      console.error("Erro ao concluir actividade:", error);
      setErro("Ocorreu um erro ao guardar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AuraRascunhoField onAplicar={aplicarRascunho} />
      {exigeRelacionamento && (
        <SearchRelationshipField
          label="Com quem foi?"
          value={quem}
          onChange={setQuem}
        />
      )}

      {exigeSubtipo && (
        <ChoiceChips
          label="Tipo de prospecção"
          options={TIPOS_PROSPECCAO}
          value={subtipo}
          onChange={setSubtipo}
        />
      )}

      {tipoLabel === "Outro" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
            O que foi feito? *
          </label>
          <input
            type="text"
            value={outroDetalhe}
            onChange={(event) => setOutroDetalhe(event.target.value)}
            placeholder="Descreva a atividade"
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
          />
        </div>
      )}

      <ChoiceChips label="Origem do contato" options={ORIGENS} value={origem} onChange={setOrigem} />

      <ResultRating value={resultado} onChange={setResultado} />
      <ObservationField
        value={observacao}
        onChange={setObservacao}
        label="Relato do atendimento"
        ajuda="Obrigatório. Fale pelo microfone ou escreva o que aconteceu neste contato."
      />

      <ChoiceChips
        label="Próximo passo"
        options={[
          "Ligar",
          "Retornar",
          "Enviar orçamento",
          "Nova visita",
          "Agendar reunião",
          "Aguardar retorno",
          "Encerrado",
        ]}
        value={proximoPasso}
        onChange={setProximoPasso}
      />

      {proximoPasso !== "Encerrado" && (
        <WhenPicker value={quando} onChange={setQuando} />
      )}

      <LocationCaptureField value={localizacao} onChange={setLocalizacao} />

      <CamposFaltando campos={camposFaltando} />

      {erro && <p className="text-sm text-aura-danger">{erro}</p>}

      <button
        type="button"
        disabled={!podeConcluir}
        onClick={() => void concluir()}
        className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-aura-petrol-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {salvando ? (
          <>
            <Loader2 size={16} className="animate-spin" />A guardar...
          </>
        ) : (
          "Concluir actividade"
        )}
      </button>
    </div>
  );
}
