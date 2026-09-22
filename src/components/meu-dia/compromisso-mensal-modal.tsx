"use client";

import { useEffect, useState } from "react";
import { X, Send, Save, Loader2 } from "lucide-react";
import {
  buscarCompromissoDoMes,
  salvarCompromisso,
  type CompromissoMensal,
} from "@/lib/supabase/compromisso-mensal";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface FormState {
  metaFaturamento: string;
  metaClientesNovos: string;
  metaArquitetos: string;
  metaConstrutoras: string;
  metaObras: string;
  metaVisitas: string;
  metaLigacoes: string;
  objetivoPessoal: string;
}

const CAMPOS_NUMERICOS: { chave: keyof FormState; label: string; grupo: string }[] = [
  { chave: "metaFaturamento", label: "Meta de faturamento (R$)", grupo: "Faturamento" },
  { chave: "metaClientesNovos", label: "Clientes novos", grupo: "Prospecção" },
  { chave: "metaArquitetos", label: "Arquitetos", grupo: "Prospecção" },
  { chave: "metaConstrutoras", label: "Construtoras", grupo: "Prospecção" },
  { chave: "metaObras", label: "Obras com contato", grupo: "Prospecção" },
  { chave: "metaVisitas", label: "Visitas", grupo: "Prospecção" },
  { chave: "metaLigacoes", label: "Ligações", grupo: "Prospecção" },
];

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export function CompromissoMensalModal({ onClose }: { onClose: () => void }) {
  const { profile } = useUserProfile();
  const [form, setForm] = useState<FormState>({
    metaFaturamento: "",
    metaClientesNovos: "",
    metaArquitetos: "",
    metaConstrutoras: "",
    metaObras: "",
    metaVisitas: "",
    metaLigacoes: "",
    objetivoPessoal: "",
  });

  const [compromisso, setCompromisso] = useState<CompromissoMensal | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function carregar() {
      const c = await buscarCompromissoDoMes();
      if (c) {
        setCompromisso(c);
        setForm({
          metaFaturamento: String(c.metaFaturamento || ""),
          metaClientesNovos: String(c.metaClientesNovos || ""),
          metaArquitetos: String(c.metaArquitetos || ""),
          metaConstrutoras: String(c.metaConstrutoras || ""),
          metaObras: String(c.metaObras || ""),
          metaVisitas: String(c.metaVisitas || ""),
          metaLigacoes: String(c.metaLigacoes || ""),
          objetivoPessoal: c.objetivoPessoal || "",
        });
      }
    }
    carregar();
  }, []);

    async function handleSalvarRascunho() {
    setSalvando(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase!.auth.getUser();
    
    if (!user) {
      alert("Erro: usuário não autenticado");
      setSalvando(false);
      return;
    }

    const ok = await salvarCompromisso({
      id: compromisso?.id,
      vendedorId: user.id,
      empresa: profile.empresa,
      mes: mesAtual(),
      metaFaturamento: Number(form.metaFaturamento),
      metaClientesNovos: Number(form.metaClientesNovos),
      metaArquitetos: Number(form.metaArquitetos),
      metaConstrutoras: Number(form.metaConstrutoras),
      metaObras: Number(form.metaObras),
      metaVisitas: Number(form.metaVisitas),
      metaLigacoes: Number(form.metaLigacoes),
      objetivoPessoal: form.objetivoPessoal,
      status: "rascunho",
      feedbackGestor: null,
    });
    setSalvando(false);
    if (ok) {
      alert("Rascunho salvo com sucesso!");
    }
  }

    async function handleEnviar() {
    if (!form.metaFaturamento || !form.metaClientesNovos) {
      alert("Preencha pelo menos faturamento e clientes novos");
      return;
    }

    setEnviando(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase!.auth.getUser();
    
    if (!user) {
      alert("Erro: usuário não autenticado");
      setEnviando(false);
      return;
    }

    const ok = await salvarCompromisso({
      id: compromisso?.id,
      vendedorId: user.id,
      empresa: profile.empresa,
      mes: mesAtual(),
      metaFaturamento: Number(form.metaFaturamento),
      metaClientesNovos: Number(form.metaClientesNovos),
      metaArquitetos: Number(form.metaArquitetos),
      metaConstrutoras: Number(form.metaConstrutoras),
      metaObras: Number(form.metaObras),
      metaVisitas: Number(form.metaVisitas),
      metaLigacoes: Number(form.metaLigacoes),
      objetivoPessoal: form.objetivoPessoal,
      status: "pendente_aprovacao",
      feedbackGestor: null,
    });
    setEnviando(false);

    if (ok) {
      alert("Compromisso enviado para aprovação!");
      onClose();
    } else {
      alert("Erro ao enviar compromisso");
    }
  }

  const gruposFiltrados = Array.from(
    new Set(CAMPOS_NUMERICOS.map((c) => c.grupo))
  ).map((grupo) => ({
    grupo,
    campos: CAMPOS_NUMERICOS.filter((c) => c.grupo === grupo),
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-2xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-aura-mist px-6 py-4">
          <h2 className="font-display text-xl font-bold text-aura-graphite">
            Compromisso do Mês — {mesAtual()}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition hover:bg-aura-bg"
          >
            <X size={20} className="text-aura-graphite-soft" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
          {/* Objetivo Pessoal */}
          <div>
            <label className="block text-sm font-medium text-aura-graphite">
              Objetivo Pessoal para este mês
            </label>
            <textarea
              value={form.objetivoPessoal}
              onChange={(e) =>
                setForm({ ...form, objetivoPessoal: e.target.value })
              }
              placeholder="Descreva seu objetivo pessoal..."
              className="mt-2 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
              rows={3}
            />
          </div>

          {/* Metas por Grupo */}
          {gruposFiltrados.map(({ grupo, campos }) => (
            <div key={grupo}>
              <p className="mb-3 font-medium text-aura-graphite">{grupo}</p>
              <div className="grid grid-cols-2 gap-3">
                {campos.map(({ chave, label }) => (
                  <div key={chave}>
                    <label className="block text-xs text-aura-graphite-soft">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={form[chave]}
                      onChange={(e) =>
                        setForm({ ...form, [chave]: e.target.value })
                      }
                      placeholder="0"
                      className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-aura-mist px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-aura-mist px-4 py-2.5 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvarRascunho}
            disabled={salvando || enviando}
            className="flex items-center justify-center gap-2 rounded-lg bg-aura-graphite-soft px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-graphite disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {salvando ? "Salvando..." : "Salvar Rascunho"}
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || salvando}
            className="flex items-center justify-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {enviando ? "Enviando..." : "Enviar para Aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}