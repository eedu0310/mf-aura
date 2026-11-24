"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CategoriaRelacionamento, TemperaturaRelacionamento } from "@/lib/types";
import { formatarTelefone } from "@/lib/format-phone";
import { SeletorOrigem } from "@/components/origem/selo-origem";
import { INFO_ORIGEM, type OrigemLead } from "@/lib/origem-lead";
import { classeBotao } from "@/components/ui";

const CATEGORIAS: CategoriaRelacionamento[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Consultor",
  "Obra",
  "Distribuidor",
  "Outro",
];

const TEMPERATURAS: TemperaturaRelacionamento[] = ["quente", "ativo", "esfriando", "frio"];
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
  // Uma pergunta para o vendedor, duas colunas gravadas: origem_lead (enum,
  // usado nos relatórios) e origem (texto livre histórico, que outras telas
  // ainda leem). Guardar só o enum deixaria o campo antigo vazio.
  const [origemLead, setOrigemLead] = useState<OrigemLead | null>(null);
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);
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

    // Campanhas ativas da loja, para quem marcar origem "marketing" poder dizer
    // qual. É esse vínculo que permite medir depois quanto cada campanha custou
    // e quanto voltou; sem ele o marketing fica só com o total do balaio.
    async function obterCampanhas() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase
        .from("campanhas_marketing")
        .select("id, nome, status")
        .order("data_inicio", { ascending: false })
        .limit(50);
      if (data) {
        setCampanhas(
          data
            .filter((c) => (c.status ?? "").toLowerCase() !== "encerrada")
            .map((c) => ({ id: c.id as string, nome: c.nome as string })),
        );
      }
    }

    obterUserId();
    void obterCampanhas();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !telefone.trim() || !cidade.trim() || !origemLead) {
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
        origem: origemLead ? INFO_ORIGEM[origemLead].label : undefined,
        origemLead,
        campanhaId,
        temperatura,
        proximoContato,
      });

      if (novo) {
        onCriado(novo.id);
        onClose();
      } else {
        setErro("O contato não foi salvo e o sistema não disse por quê. Avise o gestor.");
      }
    } catch (e) {
      // A mensagem real. "Erro inesperado" não ajuda ninguém a resolver nada.
      setErro(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-base font-semibold text-aura-graphite">
            Novo Cliente/Relacionamento
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className={classeBotao("fantasma", "sm", "h-8 w-8 px-0")}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-aura-danger/25 bg-aura-danger/5 p-3" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-aura-danger" />
            <p className="text-sm text-aura-danger">{erro}</p>
          </div>
        )}

        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <label className="aura-label">
              Nome *
            </label>
            <input
              type="text"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="aura-input disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="aura-label">
              Telefone / WhatsApp *
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="aura-input disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="aura-label">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (opcional)"
              className="aura-input disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="aura-label">
              Cidade *
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: São Paulo"
              className="aura-input disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <div>
            <label className="aura-label">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaRelacionamento)}
              className="aura-input disabled:opacity-50"
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
            <SeletorOrigem
              valor={origemLead}
              onChange={setOrigemLead}
              campanhas={campanhas}
              campanhaId={campanhaId}
              onCampanhaChange={setCampanhaId}
            />
          </div>

          <div>
            <label className="aura-label">
              Temperatura
            </label>
            <select
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value as TemperaturaRelacionamento)}
              className="aura-input disabled:opacity-50"
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
            <label className="aura-label">
              Próximo Contato
            </label>
            <input
              type="text"
              value={proximoContato}
              onChange={(e) => setProximoContato(e.target.value)}
              placeholder="Ex: Segunda-feira às 10h"
              className="aura-input disabled:opacity-50"
              disabled={salvando}
            />
          </div>

          <button
            type="submit"
            disabled={salvando || !nome.trim() || !telefone.trim() || !cidade.trim() || !origemLead}
            className={classeBotao("primario", "lg", "mt-2 w-full")}
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
