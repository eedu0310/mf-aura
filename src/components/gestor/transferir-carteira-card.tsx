"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { listarUsuariosPorEmpresa, type Usuario } from "@/lib/supabase/usuarios-management";
import { useUserProfile } from "@/lib/user-profile-context";

export function TransferirCarteiraCard() {
  const { profile } = useUserProfile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    void listarUsuariosPorEmpresa(profile.empresa).then(setUsuarios);
  }, [profile.empresa]);

  async function transferir() {
    if (!origem || !destino || origem === destino) {
      setMensagem("Selecione vendedores diferentes.");
      return;
    }

    setProcessando(true);
    setMensagem("");

    // A transferência passa por uma rota do servidor que confere o cargo.
    // Chamar a função do banco direto daqui deixava qualquer vendedor
    // logado puxar a carteira de um colega para si.
    const res = await fetch("/api/gestor/transferir-carteira", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem, destino }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMensagem(data?.erro ?? "Não consegui transferir a carteira.");
      setProcessando(false);
      return;
    }

    const resultado = (data ?? {}) as {
      relacionamentos_transferidos?: number;
      oportunidades_transferidas?: number;
    };
    setMensagem(
      `${resultado.relacionamentos_transferidos ?? 0} cliente(s) e ${
        resultado.oportunidades_transferidas ?? 0
      } negócio(s) do pipeline transferidos.`,
    );
    setProcessando(false);
  }

  const vendedores = usuarios.filter((usuario) => ["Vendedor", "Vendedor Interno", "SDR"].includes(usuario.cargo));

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-start gap-3">
        <ArrowRightLeft size={18} className="mt-0.5 text-aura-petrol-600" />
        <div>
          <p className="font-medium text-aura-graphite">Transferir carteira</p>
          <p className="text-xs text-aura-graphite-soft">Use antes ou depois de desativar um vendedor para não deixar clientes sem responsável.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="rounded-xl border border-aura-mist px-3 py-2 text-sm">
          <option value="">Vendedor atual</option>
          {vendedores.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}{!usuario.ativo ? " (inativo)" : ""}</option>)}
        </select>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} className="rounded-xl border border-aura-mist px-3 py-2 text-sm">
          <option value="">Novo responsável</option>
          {vendedores.filter((usuario) => usuario.ativo).map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
        </select>
      </div>

      <button type="button" onClick={transferir} disabled={processando} className="mt-3 flex items-center gap-2 rounded-xl bg-aura-petrol-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {processando && <Loader2 size={15} className="animate-spin" />}
        Transferir carteira
      </button>
      {mensagem && <p className="mt-3 text-xs text-aura-graphite-soft">{mensagem}</p>}
    </div>
  );
}
