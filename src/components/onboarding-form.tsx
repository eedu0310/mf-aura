"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Factory, Store, Check, Loader2, Users, Briefcase, Building2, Wrench, UserPlus, Filter, Megaphone } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { EMPRESAS } from "@/lib/companies";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { rotaInicial } from "@/lib/rota-inicial";

const PAPEIS = [
  { valor: "Vendedor", descricao: "Carteira própria, agenda de visitas e metas", icon: Users },
  { valor: "Vendedor Interno", descricao: "Recebe leads, atendimento e orçamentos", icon: UserPlus },
  { valor: "SDR", descricao: "Pré-qualifica e distribui os leads que chegam", icon: Filter },
  { valor: "Marketing", descricao: "Postagens, calendário e leads gerados", icon: Megaphone },
  { valor: "Gestor", descricao: "Vê a equipe e todas as lojas do grupo", icon: Briefcase },
  { valor: "Pós-venda", descricao: "Acompanha instalação e satisfação do cliente", icon: Wrench },
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const { setProfile } = useUserProfile();
  const [nome, setNome] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [papel, setPapel] = useState<(typeof PAPEIS)[number]["valor"]>("Vendedor");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeContinuar = nome.trim().length >= 2 && empresaId;

  async function concluir(e: React.FormEvent) {
    e.preventDefault();
    if (!podeContinuar) return;
    const empresa = EMPRESAS.find((e) => e.id === empresaId)!;

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setErro("O banco de dados não está configurado. Configure o Supabase antes de entrar no sistema.");
      return;
    }

    setSalvando(true);
    setErro(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Sua sessão expirou. Faça login novamente.");
      setSalvando(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nome: nome.trim(),
          empresa: empresa.nome,
          cargo: papel,
        },
        { onConflict: "id" }
      );

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar cadastro:", error);
      setErro(`Não consegui salvar seu cadastro. (${error.message})`);
      return;
    }

    setProfile(nome, empresa.nome, papel);
    router.push(rotaInicial(papel));
  }

  return (
    <form onSubmit={concluir} className="flex flex-col gap-6">
      <div>
        <label htmlFor="nome" className="aura-label">
          Como você se chama?
        </label>
        <input
          id="nome"
          type="text"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome completo"
          className="aura-input h-11 px-3.5 text-[0.95rem]"
        />
      </div>

      <div>
        <p className="aura-label mb-2">Em qual loja você trabalha?</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {EMPRESAS.map((empresa) => {
            const ativo = empresaId === empresa.id;
            const Icon = empresa.tipo === "Fábrica" ? Factory : Store;
            return (
              <button
                key={empresa.id}
                type="button"
                onClick={() => setEmpresaId(empresa.id)}
                className={`relative flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                  ativo
                    ? "border-aura-petrol-500 bg-aura-petrol-500/[0.06] ring-1 ring-aura-petrol-500/30"
                    : "border-aura-mist bg-aura-surface hover:bg-aura-sunken/60"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    ativo ? "bg-aura-petrol-500/12 text-aura-petrol-600" : "bg-aura-sunken text-aura-graphite-soft"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-medium text-aura-graphite">{empresa.nome}</p>
                  <p className="text-xs text-aura-graphite-soft">{empresa.tipo}</p>
                </div>
                {ativo && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-aura-petrol-600 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="aura-label mb-2">Qual seu papel?</p>
        <div className="flex flex-col gap-2">
          {PAPEIS.map((opcao) => {
            const ativo = papel === opcao.valor;
            const Icon = opcao.icon;
            return (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setPapel(opcao.valor)}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                  ativo
                    ? "border-aura-petrol-500 bg-aura-petrol-500/[0.06] ring-1 ring-aura-petrol-500/30"
                    : "border-aura-mist bg-aura-surface hover:bg-aura-sunken/60"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    ativo ? "bg-aura-petrol-500/12 text-aura-petrol-600" : "bg-aura-sunken text-aura-graphite-soft"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aura-graphite">{opcao.valor}</p>
                  <p className="text-xs text-aura-graphite-soft">{opcao.descricao}</p>
                </div>
                {ativo && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aura-petrol-600 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-aura-warning/30 bg-aura-warning/10 px-3 py-2 text-sm text-aura-gold-700">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={!podeContinuar || salvando}
        className="aura-btn aura-btn-primario aura-btn-lg mt-1 w-full"
      >
        {salvando ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            Entrar na AURA
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
}
