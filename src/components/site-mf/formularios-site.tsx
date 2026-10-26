"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Loader2, Plus, Trash2, ArrowLeft, Check } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CAMPOS_PADRAO,
  EMPRESA_DO_SITE,
  ROTULO_DO_TIPO,
  TIPOS_DE_CAMPO,
  paraSlug,
  slugValido,
  type CampoFormulario,
  type Formulario,
  type TipoCampo,
} from "@/lib/site-mf/tipos";
import { FormularioPublico } from "./formulario-publico";
import { UploadArquivo } from "./upload-arquivo";

const entrada = "min-h-10 w-full rounded-xl border border-aura-mist bg-white px-3 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500";

function enderecoBase() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function FormulariosSite() {
  const [lista, setLista] = useState<Formulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Formulario | null>(null);

  const carregar = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { data } = await sb.from("site_formularios").select("*").order("created_at", { ascending: true });
    setLista((data ?? []) as Formulario[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (editando) {
    return (
      <EditorFormulario
        inicial={editando}
        onVoltar={async () => {
          setEditando(null);
          await carregar();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-aura-graphite-soft">
          Cada formulário pode ir numa LP daqui ou ser colado no site da MF. Quem preenche vira lead da MF.
        </p>
        <button
          type="button"
          onClick={() =>
            setEditando({
              id: "",
              empresa: EMPRESA_DO_SITE,
              nome: "Novo formulário",
              slug: "",
              titulo: "Fale com a MF",
              descricao: null,
              campos: CAMPOS_PADRAO,
              botao_texto: "Enviar",
              mensagem_sucesso: "Recebemos seus dados! Em breve a nossa equipe entra em contato.",
              material_nome: null,
              material_url: null,
              cor: "#CD1C1B",
              ativo: true,
            })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-aura-petrol-700 px-4 text-sm font-medium text-white hover:bg-aura-petrol-600"
        >
          <Plus size={16} /> Novo formulário
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-12 text-center text-sm text-aura-graphite-soft">
          Nenhum formulário ainda.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-aura-graphite">{f.nome}</p>
                <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${f.ativo ? "bg-emerald-100 text-emerald-900" : "bg-aura-mist text-aura-graphite-soft"}`}>
                  {f.ativo ? "Ativo" : "Desligado"}
                </span>
              </div>
              <p className="text-xs text-aura-graphite-soft">
                {f.campos.length} campos{f.material_url ? " · entrega material" : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(f)}
                  className="min-h-9 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
                >
                  Editar
                </button>
                <a
                  href={`/f/${f.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
                >
                  <ExternalLink size={13} /> Abrir
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorFormulario({ inicial, onVoltar }: { inicial: Formulario; onVoltar: () => void }) {
  const [f, setF] = useState<Formulario>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const novo = !f.id;

  function mudar<K extends keyof Formulario>(k: K, v: Formulario[K]) {
    setF((x) => ({ ...x, [k]: v }));
    setSalvo(false);
  }
  function mudarCampo(i: number, patch: Partial<CampoFormulario>) {
    mudar(
      "campos",
      f.campos.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );
  }
  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= f.campos.length) return;
    const c = [...f.campos];
    [c[i], c[j]] = [c[j], c[i]];
    mudar("campos", c);
  }

  async function salvar() {
    setErro(null);
    const slug = f.slug || paraSlug(f.nome);
    if (!f.nome.trim()) return setErro("Dê um nome ao formulário.");
    if (!slugValido(slug)) return setErro("O endereço precisa ter só letras minúsculas, números e hífen.");
    if (!f.campos.length) return setErro("Coloque pelo menos um campo.");
    if (!f.campos.some((c) => c.tipo === "telefone" || c.tipo === "email")) {
      return setErro("Coloque um campo de WhatsApp ou de e-mail: sem ele, ninguém consegue responder o lead.");
    }
    const chaves = new Set<string>();
    for (const c of f.campos) {
      if (!c.rotulo.trim()) return setErro("Todo campo precisa de um nome.");
      if (chaves.has(c.chave)) return setErro(`Dois campos com o mesmo nome interno (${c.chave}).`);
      chaves.add(c.chave);
      if (c.tipo === "selecao" && !(c.opcoes ?? []).filter(Boolean).length) return setErro(`"${c.rotulo}" precisa de opções.`);
    }
    setSalvando(true);
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const linha = {
      empresa: f.empresa || EMPRESA_DO_SITE,
      nome: f.nome.trim(),
      slug,
      titulo: f.titulo?.trim() || null,
      descricao: f.descricao?.trim() || null,
      campos: f.campos.map((c) => ({ ...c, opcoes: c.tipo === "selecao" ? (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean) : undefined })),
      botao_texto: f.botao_texto.trim() || "Enviar",
      mensagem_sucesso: f.mensagem_sucesso.trim() || "Recebemos seus dados!",
      material_nome: f.material_nome?.trim() || null,
      material_url: f.material_url?.trim() || null,
      cor: /^#[0-9A-Fa-f]{6}$/.test(f.cor) ? f.cor : "#CD1C1B",
      ativo: f.ativo,
      updated_at: new Date().toISOString(),
    };
    const r = novo
      ? await sb.from("site_formularios").insert(linha).select("*").single()
      : await sb.from("site_formularios").update(linha).eq("id", f.id).select("*").single();
    setSalvando(false);
    if (r.error || !r.data) {
      setErro(r.error?.code === "23505" ? "Já existe um formulário com esse endereço. Troque o endereço." : r.error?.message || "Não consegui salvar.");
      return;
    }
    setF(r.data as Formulario);
    setSalvo(true);
  }

  async function apagar() {
    if (!f.id) return onVoltar();
    if (!confirm(`Apagar o formulário "${f.nome}"? As LPs que usam ele ficam sem formulário. Os leads que já chegaram continuam.`)) return;
    const sb = getSupabaseBrowserClient();
    await sb?.from("site_formularios").delete().eq("id", f.id);
    onVoltar();
  }

  const codigo = `<iframe src="${enderecoBase()}/f/${f.slug || paraSlug(f.nome)}" style="width:100%;max-width:520px;height:720px;border:0" title="${f.nome}"></iframe>`;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onVoltar} className="inline-flex w-fit items-center gap-1.5 text-sm text-aura-graphite-soft hover:text-aura-graphite">
        <ArrowLeft size={15} /> Formulários
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-aura-mist bg-white p-5">
            <p className="font-medium text-aura-graphite">Geral</p>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Nome (só para a equipe)
              <input className={entrada} value={f.nome} onChange={(e) => mudar("nome", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Endereço
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-aura-graphite-soft">/f/</span>
                <input
                  className={entrada}
                  value={f.slug}
                  placeholder={paraSlug(f.nome)}
                  onChange={(e) => mudar("slug", paraSlug(e.target.value))}
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Título que o cliente vê
              <input className={entrada} value={f.titulo ?? ""} onChange={(e) => mudar("titulo", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Texto de apoio
              <input className={entrada} value={f.descricao ?? ""} onChange={(e) => mudar("descricao", e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Texto do botão
                <input className={entrada} value={f.botao_texto} onChange={(e) => mudar("botao_texto", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Cor do botão
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Cor do botão" value={f.cor} onChange={(e) => mudar("cor", e.target.value.toUpperCase())} className="h-10 w-12 rounded-lg border border-aura-mist" />
                  <input className={entrada} value={f.cor} onChange={(e) => mudar("cor", e.target.value)} />
                </div>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-aura-graphite">
              <input type="checkbox" checked={f.ativo} onChange={(e) => mudar("ativo", e.target.checked)} /> Formulário ligado
            </label>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-aura-graphite">Campos</p>
              <button
                type="button"
                onClick={() =>
                  mudar("campos", [
                    ...f.campos,
                    { chave: `campo_${f.campos.length + 1}_${Math.random().toString(36).slice(2, 5)}`, rotulo: "Novo campo", tipo: "texto", obrigatorio: false },
                  ])
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
              >
                <Plus size={14} /> Campo
              </button>
            </div>
            {f.campos.map((c, i) => (
              <div key={c.chave} className="flex flex-col gap-2 rounded-xl border border-aura-mist p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
                  <input aria-label="Nome do campo" className={entrada} value={c.rotulo} onChange={(e) => mudarCampo(i, { rotulo: e.target.value })} />
                  <select aria-label="Tipo do campo" className={entrada} value={c.tipo} onChange={(e) => mudarCampo(i, { tipo: e.target.value as TipoCampo })}>
                    {TIPOS_DE_CAMPO.map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_DO_TIPO[t]}
                      </option>
                    ))}
                  </select>
                </div>
                {c.tipo === "selecao" && (
                  <input
                    aria-label="Opções, separadas por vírgula"
                    className={entrada}
                    placeholder="Opções separadas por vírgula"
                    value={(c.opcoes ?? []).join(", ")}
                    onChange={(e) => mudarCampo(i, { opcoes: e.target.value.split(",").map((o) => o.trimStart()) })}
                  />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-aura-graphite">
                    <input type="checkbox" checked={c.obrigatorio} onChange={(e) => mudarCampo(i, { obrigatorio: e.target.checked })} /> Obrigatório
                  </label>
                  <div className="ml-auto flex gap-1">
                    <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" aria-label="Descer" onClick={() => mover(i, 1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Tirar campo"
                      onClick={() => mudar("campos", f.campos.filter((_, j) => j !== i))}
                      className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-aura-mist bg-white p-5">
            <p className="font-medium text-aura-graphite">Depois de enviar</p>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Mensagem para o cliente
              <textarea rows={2} className={`${entrada} py-2`} value={f.mensagem_sucesso} onChange={(e) => mudar("mensagem_sucesso", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Material que ele recebe (nome do botão)
              <input className={entrada} placeholder="Ex.: Baixar o catálogo" value={f.material_nome ?? ""} onChange={(e) => mudar("material_nome", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-aura-graphite">
              Link do material (PDF, Drive, realidade aumentada…)
              <input className={entrada} placeholder="https://" value={f.material_url ?? ""} onChange={(e) => mudar("material_url", e.target.value)} />
            </label>
            <UploadArquivo rotulo="Subir PDF do material" aceita="application/pdf" onPronto={(url) => mudar("material_url", url)} />
          </section>

          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aura-petrol-700 px-5 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : salvo ? <Check size={16} /> : null} {salvo ? "Salvo" : "Salvar"}
            </button>
            <button type="button" onClick={() => void apagar()} className="min-h-11 rounded-full border border-aura-mist px-4 text-sm font-medium text-red-700 hover:border-red-300">
              {novo ? "Descartar" : "Apagar"}
            </button>
          </div>

          {!novo && (
            <section className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-5">
              <p className="font-medium text-aura-graphite">Colar no site da MF</p>
              <p className="text-xs text-aura-graphite-soft">No Elementor, use um widget HTML e cole:</p>
              <pre className="whitespace-pre-wrap break-all rounded-xl bg-aura-navy-950 p-3 text-xs text-white/85">{codigo}</pre>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(codigo);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite"
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar código"}
              </button>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-aura-graphite-soft">Como o cliente vê</p>
          <div className="rounded-2xl bg-aura-mist/60 p-4">
            <FormularioPublico
              slug={f.slug || "previa"}
              titulo={f.titulo}
              descricao={f.descricao}
              campos={f.campos}
              botao={f.botao_texto}
              cor={/^#[0-9A-Fa-f]{6}$/.test(f.cor) ? f.cor : "#CD1C1B"}
              previa
            />
          </div>
        </div>
      </div>
    </div>
  );
}
