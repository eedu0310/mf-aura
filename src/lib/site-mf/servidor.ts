import { createHash } from "crypto";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { EMPRESA_DO_SITE } from "./tipos";

/**
 * Quem pode usar a área do Site: quem é da MF International e o gestor
 * mestre (que atravessa as lojas). O banco confere a mesma regra
 * (equipe_do_site); esta é a porta das rotas que usam a chave de serviço.
 */
export async function equipeDoSite(request?: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return null;
  if (auth.empresa !== EMPRESA_DO_SITE && !auth.gestorMestre) return null;
  return auth;
}

/** Não guardamos o IP de quem preenche: só uma impressão dele, para frear robô. */
export function impressaoDoIp(request: Request): string | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  if (!ip) return null;
  return createHash("sha256").update(`aura-site:${ip}`).digest("hex").slice(0, 32);
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}
