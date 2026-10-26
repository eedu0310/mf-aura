"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";

/** Recorta o quadrado do meio e reduz para 400 px: foto leve e sempre redonda certinha. */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não consegui abrir essa imagem."));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - lado) / 2;
    const sy = (img.naturalHeight - lado) / 2;
    const alvo = Math.min(400, lado);
    const canvas = document.createElement("canvas");
    canvas.width = alvo;
    canvas.height = alvo;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, alvo, alvo);
    return await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não consegui preparar a foto."))), "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FotoDePerfil() {
  const { profile, setFotoUrl } = useUserProfile();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(arquivo: File) {
    setErro(null);
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma imagem (foto).");
    if (arquivo.size > 20 * 1024 * 1024) return setErro("Imagem grande demais (máximo 20 MB).");
    setOcupado(true);
    try {
      const foto = await prepararFoto(arquivo);
      const fd = new FormData();
      fd.append("foto", new File([foto], "foto.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/perfil/foto", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || "Não consegui salvar a foto.");
      setFotoUrl(j.url);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui salvar a foto.");
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function tirar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/perfil/foto", { method: "DELETE" });
      if (!r.ok) throw new Error("Não consegui tirar a foto.");
      setFotoUrl(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui tirar a foto.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={ocupado}
        aria-label={profile.fotoUrl ? "Trocar foto de perfil" : "Colocar foto de perfil"}
        className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-petrol-500"
      >
        <AvatarUsuario
          foto={profile.fotoUrl}
          iniciais={profile.avatarIniciais}
          alt={profile.nome}
          className="h-16 w-16 bg-aura-petrol-700/10 font-display text-lg font-semibold text-aura-petrol-700"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
          {ocupado ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </span>
      </button>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={ocupado}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
          >
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {profile.fotoUrl ? "Trocar foto" : "Colocar foto"}
          </button>
          {profile.fotoUrl && (
            <button
              type="button"
              onClick={() => void tirar()}
              disabled={ocupado}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-aura-graphite-soft hover:text-aura-danger disabled:opacity-60"
            >
              <Trash2 size={14} /> Tirar
            </button>
          )}
        </div>
        <p className="text-xs text-aura-graphite-soft">Aparece no topo da AURA e, para a equipe da MF, no chat do site.</p>
        {erro && <p role="alert" className="text-xs text-aura-danger">{erro}</p>}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void trocar(f);
        }}
      />
    </div>
  );
}
