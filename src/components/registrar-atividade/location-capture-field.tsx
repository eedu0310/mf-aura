"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, LocateFixed, Loader2, MapPin, RotateCcw } from "lucide-react";

export interface ActivityLocation {
  latitude?: number;
  longitude?: number;
  precisaoMetros?: number;
  endereco?: string;
  localizacaoCapturadaEm?: string;
  origemDispositivo?: string;
}

interface LocationCaptureFieldProps {
  value: ActivityLocation;
  onChange: (value: ActivityLocation) => void;
  /**
   * Começa a captura sozinha ao abrir o formulário, sem esperar clique.
   * O registro continua opcional: se o GPS falhar ou a pessoa negar, o
   * formulário segue normalmente.
   */
  capturarSozinho?: boolean;
}

function mensagemErro(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Você negou o acesso à localização. Libere nas permissões do navegador ou escreva o endereço abaixo.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "O aparelho não conseguiu achar a localização. Escreva o endereço abaixo.";
  }
  if (error.code === error.TIMEOUT) {
    return "O GPS demorou demais. Tente de novo num lugar com sinal melhor, ou escreva o endereço.";
  }
  return "Não consegui pegar a localização. Escreva o endereço abaixo.";
}

export function LocationCaptureField({
  value,
  onChange,
  capturarSozinho = false,
}: LocationCaptureFieldProps) {
  const [capturando, setCapturando] = useState(false);
  const [erro, setErro] = useState("");
  const [semHttps, setSemHttps] = useState(false);
  const [tentou, setTentou] = useState(false);

  const temCoordenadas =
    typeof value.latitude === "number" && typeof value.longitude === "number";

  const capturar = useCallback(() => {
    setErro("");
    setTentou(true);

    // O navegador só entrega GPS em página segura. Num celular acessando por
    // http://192.168... a chamada falha sem explicação nenhuma — era por isso
    // que nenhuma visita tinha coordenada.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setSemHttps(true);
      return;
    }
    if (!("geolocation" in navigator)) {
      setErro("Este aparelho não oferece localização pelo navegador.");
      return;
    }

    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisaoMetros: position.coords.accuracy,
          localizacaoCapturadaEm: new Date(position.timestamp).toISOString(),
          origemDispositivo: "pwa_geolocation",
        });
        setCapturando(false);
      },
      (error) => {
        setErro(mensagemErro(error));
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [onChange, value]);

  // Numa visita a localização é o registro de que o vendedor esteve lá, então
  // ela é pedida assim que o formulário abre, em vez de esperar um clique que
  // nunca acontecia.
  useEffect(() => {
    if (capturarSozinho && !temCoordenadas && !tentou) capturar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturarSozinho]);

  function limpar() {
    onChange({ endereco: value.endereco });
    setErro("");
    setTentou(false);
  }

  return (
    <div className="rounded-xl border border-aura-mist bg-aura-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
            <MapPin size={16} className="text-aura-petrol-600" />
            Local da atividade (opcional)
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Fica como comprovante de que você esteve no cliente. Se não quiser, é só seguir.
          </p>
        </div>

        {temCoordenadas && (
          <button
            type="button"
            onClick={limpar}
            aria-label="Limpar localização capturada"
            className="rounded-lg p-2 text-aura-graphite-soft hover:bg-white hover:text-aura-graphite"
          >
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={capturar}
        disabled={capturando}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-aura-petrol-500/30 bg-white px-4 py-2.5 text-sm font-medium text-aura-petrol-700 transition hover:border-aura-petrol-500 disabled:opacity-60"
      >
        {capturando ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
        {capturando
          ? "Pegando a localização..."
          : temCoordenadas
            ? "Atualizar localização"
            : "Usar minha localização"}
      </button>

      {temCoordenadas && (
        <div className="mt-3 rounded-lg bg-aura-success/10 px-3 py-2 text-xs text-aura-success">
          Localização registrada, com precisão de cerca de {Math.round(value.precisaoMetros || 0)}{" "}
          metros.
        </div>
      )}

      {semHttps && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-aura-warning/10 px-3 py-2 text-xs text-aura-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Esta página não está em HTTPS, e o navegador só libera o GPS em endereço seguro.
            Escreva o endereço abaixo por enquanto — no site publicado a localização funciona
            sozinha.
          </span>
        </p>
      )}

      <div className="mt-3">
        <label className="mb-1.5 block text-xs text-aura-graphite-soft">
          Endereço ou referência
        </label>
        <input
          type="text"
          value={value.endereco || ""}
          onChange={(event) => onChange({ ...value, endereco: event.target.value })}
          placeholder="Ex.: Loja Centro, Rua..., obra do cliente"
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      {erro && <p className="mt-2 text-xs text-aura-danger">{erro}</p>}
    </div>
  );
}
