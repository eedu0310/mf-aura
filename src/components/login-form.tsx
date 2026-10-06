"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { rotaInicial } from "@/lib/rota-inicial";

function traduzirErro(mensagem: string) {
  if (mensagem.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos. Se ainda não tem conta, use \"Criar conta\".";
  }
  if (mensagem.includes("User already registered")) {
    return "Já existe uma conta com este e-mail. Tente entrar em vez de criar conta.";
  }
  if (mensagem.includes("Password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (mensagem.includes("Unable to validate email")) {
    return "E-mail inválido.";
  }
  return mensagem;
}

export function LoginForm() {
  const router = useRouter();
  const { setProfile } = useUserProfile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false);
  const [modoCadastro, setModoCadastro] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  // O proxy manda para cá com ?bloqueado=1 quando a conta foi desativada.
  useEffect(() => {
    setBloqueado(new URLSearchParams(window.location.search).has("bloqueado"));
  }, []);

  const supabase = getSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!supabase) {
      setError("O banco de dados não está configurado. Configure o Supabase antes de entrar.");
      setIsSubmitting(false);
      return;
    }

    if (modoCadastro) {
      const { data, error: erroCadastro } = await supabase.auth.signUp({ email, password });
      setIsSubmitting(false);

      if (erroCadastro) {
        setError(traduzirErro(erroCadastro.message));
        return;
      }

      if (data.user) {
        router.push("/onboarding");
      }
      return;
    }

    const { data, error: erroLogin } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (erroLogin) {
      setError(traduzirErro(erroLogin.message));
      return;
    }

    if (!data.user) return;

    const { data: perfilSalvo } = await supabase
      .from("profiles")
      .select("nome, empresa, cargo")
      .eq("id", data.user.id)
      .single();

    if (perfilSalvo) {
      setProfile(perfilSalvo.nome, perfilSalvo.empresa, perfilSalvo.cargo);
      router.push(rotaInicial(perfilSalvo.cargo));
    } else {
      router.push("/onboarding");
    }
  }

  async function esqueciSenha(e: React.MouseEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Digite seu e-mail acima para recuperar a senha.");
      return;
    }
    setError(null);

    if (supabase) {
      // O redirectTo é obrigatório na prática: sem ele o Supabase devolve a
      // pessoa para a Site URL do projeto (a raiz do CRM), onde não há nada
      // esperando o token — e o link "não dá nada". Com ele, o link cai na
      // tela que troca a senha de verdade.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
    }
    setRecuperacaoEnviada(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-aura-graphite">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seunome@grupomf.com.br"
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-[0.95rem] text-aura-graphite placeholder:text-aura-graphite-soft/60 outline-none transition focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-aura-graphite">
            Senha
          </label>
          {!modoCadastro && (
            <button
              type="button"
              onClick={esqueciSenha}
              className="text-xs font-medium text-aura-petrol-600 hover:text-aura-petrol-700 hover:underline underline-offset-2"
            >
              Esqueceu a senha?
            </button>
          )}
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={modoCadastro ? "new-password" : "current-password"}
            required
            minLength={supabase ? 6 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 pr-11 text-[0.95rem] text-aura-graphite placeholder:text-aura-graphite-soft/60 outline-none transition focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft hover:text-aura-graphite"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {recuperacaoEnviada && (
        <p className="rounded-lg bg-aura-success/10 px-3 py-2 text-sm text-aura-success">
          {supabase
            ? `Se existir uma conta com o e-mail ${email}, enviamos instruções de recuperação.`
            : `Enviamos instruções de recuperação para ${email}. (simulado — configure o Supabase para envio real)`}
        </p>
      )}

      {bloqueado && !error && (
        <p role="alert" className="rounded-lg bg-aura-warning/10 px-3 py-2 text-sm text-aura-warning">
          Seu acesso foi desativado pelo gestor. Fale com ele para voltar a entrar.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-aura-warning/10 px-3 py-2 text-sm text-aura-warning">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-aura-petrol-700 px-4 py-3 text-[0.95rem] font-medium text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {modoCadastro ? "Criando conta..." : "Entrando..."}
          </>
        ) : (
          <>
            {modoCadastro ? "Criar conta" : "Entrar"}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      {supabase ? (
        <button
          type="button"
          onClick={() => {
            setModoCadastro((v) => !v);
            setError(null);
            setRecuperacaoEnviada(false);
          }}
          className="text-center text-xs font-medium text-aura-petrol-600 hover:underline"
        >
          {modoCadastro ? "Já tenho conta — entrar" : "Ainda não tenho conta — criar"}
        </button>
      ) : (
        <p className="text-center text-xs text-aura-graphite-soft">
          Acesso restrito a colaboradores do Grupo MF.
        </p>
      )}
    </form>
  );
}
