#!/usr/bin/env node
/**
 * Copia para o repositório o esquema do banco e todas as migrações aplicadas.
 *
 * Por quê: até outubro de 2026 o Supabase tinha 96 migrações aplicadas e o
 * repositório guardava 4. O banco era a única cópia da própria estrutura.
 * Este script grava:
 *
 *   supabase/esquema.sql              — DDL completo (tabelas, funções,
 *                                        triggers, políticas, views, buckets)
 *   supabase/migracoes-aplicadas/     — uma .sql por migração, na ordem
 *
 * Uso, de dentro de /opt/aura (na VPS) ou da pasta do projeto no Windows:
 *
 *   set -a && . ./.env.local && set +a && node scripts/exportar-esquema.mjs
 *
 * Depois: git add supabase && git commit -m "Esquema do banco" && git push.
 * Rode de novo sempre que aplicar uma migração nova pelo painel.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  console.error("Rode com:  set -a && . ./.env.local && set +a && node scripts/exportar-esquema.mjs");
  process.exit(1);
}

const sb = createClient(url, chave, { auth: { persistSession: false } });

const { data: ddl, error: erroDdl } = await sb.rpc("aura_esquema_ddl");
if (erroDdl || typeof ddl !== "string") {
  console.error(`Não consegui exportar o esquema: ${erroDdl?.message ?? "resposta vazia"}`);
  console.error("A migração 088 precisa estar aplicada.");
  process.exit(1);
}

const { data: migracoes, error: erroMig } = await sb.rpc("aura_migracoes");
if (erroMig || !Array.isArray(migracoes)) {
  console.error(`Não consegui listar as migrações: ${erroMig?.message ?? "resposta vazia"}`);
  process.exit(1);
}

const raiz = path.join(process.cwd(), "supabase");
fs.mkdirSync(path.join(raiz, "migracoes-aplicadas"), { recursive: true });
fs.writeFileSync(path.join(raiz, "esquema.sql"), ddl);

let gravadas = 0;
for (const m of migracoes) {
  const nome = `${m.versao}_${String(m.nome).replace(/[^a-z0-9_]+/gi, "_")}.sql`;
  fs.writeFileSync(path.join(raiz, "migracoes-aplicadas", nome), `-- ${m.versao} ${m.nome}\n\n${m.sql}\n`);
  gravadas += 1;
}

console.log(`supabase/esquema.sql: ${Math.round(ddl.length / 1024)} KB`);
console.log(`supabase/migracoes-aplicadas/: ${gravadas} arquivos`);
console.log("Agora: git add supabase && git commit -m \"Esquema do banco\" && git push");
