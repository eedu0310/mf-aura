"use client";

import { useEffect, useRef, useState } from "react";
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
  const { setProfile, profile, isOnboarded, carregando } = useUserProfile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const jaRedirecionou = useRef(false);

  // O proxy manda para cá com ?bloqueado=1 quando a conta foi desativada.
  useEffect(() => {
    setBloqueado(new URLSearchParams(window.location.search).has("bloqueado"));
  }, []);

  /**
   * QUEM JÁ ESTÁ LOGADO NÃO PRECISA VER O LOGIN.
   *
   * O app instalado no celular abre em "/" (start_url do manifest), que manda
   * para cá — e o formulário aparecia toda vez, com a sessão viva, pedindo a
   * senha de novo. Agora, com sessão e cadastro completo, segue direto para a
   * tela inicial do cargo.
   *
   * Não segue quando a URL traz ?voltar= ou ?bloqueado=: nesses casos foi o
   * proxy (que confere a sessão no servidor) quem mandou para cá, então a
   * sessão que o navegador guarda não vale mais. Seguir dali faria o proxy
   * devolver para o login, e de novo, em círculo.
   */
  useEffect(() => {
    if (carregando || !isOnboarded || isSubmitting || jaRedirecionou.current) return;
    const busca = new URLSearchParams(window.location.search);
    if (busca.has("voltar") || busca.has("bloqueado")) return;
    jaRedirecionou.current = true;
    router.replace(rotaInicial(profile.cargo));
  }, [carregando, isOnboarded, isSubmitting, profile.cargo, router]);

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

    const { data, error: erroLogin } = await supabase.auth.signInWithPassword({ email, password });

    if (erroLogin || !data.user) {
      setIsSubmitting(false);
      if (erroLogin) setError(traduzirErro(erroLogin.message));
      return;
    }

    const { data: perfilSalvo } = await supabase
      .from("profiles")
      .select("nome, empresa, cargo")
      .eq("id", data.user.id)
      .single();

    // O botão segue "Entrando..." até a troca de tela: liberar antes deixava
    // um segundo clique disparar outro login no meio da navegação.
    if (perfilSalvo) {
      setProfile(perfilSalvo.nome, perfilSalvo.empresa, perfilSalvo.cargo);
      router.push(destinoDepoisDoLogin() ?? rotaInicial(perfilSalvo.cargo));
    } else {
      router.push("/onboarding");
    }
  }

  /**
   * O proxy manda quem abriu um link sem sessão (aviso do sino, link do
   * WhatsApp, /relacionamentos?id=…) para /login?voltar=<caminho>, mas o
   * login ignorava isso e sempre abria a tela inicial: a pessoa entrava e
   * perdia o cliente que tinha ido ver. Só aceita caminho interno ("/x", nunca
   * "//site" nem "/login"); se o cargo não puder abrir a tela, o RoleGuard
   * dela manda para a tela inicial do cargo, como sempre.
   */
  function destinoDepoisDoLogin(): string | null {
    const voltar = new URLSearchParams(window.location.search).get("voltar");
    if (!voltar || !voltar.startsWith("/") || voltar.startsWith("//") || voltar.includes("\\")) return null;
    if (voltar === "/" || voltar.startsWith("/login") || voltar.startsWith("/onboarding")) return null;
    return voltar;
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
        <label htmlFor="email" className="aura-label mb-0">
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
          className="aura-input h-11 px-3.5 text-[0.95rem]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="aura-label mb-0">
            Senha
          </label>
          <button
            type="button"
            onClick={esqueciSenha}
            className="text-xs font-medium text-aura-petrol-600 underline-offset-2 hover:underline"
          >
            Esqueceu a senha?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={supabase ? 6 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="aura-input h-11 px-3.5 pr-11 text-[0.95rem]"
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
        <p className="rounded-lg border border-aura-success/25 bg-aura-success/10 px-3 py-2 text-sm text-aura-success">
          {supabase
            ? `Se existir uma conta com o e-mail ${email}, enviamos instruções de recuperação.`
            : `Enviamos instruções de recuperação para ${email}. (simulado — configure o Supabase para envio real)`}
        </p>
      )}

      {bloqueado && !error && (
        <p role="alert" className="rounded-lg border border-aura-warning/30 bg-aura-warning/10 px-3 py-2 text-sm text-aura-gold-700">
          Seu acesso foi desativado pelo gestor. Fale com ele para voltar a entrar.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-aura-warning/30 bg-aura-warning/10 px-3 py-2 text-sm text-aura-gold-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="aura-btn aura-btn-primario aura-btn-lg mt-1 w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <ArrowRight size={18} />
          </>
        )}
      </button>

      {/*
        O cadastro aberto saiu daqui. Qualquer pessoa com o endereço criava
        conta, escolhia uma das quatro lojas e até o cargo "Gestor" no
        onboarding — foi assim que duas contas sem perfil entraram. O RLS
        segurava os dados (gestor novo nasce com gestor_aprovado = false), mas
        conta de estranho em CRM da empresa não se cria sozinha. Quem entra
        agora é cadastrado pelo gestor na aba Usuários, que usa
        /api/admin/criar-usuario.
      */}
      <p className="text-center text-xs text-aura-graphite-soft">
        Acesso restrito a colaboradores do Grupo MF. Para liberar um acesso novo,
        fale com o gestor da sua loja.
      </p>
    </form>
  );
}
