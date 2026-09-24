"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { SearchRelationshipField } from "./search-relationship-field";
import { ChoiceChips } from "./choice-chips";
import { WhenPicker } from "./when-picker";
import { CamposFaltando } from "./campos-faltando";
import { ObservationField } from "./observation-field";
import {
  LocationCaptureField,
  type ActivityLocation,
} from "./location-capture-field";
import { dataHoraLocalParaIso, prazoParaIso } from "./activity-date";
import type { Relacionamento } from "@/lib/types";

const RESULTADOS = [
  "Positivo",
  "Neutro",
  "Negativo",
  "Sem resposta",
  "Agendado",
];

export function ReuniaoForm({ onConcluir }: { onConcluir: () => void }) {
  const { addAtividade } = useAppData();
  const [quem, setQuem] = useState<Relacionamento | null>(null);
  const [resultado, setResultado] = useState("Positivo");
  const [assunto, setAssunto] = useState("");
  const [dataReuniao, setDataReuniao] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [horaReuniao, setHoraReuniao] = useState("10:00");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [origem, setOrigem] = useState("");
  const [proximoPasso, setProximoPasso] = useState<string | null>(null);
  const [quando, setQuando] = useState<string | null>(null);
  const [localizacao, setLocalizacao] = useState<ActivityLocation>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const exigeData = proximoPasso !== "Encerrado";
  const camposFaltando = [
    !quem && "Participante",
    !assunto.trim() && "Assunto",
    !resultado && "Resultado",
    !observacoes.trim() && "Relato da reunião (fale pelo microfone ou escreva)",
    !origem && "Origem do contato",
    !proximoPasso && "Próximo passo",
    exigeData && !quando && "Quando será o próximo contato",
  ].filter(Boolean) as string[];

  const podeConcluir = camposFaltando.length === 0 && !salvando;

  async function handleSalvar() {
    if (!quem || !assunto.trim() || !resultado || !proximoPasso) return;

    setSalvando(true);
    setErro("");

    try {
      const ocorridaEm = dataHoraLocalParaIso(dataReuniao, horaReuniao);
      const proximoContatoEm =
        proximoPasso === "Encerrado" ? undefined : prazoParaIso(quando);
      const endereco =
        localizacao.endereco?.trim() || local.trim() || undefined;

      const actividade = await addAtividade({
        vendedorId: "",
        tipo: "Reunião",
        titulo: `Reunião · ${assunto.trim()} · ${resultado}`,
        contexto: quem.nome,
        anotacoes: observacoes.trim() || undefined,
        resultado,
        objetivo: assunto.trim(),
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
        endereco,
        metadata: {
          hora_reuniao: horaReuniao,
          prazo_selecionado: quando,
        },
      });

      if (!actividade) {
        setErro("Não foi possível guardar a reunião.");
        return;
      }

      onConcluir();
    } catch (error) {
      console.error("Erro ao registar reunião:", error);
      setErro("Ocorreu um erro ao guardar a reunião.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SearchRelationshipField
        label="Com quem foi a reunião?"
        value={quem}
        onChange={setQuem}
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-aura-graphite">
          Assunto *
        </label>
        <input
          type="text"
          value={assunto}
          onChange={(event) => setAssunto(event.target.value)}
          placeholder="Qual foi o assunto da reunião?"
          className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-aura-graphite">
            Data
          </label>
          <input
            type="date"
            value={dataReuniao}
            onChange={(event) => setDataReuniao(event.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-aura-graphite">
            Hora
          </label>
          <input
            type="time"
            value={horaReuniao}
            onChange={(event) => setHoraReuniao(event.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-aura-graphite">
          Local informado
        </label>
        <input
          type="text"
          value={local}
          onChange={(event) => setLocal(event.target.value)}
          placeholder="Ex.: escritório, loja ou obra"
          className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-aura-graphite">
          Resultado
        </label>
        <select
          value={resultado}
          onChange={(event) => setResultado(event.target.value)}
          className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        >
          {RESULTADOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <ObservationField
        value={observacoes}
        onChange={setObservacoes}
        label="Relato da reunião"
        ajuda="Obrigatório. Fale pelo microfone ou escreva o que foi tratado e o que ficou combinado."
      />
      <ChoiceChips label="Origem do contato" options={["Marketing", "Loja", "Prospecção", "Indicação", "Site", "WhatsApp", "Outro"]} value={origem} onChange={setOrigem} />

      <ChoiceChips
        label="Próximo passo"
        options={[
          "Ligar",
          "Enviar orçamento",
          "Nova reunião",
          "Nova visita",
          "Aguardar retorno",
          "Encerrado",
        ]}
        value={proximoPasso}
        onChange={setProximoPasso}
      />

      {proximoPasso !== "Encerrado" && (
        <WhenPicker value={quando} onChange={setQuando} />
      )}

      <LocationCaptureField
        value={{ ...localizacao, endereco: localizacao.endereco || local }}
        onChange={setLocalizacao}
      />

      <CamposFaltando campos={camposFaltando} />
      {erro && <p className="text-sm text-aura-danger">{erro}</p>}

      <button
        type="button"
        onClick={() => void handleSalvar()}
        disabled={!podeConcluir}
        className="flex items-center justify-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? (
          <>
            <Loader2 size={16} className="animate-spin" />Salvando...
          </>
        ) : (
          "Registar reunião"
        )}
      </button>
    </div>
  );
}
