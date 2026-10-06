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
import { agoraIso, moedaParaNumero, prazoParaIso } from "./activity-date";
import type { Probabilidade, Relacionamento } from "@/lib/types";
import { useAppData } from "@/lib/app-data-context";
import { primeiraEtapa } from "@/lib/funil";

export function VisitaForm({ onConcluir }: { onConcluir: () => void }) {
  const { addAtividade, addOportunidade, funil } = useAppData();
  const [quem, setQuem] = useState<Relacionamento | null>(null);
  const [tipoVisita, setTipoVisita] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState<string | null>(null);
  const [outroDetalhe, setOutroDetalhe] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [origem, setOrigem] = useState("");
  const [proximoPasso, setProximoPasso] = useState<string | null>(null);
  const [quando, setQuando] = useState<string | null>(null);
  const [houveOportunidade, setHouveOportunidade] = useState<string | null>(
    null,
  );
  const [valorEstimado, setValorEstimado] = useState("");
  const [probabilidade, setProbabilidade] = useState<Probabilidade | null>(
    null,
  );
  const [localizacao, setLocalizacao] = useState<ActivityLocation>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const exigeData = proximoPasso !== "Encerrado";
  const valorNumerico = moedaParaNumero(valorEstimado);

  const camposFaltando = [
    !quem && "Quem você visitou",
    !tipoVisita && "Tipo de visita",
    !objetivo && "Objetivo da visita",
    objetivo === "Outro" && !outroDetalhe.trim() && "Explique o outro objetivo",
    !resultado && "Como foi",
    !observacao.trim() && "Relato da visita (fale pelo microfone ou escreva)",
    !origem && "Origem do contato",
    !proximoPasso && "Próximo passo",
    exigeData && !quando && "Quando será o próximo contato",
    !houveOportunidade && "Informe se houve oportunidade",
    houveOportunidade === "Sim" && valorNumerico <= 0 && "Valor estimado",
    houveOportunidade === "Sim" && !probabilidade && "Probabilidade",
  ].filter(Boolean) as string[];

  const podeConcluir = camposFaltando.length === 0 && !salvando;

  async function concluir() {
    if (!quem || !tipoVisita || !objetivo || !resultado || !proximoPasso) {
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const ocorridaEm = agoraIso();
      const proximoContatoEm =
        proximoPasso === "Encerrado" ? undefined : prazoParaIso(quando);

      const actividade = await addAtividade({
        vendedorId: "",
        tipo: "Visita",
        subtipo: tipoVisita,
          titulo: `${tipoVisita} · ${resultado}`,
        contexto: quem.nome,
        anotacoes: observacao.trim() || undefined,
        resultado,
        objetivo: objetivo === "Outro" ? outroDetalhe.trim() : objetivo,
        proximoPasso,
        quando: ocorridaEm,
        ocorridaEm,
        proximoContatoEm,
        relacionamentoId: quem.id,
        clienteNome: quem.nome,
        clienteTelefone: quem.telefone,
        clienteEmail: quem.email,
        clienteCategoria: quem.categoria,
        origem,
        ...localizacao,
        metadata: {
          prazo_selecionado: quando,
          houve_oportunidade: houveOportunidade === "Sim",
          outro_objetivo: objetivo === "Outro" ? outroDetalhe.trim() : null,
        },
      });

      if (!actividade) {
        setErro("Não consegui salvar a visita.");
        return;
      }

      if (houveOportunidade === "Sim" && valorNumerico > 0) {
        const oportunidade = await addOportunidade({
          cliente: quem.nome,
          produto:
            observacao.trim() ||
            `Oportunidade identificada em visita (${objetivo})`,
          descricao: `Visita ${tipoVisita}. Resultado: ${resultado}.`,
          valor: valorNumerico,
          // A primeira etapa é a do funil DESTA loja. Estava escrita à mão:
          // numa loja que renomeasse a etapa inicial, a oportunidade nascida
          // de uma visita caía numa coluna que não existe.
          etapa: primeiraEtapa(funil),
          probabilidade: probabilidade || "Média",
          relacionamentoId: quem.id,
          empresa: quem.empresa,
        });

        if (!oportunidade) {
          setErro(
            "A visita foi salva, mas não consegui criar a oportunidade.",
          );
          return;
        }
      }

      onConcluir();
    } catch (error) {
      console.error("Erro ao concluir visita:", error);
      setErro("Ocorreu um erro ao guardar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SearchRelationshipField
        label="Quem você visitou?"
        value={quem}
        onChange={setQuem}
      />

      <ChoiceChips
        label="A visita foi"
        options={["Visita normal", "Revisita", "Prospecção", "Pós-venda"]}
        value={tipoVisita}
        onChange={setTipoVisita}
      />

      <ChoiceChips
        label="Objetivo da visita"
        options={["Apresentação", "Levantar projeto", "Entregar catálogo", "Negociação", "Relacionamento", "Medição", "Outro"]}
        value={objetivo}
        onChange={setObjetivo}
      />

      {objetivo === "Outro" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
            Qual foi o outro objetivo? *
          </label>
          <input
            type="text"
            value={outroDetalhe}
            onChange={(event) => setOutroDetalhe(event.target.value)}
            placeholder="Ex.: tomar café, tirar medida, acompanhar obra..."
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
          />
        </div>
      )}

      <ResultRating value={resultado} onChange={setResultado} />
      <ObservationField
        value={observacao}
        onChange={setObservacao}
        label="Relato da visita"
        ajuda="Obrigatório. Fale pelo microfone ou escreva: o que foi apresentado, o que o cliente falou e o que ficou combinado."
      />

      <ChoiceChips label="Origem do contato" options={["Marketing", "Loja", "Prospecção", "Indicação", "Site", "WhatsApp", "Outro"]} value={origem} onChange={setOrigem} />

      <ChoiceChips
        label="Próximo passo"
        options={[
          "Ligar",
          "Retornar",
          "Enviar orçamento",
          "Nova visita",
          "Enviar catálogo",
          "Enviar fotos",
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

      <ChoiceChips
        label="Houve oportunidade?"
        options={["Sim", "Não"]}
        value={houveOportunidade}
        onChange={setHouveOportunidade}
      />

      {houveOportunidade === "Sim" && (
        <div className="flex flex-col gap-4 rounded-xl border border-aura-mist bg-aura-bg p-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-aura-graphite">
              Valor estimado
            </p>
            <input
              type="text"
              inputMode="decimal"
              value={valorEstimado}
              onChange={(event) => setValorEstimado(event.target.value)}
              placeholder="R$ 0,00"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>
          <ChoiceChips
            label="Probabilidade"
            options={["Baixa", "Média", "Alta"]}
            value={probabilidade}
            onChange={(valor) => setProbabilidade(valor as Probabilidade)}
          />
        </div>
      )}

      <LocationCaptureField value={localizacao} onChange={setLocalizacao} capturarSozinho />

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
            <Loader2 size={16} className="animate-spin" />Salvando...
          </>
        ) : (
          "Concluir visita"
        )}
      </button>
    </div>
  );
}
