"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Plus, Trash2, ExternalLink } from "lucide-react";
import { listarTreinamentos, criarTreinamento, apagarTreinamento, type Treinamento } from "@/lib/supabase/academy";
import { useUserProfile } from "@/lib/user-profile-context";

export function AcademyManager() {
  const { profile } = useUserProfile();
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const lista = await listarTreinamentos();
    if (lista) setTreinamentos(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);
    await criarTreinamento({
      empresa: profile.empresa,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoria: categoria.trim() || undefined,
      link: link.trim() || undefined,
    });
    setTitulo("");
    setDescricao("");
    setCategoria("");
    setLink("");
    setMostrarForm(false);
    setSalvando(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover este treinamento? Ele some da Academy de todos os vendedores.")) return;
    setTreinamentos((prev) => prev.filter((t) => t.id !== id));
    await apagarTreinamento(id);
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Academy — treinamentos da loja</p>
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
            placeholder="Título do treinamento"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição curta (opcional)"
            className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Categoria (opcional)"
              className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
            />
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link do material — cole um link do YouTube pra tocar embutido"
              className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
            />
          </div>
          <button
            type="submit"
            disabled={salvando || !titulo.trim()}
            className="rounded-xl bg-aura-petrol-700 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Adicionar treinamento"}
          </button>
        </form>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
        {treinamentos.length === 0 ? (
          <p className="py-4 text-center text-xs text-aura-graphite-soft">
            Nenhum treinamento cadastrado ainda.
          </p>
        ) : (
          treinamentos.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-aura-graphite">{t.titulo}</p>
                <div className="flex items-center gap-2">
                  {t.categoria && <span className="text-xs text-aura-graphite-soft">{t.categoria}</span>}
                  {t.link && (
                    <a
                      href={t.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-aura-petrol-600 hover:underline"
                    >
                      <ExternalLink size={10} />
                      link
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => excluir(t.id)}
                aria-label="Excluir treinamento"
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
