"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, AlertCircle, CheckCircle2, RefreshCw, Link2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";

interface Documento {
  id: string;
  nome: string;
  status: string;
}

export function DocumentUploader() {
  const { profile } = useUserProfile();
  const ehGestor = profile.cargo === "Gestor";
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemLista, setMensagemLista] = useState<string | null>(null);
  const [mostrarCampoLink, setMostrarCampoLink] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [todasLojas, setTodasLojas] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregarDocumentos() {
    setCarregando(true);
    setMensagemLista(null);
    try {
      const resp = await fetch("/api/knowledge/files");
      const dados = await resp.json();
      setDocumentos(dados.arquivos ?? []);
      if ((dados.arquivos ?? []).length === 0 && dados.mensagem) {
        setMensagemLista(dados.mensagem);
      }
    } catch {
      setMensagemLista("Não consegui consultar a lista agora. Tente atualizar.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDocumentos();
  }, []);

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      if (todasLojas) formData.append("todasLojas", "1");

      const resp = await fetch("/api/knowledge/upload", { method: "POST", body: formData });
      const dados = await resp.json();

      if (!resp.ok) {
        setErro(dados.erro ?? "Não consegui enviar esse arquivo.");
      } else {
        await carregarDocumentos();
      }
    } catch {
      setErro("Não consegui enviar esse arquivo. Tente novamente.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setErro(null);
    setEnviando(true);

    try {
      const resp = await fetch("/api/knowledge/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkInput.trim(), todasLojas }),
      });
      const dados = await resp.json();

      if (!resp.ok) {
        setErro(dados.erro ?? "Não consegui processar esse link.");
      } else {
        setLinkInput("");
        setMostrarCampoLink(false);
        await carregarDocumentos();
      }
    } catch {
      setErro("Não consegui processar esse link. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function removerDocumento(id: string) {
    if (!confirm("Remover este documento da base de conhecimento?")) return;

    setDocumentos((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch("/api/knowledge/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
    } catch {
      carregarDocumentos(); // reverte se falhar
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Documentos de vendas (PDF, Word, TXT, ou link)</p>
        </div>
        <button
          type="button"
          onClick={carregarDocumentos}
          disabled={carregando}
          aria-label="Atualizar lista"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Envie manuais, catálogos, scripts, apresentações — ou cole um link público (catálogo
        online, PDF hospedado, planilha publicada na web). A AURA Coach busca automaticamente
        os trechos relevantes ao responder — precisa da OpenAI e do Supabase configurados.
      </p>

      {erro && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-aura-danger/10 px-3 py-2 text-xs text-aura-danger">
          <AlertCircle size={12} />
          {erro}
        </p>
      )}

      {ehGestor && (
        <label className="mt-3 flex items-center gap-2 text-xs text-aura-graphite-soft">
          <input
            type="checkbox"
            checked={todasLojas}
            onChange={(e) => setTodasLojas(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-aura-mist text-aura-petrol-700"
          />
          Aplicar às 4 lojas do grupo (MF, LF Lareiras, A&amp;G, Sole) de uma vez
        </label>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-aura-mist py-3 text-sm font-medium text-aura-graphite hover:bg-aura-bg">
          {enviando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Upload size={15} />
              Arquivo
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={enviarArquivo}
            disabled={enviando}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={() => setMostrarCampoLink((v) => !v)}
          disabled={enviando}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-aura-mist py-3 text-sm font-medium text-aura-graphite hover:bg-aura-bg"
        >
          <Link2 size={15} />
          Link
        </button>
      </div>

      {mostrarCampoLink && (
        <form onSubmit={enviarLink} className="mt-2 flex gap-2">
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://... (link público do catálogo, PDF, planilha)"
            className="flex-1 rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
          />
          <button
            type="submit"
            disabled={enviando || !linkInput.trim()}
            className="rounded-xl bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {enviando ? "..." : "Adicionar"}
          </button>
        </form>
      )}

      <div className="mt-4">
        {carregando ? (
          <p className="text-center text-xs text-aura-graphite-soft">Carregando documentos...</p>
        ) : documentos.length === 0 ? (
          <p className="text-center text-xs text-aura-graphite-soft">
            {mensagemLista ?? "Nenhum documento enviado ainda."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-aura-mist">
            {documentos.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  {doc.status === "completed" ? (
                    <CheckCircle2 size={14} className="shrink-0 text-aura-success" />
                  ) : (
                    <Loader2 size={14} className="shrink-0 animate-spin text-aura-graphite-soft" />
                  )}
                  <span className="truncate text-sm text-aura-graphite">{doc.nome}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removerDocumento(doc.id)}
                  aria-label="Remover documento"
                  className="shrink-0 text-aura-graphite-soft hover:text-aura-danger"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
