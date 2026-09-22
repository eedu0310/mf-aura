"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, Trash2, ExternalLink } from "lucide-react";
import { listarLinks, criarLink, apagarLink, type LinkUtil } from "@/lib/supabase/links";
import { useUserProfile } from "@/lib/user-profile-context";

const CATEGORIAS = ["Catálogo", "Planilha", "Vendas", "Marketing", "Outro"];

export function LinksManager() {
  const { profile } = useUserProfile();
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const lista = await listarLinks();
    if (lista) setLinks(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;
    setSalvando(true);
    await criarLink({ empresa: profile.empresa, titulo: titulo.trim(), url: url.trim(), categoria });
    setTitulo("");
    setUrl("");
    setMostrarForm(false);
    setSalvando(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover este link? Ele some da Área do Vendedor de todos.")) return;
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await apagarLink(id);
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Área do Vendedor — links úteis</p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-aura-mist px-3 py-1.5 text-xs font-medium text-aura-graphite hover:bg-aura-bg"
        >
          <Plus size={13} />
          Novo
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={salvar} className="mt-4 flex flex-col gap-3 rounded-xl border border-aura-mist bg-aura-bg p-4">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ex.: Catálogo de Lareiras 2026)"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  categoria === c
                    ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                    : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={salvando || !titulo.trim() || !url.trim()}
            className="rounded-xl bg-aura-petrol-700 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Adicionar link"}
          </button>
        </form>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
        {links.length === 0 ? (
          <p className="py-4 text-center text-xs text-aura-graphite-soft">Nenhum link cadastrado ainda.</p>
        ) : (
          links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-aura-graphite">{l.titulo}</p>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-xs text-aura-petrol-600 hover:underline"
                >
                  <ExternalLink size={10} />
                  {l.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => excluir(l.id)}
                aria-label="Excluir link"
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
