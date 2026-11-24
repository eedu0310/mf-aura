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
import { Alerta, EstadoVazio, classeBotao } from "@/components/ui";

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
    <section className="aura-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-mist px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-gold/15">
            <BookOpen size={16} className="text-aura-gold-700" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-aura-graphite">Materiais que a AURA estuda</h3>
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
              className={classeBotao("primario", "sm")}
            >
              <Upload size={13} /> Enviar arquivo
            </button>
            <button
              type="button"
              onClick={() => setModo("texto")}
              className={classeBotao("secundario", "sm")}
            >
              <Type size={13} /> Colar texto
            </button>
          </div>
        )}
      </div>

      {modo !== "nenhum" && (
        <div className="space-y-3 border-b border-aura-mist bg-aura-sunken/50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[0.8125rem] font-medium text-aura-graphite">
              Nome do material
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Manual de atendimento 2026"
                className="aura-input mt-1.5 font-normal"
              />
            </label>
            <label className="text-[0.8125rem] font-medium text-aura-graphite">
              Para que serve (opcional)
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: regras de desconto e prazos"
                className="aura-input mt-1.5 font-normal"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-aura-mist bg-aura-surface px-4 py-6 text-sm text-aura-graphite-soft transition hover:border-aura-petrol-500 hover:text-aura-graphite"
              >
                <Upload size={17} />
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
              className="aura-input"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className={classeBotao("primario")}
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Adicionar à biblioteca
            </button>
            <button type="button" onClick={limpar} className={classeBotao("fantasma")}>
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
                className="h-4 w-4 rounded border-aura-mist accent-aura-petrol-600"
              />
              Enviar para todas as lojas
            </label>
          </div>
        </div>
      )}

      {erro && <Alerta tom="perigo" icone={AlertCircle} titulo={erro} className="mx-5 mt-4 shadow-none" />}
      {aviso && <Alerta tom="atencao" icone={AlertCircle} titulo={aviso} className="mx-5 mt-4 shadow-none" />}

      <div className="px-5 py-4">
        {carregando ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-aura-graphite-soft" />
          </div>
        ) : materiais.length === 0 ? (
          <EstadoVazio
            icone={BookOpen}
            titulo="Nenhum material ainda."
            descricao="Envie o manual de vendas para a AURA orientar a equipe com as regras da casa."
          />
        ) : (
          <>
            <ul className="divide-y divide-aura-mist">
              {materiais.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
                    <FileText size={15} className={m.ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft/50"} />
                  </span>
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
                        className={`rounded-lg p-1.5 transition hover:bg-aura-sunken ${m.ativo ? "text-aura-success" : "text-aura-graphite-soft"}`}
                      >
                        {m.ativo ? <Check size={15} /> : <X size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(m)}
                        title="Excluir"
                        className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                      >
                        <Trash2 size={15} />
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
