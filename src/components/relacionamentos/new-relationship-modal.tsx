"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CategoriaRelacionamento, TemperaturaRelacionamento } from "@/lib/types";
import { formatarTelefone } from "@/lib/format-phone";

const CATEGORIAS: CategoriaRelacionamento[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Distribuidor",
  "Outro",
];

const TEMPERATURAS: TemperaturaRelacionamento[] = ["quente", "ativo", "esfriando", "frio"];
const ORIGENS = ["Marketing", "Loja", "Prospecção", "Indicação", "Site", "WhatsApp", "Outro"];
export function NewRelationshipModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const { addRelacionamento } = useAppData();
  const { profile } = useUserProfile();
  const [userId, setUserId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaRelacionamento>("Cliente Final");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [origem, setOrigem] = useState("");
  const [temperatura, setTemperatura] = useState<TemperaturaRelacionamento>("ativo");  const [proximoContato, setProximoContato] = useState("a definir");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function obterUserId() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (user?.id) {
        setUserId(user.id);
      }
    }

    obterUserId();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !telefone.trim() || !cidade.trim() || !origem) {
      setErro("Nome, telefone, cidade e origem são obrigatórios.");
      return;
    }

    if (!userId) {
      setErro("Erro ao identificar usuário. Tente novamente.");
      return;
    }

    setSalvando(true);

    try {
      const novo = await addRelacionamento({
        vendedorId: userId,
        nome: nome.trim(),
        categoria,
        telefone: telefone.trim(),
        email: email.trim() || undefined,
        cidade: cidade.trim(),
        origem,
        temperatura,
        proximoContato,
      });

      if (novo) {
        onCriado(novo.id);
        onClose();
      } else {
        setErro("Erro ao salvar. Tente novamente.");
      }
    } catch (e) {
      setErro("Erro inesperado. Tente novamente.");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-aura-graphite">
            Novo Cliente/Relacionamento
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-aura-danger/10 p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-aura-danger" />
            <p className="text-sm text-aura-danger">{erro}</p>
          </div>
        )}

        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Nome *
            </label>
            <input
              type="text"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Telefone / WhatsApp *
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (opcional)"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Cidade *
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: São Paulo"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaRelacionamento)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              De onde veio este contato? *
            </label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              disabled={salvando}
            >
              <option value="">Selecione a origem</option>
              {ORIGENS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Temperatura
            </label>
            <select
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value as TemperaturaRelacionamento)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            >
              {TEMPERATURAS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Próximo Contato
            </label>
            <input
              type="text"
              value={proximoContato}
              onChange={(e) => setProximoContato(e.target.value)}
              placeholder="Ex: Segunda-feira às 10h"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20 disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <button
            type="submit"
            disabled={salvando || !nome.trim() || !telefone.trim() || !cidade.trim() || !origem}
            className="mt-2 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Salvando...
              </div>
            ) : (
              "Criar Cliente"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
