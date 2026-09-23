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
        <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-aura-graphite">
          Como você se chama?
        </label>
        <input
          id="nome"
          type="text"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome completo"
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-[0.95rem] text-aura-graphite outline-none transition placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-aura-graphite">Em qual loja você trabalha?</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {EMPRESAS.map((empresa) => {
            const ativo = empresaId === empresa.id;
            const Icon = empresa.tipo === "Fábrica" ? Factory : Store;
            return (
              <button
                key={empresa.id}
                type="button"
                onClick={() => setEmpresaId(empresa.id)}
                className={`relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                  ativo
                    ? "border-aura-petrol-700 bg-aura-petrol-700/5"
                    : "border-aura-mist bg-white hover:border-aura-petrol-500/50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    ativo ? "bg-aura-petrol-700 text-white" : "bg-aura-bg text-aura-graphite-soft"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-medium text-aura-graphite">{empresa.nome}</p>
                  <p className="text-xs text-aura-graphite-soft">{empresa.tipo}</p>
                </div>
                {ativo && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-aura-petrol-700 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-aura-graphite">Qual seu papel?</p>
        <div className="flex flex-col gap-2">
          {PAPEIS.map((opcao) => {
            const ativo = papel === opcao.valor;
            const Icon = opcao.icon;
            return (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setPapel(opcao.valor)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  ativo
                    ? "border-aura-petrol-700 bg-aura-petrol-700/5"
                    : "border-aura-mist bg-white hover:border-aura-petrol-500/50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    ativo ? "bg-aura-petrol-700 text-white" : "bg-aura-bg text-aura-graphite-soft"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aura-graphite">{opcao.valor}</p>
                  <p className="text-xs text-aura-graphite-soft">{opcao.descricao}</p>
                </div>
                {ativo && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-aura-warning/10 px-3 py-2 text-sm text-aura-warning">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={!podeContinuar || salvando}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-aura-petrol-700 px-4 py-3 text-[0.95rem] font-medium text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
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
