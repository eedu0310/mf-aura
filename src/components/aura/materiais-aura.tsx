"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";

interface Material {
  id: string;
  empresa: string;
  titulo: string;
  descricao: string | null;
  arquivo_nome: string | null;
  tipo: string | null;
  bytes: number | null;
  caracteres: number;
  ativo: boolean;
  criado_em: string;
}

const tamanho = (b: number | null) => (!b ? "" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/** Biblioteca da AURA: o gestor envia os materiais que a IA usa para orientar os vendedores. */
export function MateriaisAura({ loja }: { loja?: string }) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  /** Mandar o mesmo material para as quatro lojas de uma vez. */
  const [todasAsLojas, setTodasAsLojas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modo, setModo] = useState<"nenhum" | "arquivo" | "texto">("nenhum");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/aura/materiais${loja ? `?loja=${encodeURIComponent(loja)}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar materiais");
      setMateriais(json.materiais ?? []);
      setPodeEditar(!!json.podeEditar);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar materiais");
    } finally {
      setCarregando(false);
    }
  }, [loja]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function limpar() {
    setModo("nenhum");
    setTitulo("");
    setDescricao("");
    setTexto("");
    setArquivo(null);
    setTodasAsLojas(false);
  }

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      let res: Response;
      if (modo === "arquivo") {
        if (!arquivo) throw new Error("Escolha um arquivo.");
        const form = new FormData();
        form.append("file", arquivo);
        form.append("titulo", titulo);
        form.append("descricao", descricao);
        if (todasAsLojas) form.append("loja", "todas");
        else if (loja) form.append("loja", loja);
        res = await fetch("/api/aura/materiais", { method: "POST", body: form });
      } else {
        res = await fetch("/api/aura/materiais", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo, descricao, texto, loja: todasAsLojas ? "todas" : loja }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar");
      if (json.aviso) setAviso(json.aviso);
      else if (Array.isArray(json.lojas) && json.lojas.length > 1) {
        setAviso(`Enviado para ${json.lojas.length} lojas, em ${json.trechos} trechos buscáveis.`);
      }
      limpar();
      carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(m: Material) {
    await fetch("/api/aura/materiais", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, ativo: !m.ativo }),
    });
    carregar();
  }

  async function remover(m: Material) {
    if (!window.confirm(`Excluir "${m.titulo}"? A AURA deixa de usar este material.`)) return;
    await fetch(`/api/aura/materiais?id=${m.id}`, { method: "DELETE" });
    carregar();
  }

  const ativos = materiais.filter((m) => m.ativo);
  const totalPaginas = Math.round(ativos.reduce((s, m) => s + m.caracteres, 0) / 1800);

  return (
    <section className="rounded-2xl border border-aura-mist bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-mist px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-navy-950">
            <BookOpen className="h-5 w-5 text-aura-gold" />
          </span>
          <div>
            <h3 className="font-semibold text-aura-graphite">Materiais que a AURA estuda</h3>
            <p className="text-xs text-aura-graphite-soft">
              Manual de vendas, playbook, tabela de produtos, scripts. A IA usa isso para orientar os vendedores.
            </p>
          </div>
        </div>
        {podeEditar && modo === "nenhum" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo("arquivo")}
              className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-4 py-2 text-sm font-medium text-aura-gold hover:bg-aura-navy-900"
            >
              <Upload className="h-4 w-4" /> Enviar arquivo
            </button>
            <button
              type="button"
              onClick={() => setModo("texto")}
              className="flex items-center gap-2 rounded-full border border-aura-mist px-4 py-2 text-sm text-aura-graphite hover:bg-aura-bg"
            >
              <Type className="h-4 w-4" /> Colar texto
            </button>
          </div>
        )}
      </div>

      {modo !== "nenhum" && (
        <div className="space-y-3 border-b border-aura-mist bg-aura-bg/40 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-aura-graphite">
              Nome do material
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Manual de atendimento 2026"
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>
            <label className="text-sm text-aura-graphite">
              Para que serve (opcional)
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: regras de desconto e prazos"
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>
          </div>

          {modo === "arquivo" ? (
            <div>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,.json,.html"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setArquivo(f);
                    if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-aura-mist bg-white px-4 py-6 text-sm text-aura-graphite-soft hover:border-aura-petrol-500 hover:text-aura-graphite"
              >
                <Upload className="h-5 w-5" />
                {arquivo ? `${arquivo.name} (${tamanho(arquivo.size)})` : "Escolher arquivo — PDF, Word (.docx), texto ou markdown"}
              </button>
              <p className="mt-1 text-xs text-aura-graphite-soft">
                PDF que é digitalização (foto do papel) não tem texto para ler. Nesse caso, envie em Word ou texto.
              </p>
            </div>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="Cole aqui o conteúdo que a AURA deve seguir…"
              className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-5 py-2 text-sm font-medium text-aura-gold hover:bg-aura-navy-900 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar à biblioteca
            </button>
            <button type="button" onClick={limpar} className="rounded-full px-4 py-2 text-sm text-aura-graphite-soft hover:text-aura-graphite">
              Cancelar
            </button>

            {/*
              O material de treinamento é do grupo, não de uma operação. Sem
              esta caixa, cada documento tem de ser enviado quatro vezes, e
              quem esquece uma loja deixa a equipe dela com manual a menos —
              sem nenhuma tela que mostre a falta.
            */}
            <label className="ml-auto flex items-center gap-2 text-sm text-aura-graphite">
              <input
                type="checkbox"
                checked={todasAsLojas}
                onChange={(e) => setTodasAsLojas(e.target.checked)}
                className="h-4 w-4 rounded border-aura-mist"
              />
              Enviar para todas as lojas
            </label>
          </div>
        </div>
      )}

      {erro && (
        <p className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
        </p>
      )}
      {aviso && (
        <p className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="px-5 py-4">
        {carregando ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
          </div>
        ) : materiais.length === 0 ? (
          <p className="py-6 text-center text-sm text-aura-graphite-soft">
            Nenhum material ainda. Envie o manual de vendas para a AURA orientar a equipe com as regras da casa.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-aura-mist">
              {materiais.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  <FileText className={`mt-0.5 h-5 w-5 shrink-0 ${m.ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft/50"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${m.ativo ? "text-aura-graphite" : "text-aura-graphite-soft line-through"}`}>{m.titulo}</p>
                    {m.descricao && <p className="text-xs text-aura-graphite-soft">{m.descricao}</p>}
                    <p className="mt-0.5 text-xs text-aura-graphite-soft">
                      {m.arquivo_nome ? `${m.arquivo_nome} · ` : "Texto colado · "}
                      {m.caracteres.toLocaleString("pt-BR")} caracteres
                      {m.bytes ? ` · ${tamanho(m.bytes)}` : ""} ·{" "}
                      {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {podeEditar && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => alternar(m)}
                        title={m.ativo ? "Desativar (AURA para de usar)" : "Ativar"}
                        className={`rounded-full p-2 ${m.ativo ? "text-emerald-600 hover:bg-emerald-50" : "text-aura-graphite-soft hover:bg-aura-bg"}`}
                      >
                        {m.ativo ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(m)}
                        title="Excluir"
                        className="rounded-full p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-aura-graphite-soft">
              {ativos.length} material(is) ativo(s) — cerca de {totalPaginas} página(s) de conteúdo em uso pela AURA.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
