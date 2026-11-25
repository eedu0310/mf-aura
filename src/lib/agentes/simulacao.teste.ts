/**
 * A simulação não pode gravar NADA: o banco é o da AURA no ar.
 * Rodar com: node --experimental-strip-types src/lib/agentes/simulacao.teste.ts (com o resolvedor de @/)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteSoLeitura } from "./simulacao";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, ok: boolean) {
  if (ok) passou += 1;
  else falhas.push(oque);
}

const chamadasReais: string[] = [];
function builderFalso(tabela: string) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit", "gte", "lt", "range"]) {
    b[m] = () => {
      chamadasReais.push(`${m}:${tabela}`);
      return b;
    };
  }
  for (const m of ["insert", "update", "upsert", "delete"]) {
    b[m] = () => {
      throw new Error(`ESCRITA REAL ${m} em ${tabela}`);
    };
  }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: "x" }], error: null }).then(ok);
  return b;
}
const falso = {
  from: (t: string) => builderFalso(t),
  rpc: () => {
    throw new Error("RPC REAL");
  },
  storage: {
    from: () => ({
      upload: () => {
        throw new Error("UPLOAD REAL");
      },
    }),
  },
} as unknown as SupabaseClient;

const ignoradas: string[] = [];
const sb = clienteSoLeitura(falso, (o) => ignoradas.push(o));

async function principal() {
  const leitura = await sb.from("relacionamentos").select("id").eq("empresa", "LF Lareiras");
  conferir("leitura passa e devolve dados", (leitura.data as unknown[] | null)?.length === 1);
  conferir("leitura chegou ao cliente real", chamadasReais.includes("select:relacionamentos"));

  const r1 = await sb.from("aura_aprendizado").update({ status: "aprovado" }).eq("id", "1").eq("status", "sugerido").select("id");
  conferir("update não chega ao banco e devolve vazio", Array.isArray(r1.data) && r1.data.length === 0 && r1.error === null);
  await sb.from("aura_escritorio_mensagens").delete().lt("criado_em", "2020-01-01");
  await sb.from("notificacoes").insert({ titulo: "x" });
  await sb.from("x").upsert({ a: 1 }, { onConflict: "a" });
  const st = await sb.storage.from("backups").upload("a", "b");
  conferir("storage bloqueado", st.error !== null);
  const rp = await sb.rpc("qualquer");
  conferir("rpc bloqueado", rp.error !== null);
  conferir(
    "todas as escritas foram registradas como ignoradas",
    ["update em aura_aprendizado", "delete em aura_escritorio_mensagens", "insert em notificacoes", "upsert em x"].every((o) =>
      ignoradas.includes(o),
    ),
  );

  if (falhas.length) {
    console.error(`${falhas.length} verificação(ões) falharam:\n- ${falhas.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${passou}/${passou} verificações passaram`);
}

principal().catch((e) => {
  console.error("FALHOU:", e);
  process.exit(1);
});
