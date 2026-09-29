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

  // Sem Supabase configurado, não há sessão para atualizar — segue o app
  // normalmente em modo demonstração.
  if (!url || !anonKey) return response;

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
      const { data: perfil } = await supabase
        .from("profiles")
        .select("ativo")
        .eq("id", userId)
        .single();
      contaAtiva = perfil?.ativo !== false;
      lembrarSessao(token, userId, contaAtiva);
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
    caminho.startsWith("/avaliar") ||
    // Link curto de avaliação: quem abre é o cliente, que não tem login.
    caminho.startsWith("/av/") ||
    caminho.startsWith("/api/cron") ||
    // O calendário é aberto de propósito: quem acessa é o Google Agenda ou o
    // calendário do iPhone, que não fazem login. O segredo é o token da URL.
    caminho.startsWith("/api/agenda/") ||
    caminho.startsWith("/api/whatsapp/webhook") ||
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
