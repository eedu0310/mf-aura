/**
 * Quem recebe o quê: as listas de pessoas que o motor, a Diretora, o
 * Guardião e os agentes configuráveis usam para decidir o destinatário.
 *
 * Só conta quem está na equipe (ativo e não excluído) e, para gestor, só o
 * aprovado — o cargo "Gestor" sozinho não quer dizer nada (ver mandaNaLoja em
 * src/lib/auth-empresa.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
  empresa: string;
  cargo: string;
  mestre: boolean;
  gestorAprovado: boolean;
}

export async function equipeAtiva(sb: SupabaseClient): Promise<PessoaDaEquipe[]> {
  const { data, error } = await sb
    .from("profiles")
    .select("id, nome, empresa, cargo, gestor_mestre, gestor_aprovado")
    .eq("ativo", true)
    .is("excluido_em", null);
  if (error) throw new Error(`Não consegui ler a equipe: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: String(p.id),
    nome: String(p.nome ?? ""),
    empresa: String(p.empresa ?? ""),
    cargo: String(p.cargo ?? ""),
    mestre: p.gestor_mestre === true && p.gestor_aprovado === true && p.cargo === "Gestor",
    gestorAprovado: p.gestor_aprovado === true && p.cargo === "Gestor",
  }));
}

export function mestres(equipe: PessoaDaEquipe[]): PessoaDaEquipe[] {
  return equipe.filter((p) => p.mestre);
}

/** Gestores aprovados da loja; sem nenhum, os mestres (alguém tem de receber). */
export function gestoresDaLoja(equipe: PessoaDaEquipe[], empresa: string): PessoaDaEquipe[] {
  const daLoja = equipe.filter((p) => p.gestorAprovado && p.empresa === empresa);
  return daLoja.length ? daLoja : mestres(equipe);
}

function ehPosVenda(cargo: string): boolean {
  return /^p[oó]s[\s-]?venda$/i.test(cargo.trim());
}

/** Pós-venda da loja; sem ninguém nesse cargo, os gestores dela. */
export function posVendaDaLoja(equipe: PessoaDaEquipe[], empresa: string): PessoaDaEquipe[] {
  const lista = equipe.filter((p) => p.empresa === empresa && ehPosVenda(p.cargo));
  return lista.length ? lista : gestoresDaLoja(equipe, empresa);
}

/** Marketing da loja; sem ninguém nesse cargo, os gestores dela. */
export function marketingDaLoja(equipe: PessoaDaEquipe[], empresa: string): PessoaDaEquipe[] {
  const lista = equipe.filter((p) => p.empresa === empresa && p.cargo === "Marketing");
  return lista.length ? lista : gestoresDaLoja(equipe, empresa);
}
