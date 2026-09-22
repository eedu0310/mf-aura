"use client";

import { useState } from "react";
import { LocateFixed, Loader2, MapPin, RotateCcw } from "lucide-react";

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
  obrigatoria?: boolean;
}

function mensagemErroGeolocalizacao(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Permissão de localização negada. Autorize a localização no navegador ou informe o endereço.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "O dispositivo não conseguiu determinar a localização.";
  }
  if (error.code === error.TIMEOUT) {
    return "A localização demorou demasiado. Tente novamente num local com melhor sinal.";
  }
  return "Não foi possível obter a localização.";
}

export function LocationCaptureField({
  value,
  onChange,
  obrigatoria = false,
}: LocationCaptureFieldProps) {
  const [capturando, setCapturando] = useState(false);
  const [erro, setErro] = useState("");

  function capturar() {
    setErro("");

    if (!("geolocation" in navigator)) {
      setErro("Este dispositivo não oferece geolocalização no navegador.");
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
        setErro(mensagemErroGeolocalizacao(error));
        setCapturando(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 60_000,
      },
    );
  }

  function limpar() {
    onChange({ endereco: value.endereco });
    setErro("");
  }

  const possuiCoordenadas =
    typeof value.latitude === "number" && typeof value.longitude === "number";

  return (
    <div className="rounded-xl border border-aura-mist bg-aura-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-aura-graphite">
            <MapPin size={16} className="text-aura-petrol-600" />
            Local da actividade {obrigatoria ? "*" : "(opcional)"}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            A localização só é capturada após a sua autorização.
          </p>
        </div>

        {possuiCoordenadas && (
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
        {capturando ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <LocateFixed size={16} />
        )}
        {capturando
          ? "A obter localização..."
          : possuiCoordenadas
            ? "Actualizar localização"
            : "Usar localização actual"}
      </button>

      {possuiCoordenadas && (
        <div className="mt-3 rounded-lg bg-aura-success/10 px-3 py-2 text-xs text-aura-success">
          Localização capturada com precisão aproximada de{" "}
          {Math.round(value.precisaoMetros || 0)} metros.
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1.5 block text-xs text-aura-graphite-soft">
          Endereço ou referência
        </label>
        <input
          type="text"
          value={value.endereco || ""}
          onChange={(event) =>
            onChange({ ...value, endereco: event.target.value })
          }
          placeholder="Ex.: Loja Centro, Rua..., obra do cliente"
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      {erro && <p className="mt-2 text-xs text-aura-danger">{erro}</p>}
    </div>
  );
}
