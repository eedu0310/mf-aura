"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X, Check, Link2 } from "lucide-react";
import {
  CATEGORIAS_DE_LINK,
  atualizarLink,
  apagarLink,
  criarLink,
  type DadosDoLink,
  type LinkUtil,
} from "@/lib/supabase/links";
import { Selo, classeBotao } from "@/components/ui";

/**
 * O gestor cadastra, edita e apaga os links da loja (Gestor → Configurações).
 * O vendedor os vê na Área do Vendedor; um link com "frase para o WhatsApp"
 * aparece também nos atalhos da conversa, já com a frase.
 */
export function LinksGestor({ empresa, links, aoMudar }: { empresa: string; links: LinkUtil[]; aoMudar: () => void }) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<DadosDoLink>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function vazio(): DadosDoLink {
    return { titulo: "", url: "", categoria: "Catálogo", mensagemWhatsapp: "", ordem: 0 };
  }

  function comecarNovo() {
    setForm(vazio());
    setErro(null);
    setEditando("novo");
  }

  function comecarEdicao(l: LinkUtil) {
    setForm({ titulo: l.titulo, url: l.url, categoria: l.categoria ?? "Outro", mensagemWhatsapp: l.mensagemWhatsapp ?? "", ordem: l.ordem });
    setErro(null);
    setEditando(l.id);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (editando === "novo") await criarLink(empresa, form);
      else if (editando) await atualizarLink(editando, form);
      setEditando(null);
      aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(l: LinkUtil) {
    if (!window.confirm(`Apagar "${l.titulo}"? Ele some da Área do Vendedor e do WhatsApp.`)) return;
    try {
      await apagarLink(l.id);
      aoMudar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Não consegui apagar.");
    }
  }

  const campo = "aura-input";

  function formulario() {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-aura-mist bg-aura-sunken/50 p-4">
        <input className={campo} placeholder="Título (ex.: Catálogo dos Produtos)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <input className={campo} placeholder="Endereço (https://...)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <div className="flex gap-2">
          <select className={campo} value={form.categoria ?? "Outro"} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS_DE_LINK.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className={`${campo} w-24 shrink-0`}
            type="number"
            title="Ordem na lista (menor primeiro)"
            value={form.ordem ?? 0}
            onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
          />
        </div>
        <textarea
          className={campo}
          rows={2}
          placeholder="Frase para o WhatsApp (ex.: Aqui está o nosso catálogo para você conhecer os nossos produtos:). Deixe vazio para o link não aparecer na conversa."
          value={form.mensagemWhatsapp ?? ""}
          onChange={(e) => setForm({ ...form, mensagemWhatsapp: e.target.value })}
        />
        {erro && <p className="text-xs text-aura-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditando(null)} className={classeBotao("fantasma", "sm")}>
            <X size={14} /> Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={classeBotao("primario", "sm")}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="aura-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-aura-graphite">Links úteis e atalhos do WhatsApp</p>
          <p className="text-xs text-aura-graphite-soft">
            Aparecem na Área do Vendedor. Os que têm frase para o WhatsApp aparecem também em &ldquo;Enviar rápido&rdquo;, no painel do Supervisor, e no botão <Link2 size={12} className="inline" /> ao lado do campo de mensagem.
          </p>
        </div>
        {editando !== "novo" && (
          <button type="button" onClick={comecarNovo} className={classeBotao("primario", "sm", "shrink-0")}>
            <Plus size={14} /> Novo link
          </button>
        )}
      </div>

      {editando === "novo" && formulario()}

      <ul className="flex flex-col divide-y divide-aura-mist">
        {links.map((l) => (
          <li key={l.id} className="py-2">
            {editando === l.id ? (
              formulario()
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-aura-graphite">
                    {l.titulo}
                    {l.mensagemWhatsapp && <Selo tom="sucesso" className="ml-2">WhatsApp</Selo>}
                  </p>
                  <p className="truncate text-xs text-aura-graphite-soft">{l.mensagemWhatsapp || l.url}</p>
                </div>
                <button type="button" onClick={() => comecarEdicao(l)} aria-label="Editar" className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => apagar(l)} aria-label="Apagar" className="rounded-lg p-2 text-aura-danger hover:bg-aura-danger/10">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
