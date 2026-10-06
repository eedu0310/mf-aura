"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Troca a senha de quem chegou pelo link do e-mail.
 *
 * O LINK PODE CHEGAR DE QUATRO FORMAS DIFERENTES, e é por isso que este
 * componente parece ter mais código do que "só trocar a senha". O Supabase
 * mudou o formato do link ao longo das versões e o formato depende de qual
 * template de e-mail o projeto está usando:
 *
 *   ?code=...                        fluxo PKCE (o padrão do @supabase/ssr)
 *   ?token_hash=...&type=recovery    template novo; funciona em qualquer navegador
 *   #access_token=...&refresh_token= fluxo antigo, token no fragmento
 *   nada na URL                      o próprio cliente já consumiu o token
 *
 * Tratar só uma delas é o que faz o link "não dar nada" — que é exatamente o
 * sintoma que trouxe esta tela a existir. Então tentamos as quatro, na ordem
 * que custa menos, e só desistimos depois de todas.
 *
 * O FLUXO PKCE TEM UMA PEGADINHA: ele guarda um segredo no navegador que pediu
 * a recuperação. Se a pessoa pede no computador e abre o link no celular, a
 * troca falha — e a mensagem precisa dizer isso, porque "link inválido" faria
 * a pessoa tentar de novo no celular para sempre.
 */
export function RedefinirSenhaForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [verificando, setVerificando] = useState(true);
  const [liberado, setLiberado] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setErro("Supabase não configurado neste ambiente.");
      setVerificando(false);
      return;
    }

    let cancelado = false;

    type Resultado = { ok: true } | { ok: false; mensagem: string };

    async function abrirSessaoDeRecuperacao(): Promise<Resultado> {
      const busca = new URLSearchParams(window.location.search);
      // O fragmento começa com "#": tirar o primeiro caractere antes de ler.
      const fragmento = new URLSearchParams(window.location.hash.slice(1));

      // O Supabase avisa o motivo quando o link já venceu ou já foi usado.
      // Mostrar o motivo dele é melhor do que inventar um nosso.
      const descricao =
        busca.get("error_description") ?? fragmento.get("error_description");
      const codigoErro = busca.get("error_code") ?? fragmento.get("error_code");
      if (descricao || codigoErro) {
        const venceu = /expired|invalid/i.test(`${descricao} ${codigoErro}`);
        return {
          ok: false,
          mensagem: venceu
            ? "Este link já venceu ou já foi usado. Peça um novo na tela de entrar."
            : decodeURIComponent(descricao ?? "Não foi possível validar o link."),
        };
      }

      // 1. Template novo: funciona mesmo em outro navegador ou celular.
      const tokenHash = busca.get("token_hash") ?? fragmento.get("token_hash");
      if (tokenHash) {
        const { error } = await supabase!.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (!error) return { ok: true };
        return {
          ok: false,
          mensagem: "Este link já venceu ou já foi usado. Peça um novo na tela de entrar.",
        };
      }

      // 2. Fluxo PKCE, o padrão de hoje.
      const code = busca.get("code");
      if (code) {
        const { error } = await supabase!.auth.exchangeCodeForSession(code);
        if (!error) return { ok: true };
        return {
          ok: false,
          mensagem:
            "Não consegui validar o link neste navegador. O link precisa ser aberto no mesmo navegador onde você pediu a recuperação — se você pediu no computador, abra o link no computador.",
        };
      }

      // 3. Fluxo antigo: os tokens vêm no fragmento da URL.
      const accessToken = fragmento.get("access_token");
      const refreshToken = fragmento.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase!.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) return { ok: true };
        return {
          ok: false,
          mensagem: "Este link já venceu ou já foi usado. Peça um novo na tela de entrar.",
        };
      }

      // 4. Nada na URL. Pode ser que o próprio cliente já tenha consumido o
      //    token (ele faz isso sozinho ao carregar) — então basta haver
      //    sessão. É também o caso de quem está logado e só quer trocar a
      //    senha, e isso é legítimo.
      const { data } = await supabase!.auth.getSession();
      if (data.session) return { ok: true };

      return {
        ok: false,
        mensagem:
          "Abra esta tela pelo link que chegou no seu e-mail. Se você já tentou e não funcionou, peça um novo link na tela de entrar.",
      };
    }

    abrirSessaoDeRecuperacao()
      .then(async (r) => {
        if (cancelado) return;
        if (r.ok) {
          setLiberado(true);
          const { data } = await supabase!.auth.getUser();
          if (!cancelado) setEmail(data.user?.email ? data.user.email : null);
          // Limpa o token da barra de endereços: ele não precisa mais estar
          // ali, e URL com token é o tipo de coisa que acaba colada num
          // WhatsApp sem a pessoa perceber.
          window.history.replaceState({}, "", window.location.pathname);
        } else {
          setErro(r.mensagem);
        }
      })
      .finally(() => {
        if (!cancelado) setVerificando(false);
      });

    return () => {
      cancelado = true;
    };
    // supabase é singleton; rodar uma vez é de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase!.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(
        /same|different from the old/i.test(error.message)
          ? "Esta é a sua senha atual. Escolha uma senha diferente."
          : error.message,
      );
      return;
    }

    setPronto(true);
    // Sai da sessão de recuperação e manda entrar com a senha nova: é o que
    // confirma para a pessoa que a senha realmente funciona.
    await supabase!.auth.signOut();
    setTimeout(() => router.push("/login"), 2200);
  }

  if (verificando) {
    return (
      <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
        Validando o link...
      </p>
    );
  }

  if (pronto) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 rounded-lg bg-aura-success/10 px-3 py-2.5 text-sm text-aura-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Senha trocada. Levando você para a tela de entrar...
        </p>
      </div>
    );
  }

  if (!liberado) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-aura-danger/10 px-3 py-2.5 text-sm leading-relaxed text-aura-danger">
          {erro}
        </p>
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-xl bg-aura-petrol-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-aura-petrol-600"
        >
          Voltar para a tela de entrar
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      {email && (
        <p className="rounded-lg bg-aura-mist/40 px-3 py-2 text-sm text-aura-graphite-soft">
          Trocando a senha de <strong className="text-aura-graphite">{email}</strong>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className="text-sm font-medium text-aura-graphite">
          Nova senha
        </label>
        <div className="relative">
          <input
            id="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 pr-11 text-[0.95rem] text-aura-graphite outline-none transition focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Esconder senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft transition hover:text-aura-graphite"
          >
            {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-aura-graphite-soft">Pelo menos 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmacao" className="text-sm font-medium text-aura-graphite">
          Repita a nova senha
        </label>
        <input
          id="confirmacao"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className="w-full rounded-xl border border-aura-mist bg-white px-4 py-3 text-[0.95rem] text-aura-graphite outline-none transition focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      {erro && (
        <p className="rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-aura-petrol-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-aura-petrol-600 disabled:opacity-60"
      >
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar nova senha
      </button>
    </form>
  );
}
