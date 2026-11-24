"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { listarFaq, criarFaq, apagarFaq, type Faq } from "@/lib/supabase/faq";
import { useUserProfile } from "@/lib/user-profile-context";
import { classeBotao } from "@/components/ui";

export function FaqManager() {
  const { profile } = useUserProfile();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const lista = await listarFaq();
    if (lista) setFaqs(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pergunta.trim() || !resposta.trim()) return;
    setSalvando(true);
    await criarFaq({
      empresa: profile.empresa,
      pergunta: pergunta.trim(),
      resposta: resposta.trim(),
      link: link.trim() || undefined,
      ordem: faqs.length,
    });
    setPergunta("");
    setResposta("");
    setLink("");
    setMostrarForm(false);
    setSalvando(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover esta pergunta do FAQ?")) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    await apagarFaq(id);
  }

  return (
    <div className="aura-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">FAQ da Academy</p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className={classeBotao("secundario", "sm")}
        >
          <Plus size={13} />
          Nova pergunta
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={salvar} className="mt-4 flex flex-col gap-3 rounded-lg border border-aura-mist bg-aura-sunken p-4">
          <input
            type="text"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Pergunta"
            className="aura-input"
          />
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Resposta"
            rows={3}
            className="aura-input resize-none"
          />
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link de apoio (opcional)"
            className="aura-input"
          />
          <button
            type="submit"
            disabled={salvando || !pergunta.trim() || !resposta.trim()}
            className={classeBotao("primario")}
          >
            {salvando ? "Salvando..." : "Adicionar pergunta"}
          </button>
        </form>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
        {faqs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-aura-mist py-6 text-center text-xs text-aura-graphite-soft">
            Nenhuma pergunta cadastrada ainda.
          </p>
        ) : (
          faqs.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <p className="min-w-0 truncate text-sm text-aura-graphite">{f.pergunta}</p>
              <button
                type="button"
                onClick={() => excluir(f.id)}
                aria-label="Excluir pergunta"
                className="shrink-0 text-aura-graphite-soft hover:text-aura-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
