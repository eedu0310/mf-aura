"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

/** Botão que sobe imagem ou PDF para a pasta pública do site e devolve o link. */
export function UploadArquivo({ rotulo, aceita, onPronto }: { rotulo: string; aceita: string; onPronto: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function subir(arquivo: File) {
    setSubindo(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/site/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || (r.status === 413 ? "Arquivo grande demais para o servidor." : "Não consegui subir."));
      onPronto(j.url);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui subir.");
    } finally {
      setSubindo(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        type="file"
        accept={aceita}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={subindo}
        className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-aura-mist bg-white px-3.5 text-sm font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
      >
        {subindo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {rotulo}
      </button>
      {erro && <p className="text-xs text-red-700">{erro}</p>}
    </div>
  );
}
