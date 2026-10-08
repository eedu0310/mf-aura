import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { esquecerSessao, lembrarSessao, sessaoLembrada, tokenDaRequisicao } from "@/lib/sessao-cache";

/**
 * Cabeçalho onde o proxy entrega à rota quem ele já validou.
 *
 * A rota chamava `auth.getUser()` por conta própria, repetindo a ida ao
 * Supabase que o proxy acabara de fazer. Agora ela lê daqui.
 *
 * Só é confiável porque o proxy passa em TODA requisição (veja o matcher) e
 * apaga o cabeçalho antes de escrevê-lo: o que vier de fora nunca sobrevive.
 */
export const CABECALHO_USUARIO = "x-aura-usuario";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /**
   * SEM SUPABASE CONFIGURADO, NINGUÉM ENTRA.
   *
   * Isto aqui dizia "segue o app normalmente em modo demonstração" e devolvia
   * a resposta sem checar nada: sem conferir login, sem bloquear conta
   * desativada, sem proteger rota nenhuma. O proxy é justamente quem faz essa
   * guarda, e ele a dispensava inteira por causa de uma variável de ambiente
   * faltando.
   *
   * Foi o que aconteceu de verdade: a NEXT_PUBLIC_SUPABASE_ANON_KEY não estava
   * no .env.local, e o sistema seguiu de pé sem a guarda do proxy — sem
   * ninguém perceber, porque nada quebrou na tela.
   *
   * Falta de configuração não pode virar porta aberta. Agora bloqueia, e diz
   * o que fazer, porque num servidor de verdade isto é defeito de instalação
   * e não um "modo".
   */
  if (!url || !anonKey) {
    console.error(
      "[proxy] Supabase não configurado: falta " +
        [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
          .filter(Boolean)
          .join(" e ") +
        ". Nenhuma requisição é autenticada enquanto isso; o acesso está bloqueado.",
    );
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { erro: "Servidor sem configuração do Supabase. Avise o responsável técnico." },
        { status: 503 },
      );
    }
    return new NextResponse(
      "Este servidor está sem a configuração do banco de dados " +
        "(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local). " +
        "Por segurança, o acesso está bloqueado até isso ser corrigido.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const caminhoPedido = request.nextUrl.pathname;
  const token = tokenDaRequisicao(request.cookies.getAll());
  const lembrada = token ? sessaoLembrada(token) : null;

  let userId: string | null = lembrada?.userId ?? null;
  let contaAtiva = lembrada?.ativo ?? true;

  if (!lembrada) {
    // Esta chamada é o que renova o token da sessão quando necessário e
    // reescreve os cookies corretos na resposta. Sem ela, a sessão criada no
    // login pode não sobreviver a um F5 ou nova aba — por isso ela continua
    // acontecendo sempre que o token é novo para nós.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      const { data: perfil, error: erroPerfil } = await supabase
        .from("profiles")
        .select("ativo")
        .eq("id", userId)
        .maybeSingle();

      if (erroPerfil) {
        /**
         * A leitura falhou: não sabemos se a conta está ativa. Deixamos passar
         * esta requisição — um soluço do banco não pode deslogar a empresa
         * toda — mas NÃO guardamos essa resposta, então a próxima requisição
         * pergunta de novo. Antes o erro virava "ativo = true" E ficava
         * memorizado em lembrarSessao: uma conta desativada seguia navegando
         * até a sessão expirar.
         */
        contaAtiva = true;
        console.error("Proxy: não consegui ler o perfil de", userId, erroPerfil.message);
      } else {
        contaAtiva = perfil?.ativo !== false;
        lembrarSessao(token, userId, contaAtiva);
      }
    }
  }

  const user = userId ? { id: userId } : null;

  // Telas que podem ser abertas sem login: a de entrar, a avaliação que o
  // cliente recebe por link e as rotas chamadas por robô (cron/webhook),
  // que têm a própria autenticação por segredo.
  const caminho = caminhoPedido;
  const publica =
    caminho === "/" ||
    caminho.startsWith("/login") ||
    // A tela de redefinir senha PRECISA ser pública. Quem chega nela vem do
    // link do e-mail e ainda não tem sessão: se o proxy mandasse para o
    // login, o token da URL morreria no caminho e o link continuaria "não
    // dando nada" — que é o bug que ela veio consertar.
    caminho.startsWith("/redefinir-senha") ||
    caminho.startsWith("/avaliar") ||
    // Link curto de avaliação: quem abre é o cliente, que não tem login.
    caminho.startsWith("/av/") ||
    caminho.startsWith("/api/cron") ||
    // O calendário é aberto de propósito: quem acessa é o Google Agenda ou o
    // calendário do iPhone, que não fazem login. O segredo é o token da URL.
    caminho.startsWith("/api/agenda/") ||
    caminho.startsWith("/api/whatsapp/webhook") ||
    // A Meta bate aqui de fora, sem login. Quem autentica e a assinatura
    // X-Hub-Signature-256, conferida dentro da propria rota.
    caminho.startsWith("/api/meta/webhook") ||
    caminho.startsWith("/auth") ||
    caminho.startsWith("/_next") ||
    caminho.startsWith("/manifest") ||
    caminho.startsWith("/icons");

  // Uma conta desativada pelo gestor não pode mais entrar. Antes o campo
  // "ativo" só escondia a pessoa das listas: ela continuava logando e
  // usando o sistema normalmente.
  if (user && !publica) {
    if (!contaAtiva) {
      esquecerSessao(token);
      await supabase.auth.signOut();
      if (caminho.startsWith("/api/")) {
        return NextResponse.json({ erro: "Acesso desativado pelo gestor." }, { status: 403 });
      }
      const destino = request.nextUrl.clone();
      destino.pathname = "/login";
      destino.search = "?bloqueado=1";
      return NextResponse.redirect(destino);
    }
  }

  if (!user && !publica) {
    // Antes, quem não estava logado ainda carregava a tela inteira (só os
    // dados vinham vazios). Agora o servidor já manda para o login.
    if (caminho.startsWith("/api/")) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = `?voltar=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(destino);
  }

  // Entrega à rota quem já foi validado aqui, para ela não repetir a ida ao
  // Supabase. O cabeçalho é montado agora, no fim, para já levar os cookies
  // renovados acima; o valor que veio de fora é apagado antes de escrevermos
  // o nosso, então ninguém da internet se apresenta como validado. Se por
  // algum motivo ele não chegar, a rota volta a perguntar sozinha — fica
  // mais lento, nunca inseguro.
  const cabecalhos = new Headers(request.headers);
  cabecalhos.delete(CABECALHO_USUARIO);
  if (user) cabecalhos.set(CABECALHO_USUARIO, user.id);

  const saida = NextResponse.next({ request: { headers: cabecalhos } });
  for (const cookie of response.cookies.getAll()) saida.cookies.set(cookie);
  return saida;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
