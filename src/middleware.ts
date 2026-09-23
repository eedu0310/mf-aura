import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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

  // Essa chamada é o que efetivamente renova o token da sessão quando
  // necessário e reescreve os cookies corretos na resposta. Sem isso, a
  // sessão criada no login pode não sobreviver a um F5 ou nova aba.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Telas que podem ser abertas sem login: a de entrar, a avaliação que o
  // cliente recebe por link e as rotas chamadas por robô (cron/webhook),
  // que têm a própria autenticação por segredo.
  const caminho = request.nextUrl.pathname;
  const publica =
    caminho === "/" ||
    caminho.startsWith("/login") ||
    caminho.startsWith("/avaliar") ||
    caminho.startsWith("/api/cron") ||
    caminho.startsWith("/api/whatsapp/webhook") ||
    caminho.startsWith("/auth") ||
    caminho.startsWith("/_next") ||
    caminho.startsWith("/manifest") ||
    caminho.startsWith("/icons");

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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
