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
import { CampoMoeda } from "@/components/shared/campo-moeda";
import { mesEmBrasilia } from "@/lib/meta-mensal";
import { classeBotao } from "@/components/ui";

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

const mesAtual = () => mesEmBrasilia();

/**
 * `obrigatorio`: aberto pela trava do mês (TravaMetaMensal). Sem fechar e sem
 * cancelar, e dentro da tela da trava em vez de por cima da página.
 */
export function CompromissoMensalModal({ onClose, obrigatorio = false }: { onClose: () => void; obrigatorio?: boolean }) {
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
      alert("Sua sessão expirou. Entre de novo para continuar.");
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
      alert("Sua sessão expirou. Entre de novo para continuar.");
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
      alert("Não consegui enviar o compromisso. Tente de novo.");
    }
  }

  const gruposFiltrados = Array.from(
    new Set(CAMPOS_NUMERICOS.map((c) => c.grupo))
  ).map((grupo) => ({
    grupo,
    campos: CAMPOS_NUMERICOS.filter((c) => c.grupo === grupo),
  }));

  return (
    <div
      className={
        obrigatorio
          ? "flex min-h-0 flex-1 justify-center overflow-y-auto px-4 pb-6"
          : "fixed inset-0 z-50 flex items-center justify-center bg-aura-navy-950/50 p-4 backdrop-blur-[2px]"
      }
    >
      <div className={`w-full max-w-2xl rounded-xl border border-aura-mist bg-aura-surface shadow-xl ${obrigatorio ? "self-start" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-aura-mist px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-aura-graphite">
            Compromisso do Mês — {mesAtual()}
          </h2>
          {!obrigatorio && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition hover:bg-aura-sunken"
              aria-label="Fechar"
            >
              <X size={18} className="text-aura-graphite-soft" />
            </button>
          )}
        </div>

        {/* Conteúdo */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
          {/* Objetivo Pessoal */}
          <div>
            <label className="aura-label">
              Objetivo Pessoal para este mês
            </label>
            <textarea
              value={form.objetivoPessoal}
              onChange={(e) =>
                setForm({ ...form, objetivoPessoal: e.target.value })
              }
              placeholder="Descreva seu objetivo pessoal..."
              className="aura-input"
              rows={3}
            />
          </div>

          {/* Metas por Grupo */}
          {gruposFiltrados.map(({ grupo, campos }) => (
            <div key={grupo}>
              <p className="aura-rotulo mb-3">{grupo}</p>
              <div className="grid grid-cols-2 gap-3">
                {campos.map(({ chave, label }) => (
                  <div key={chave} className={chave === "metaFaturamento" ? "col-span-2" : undefined}>
                    <label className="block text-xs font-medium text-aura-graphite-soft">
                      {label}
                    </label>
                    {/*
                      Faturamento vai no campo com máscara: agrupa o milhar e
                      escreve por extenso. Num <input type="number"> o ponto é
                      separador decimal, então "200.000" valia 200.
                    */}
                    {chave === "metaFaturamento" ? (
                      <div className="mt-1">
                        <CampoMoeda
                          valor={form[chave]}
                          onChange={(digitos) => setForm({ ...form, [chave]: digitos })}
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={form[chave]}
                        onChange={(e) =>
                          setForm({ ...form, [chave]: e.target.value })
                        }
                        placeholder="0"
                        className="aura-input mt-1 tabular-nums"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-aura-mist bg-aura-sunken/50 px-6 py-3.5">
          {!obrigatorio && (
            <button
              onClick={onClose}
              className={classeBotao("fantasma", "md", "mr-auto")}
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSalvarRascunho}
            disabled={salvando || enviando}
            className={classeBotao("secundario")}
          >
            {salvando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {salvando ? "Salvando..." : "Salvar Rascunho"}
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || salvando}
            className={classeBotao("primario")}
          >
            {enviando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
            {enviando ? "Enviando..." : "Enviar para Aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}