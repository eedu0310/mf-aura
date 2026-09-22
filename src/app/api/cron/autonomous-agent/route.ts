import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const appUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase credentials not configured");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  // Verificar autorização
  const authHeader = request.headers.get("Authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 1. Buscar todos os usuários ativos
    const { data: usuarios, error: usuariosError } = await supabase
      .from("vendedores")
      .select("auth_id, empresa_id")
      .eq("ativo", true)
      .limit(1000);

    if (usuariosError || !usuarios) {
      return Response.json(
        { error: "Erro ao buscar usuários" },
        { status: 500 }
      );
    }

    console.log(`🤖 Iniciando execução de agentes autônomos para ${usuarios.length} usuários`);

    // 2. Executar agente para cada usuário em paralelo
    const promises = usuarios.map((user) =>
      fetch(`${appUrl}/api/aura/autonomous-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.auth_id,
          empresa: user.empresa_id,
          dataAtual: new Date().toISOString(),
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          console.log(`✅ Agente executado para ${user.auth_id}:`, result);
          return result;
        })
        .catch((err) => {
          console.error(`❌ Erro ao executar agente para ${user.auth_id}:`, err);
          return { error: err.message };
        })
    );

    const resultados = await Promise.allSettled(promises);

    const sucessos = resultados.filter((r) => r.status === "fulfilled").length;
    const erros = resultados.filter((r) => r.status === "rejected").length;

    return Response.json({
      success: true,
      totalUsuarios: usuarios.length,
      sucessos,
      erros,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro no cron de agentes autônomos:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
