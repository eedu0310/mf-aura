#!/usr/bin/env node
/**
 * Restaura UMA tabela a partir de um backup noturno.
 *
 * Deliberadamente não existe botão para isto na aplicação, e deliberadamente
 * não restaura o banco inteiro de uma vez. Restauração é operação de dedo no
 * gatilho: o caso real é quase sempre "apagaram umas linhas de uma tabela",
 * não "perdemos tudo". Um botão de "restaurar tudo" na tela é muito mais
 * perigoso do que útil.
 *
 * Uso, de dentro de /opt/aura:
 *
 *   node scripts/restaurar-backup.mjs .backups/aura-2026-10-12.json.gz relacionamentos
 *
 * Por padrão só MOSTRA o que faria. Para gravar de verdade, acrescente
 * --gravar no fim. Ele faz upsert por id: linha que ainda existe é
 * atualizada, linha apagada volta, e nada é removido.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const [, , arquivo, tabela, ...resto] = process.argv;
const gravar = resto.includes("--gravar");

if (!arquivo || !tabela) {
  console.error("Uso: node scripts/restaurar-backup.mjs <arquivo.json.gz> <tabela> [--gravar]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  console.error("Rode com:  set -a && . ./.env.local && set +a && node scripts/restaurar-backup.mjs ...");
  process.exit(1);
}

const dados = JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString("utf8"));

/*
 * Tabela especial "esquema": escreve o SQL do esquema num arquivo em vez de
 * gravar no banco. Para reconstruir um projeto do zero: rodar esse SQL no
 * editor do Supabase e só depois restaurar as tabelas, uma a uma.
 */
if (tabela === "esquema") {
  if (!dados.esquema_sql) {
    console.error("Este backup é anterior à versão 2 e não carrega o esquema.");
    process.exit(1);
  }
  const destino = `esquema-${dados.dia}.sql`;
  fs.writeFileSync(destino, dados.esquema_sql);
  console.log(`Esquema de ${dados.dia} gravado em ${destino} (${Math.round(dados.esquema_sql.length / 1024)} KB, ${(dados.migracoes ?? []).length} migrações no backup).`);
  process.exit(0);
}

const linhas = dados?.tabelas?.[tabela];
if (!Array.isArray(linhas)) {
  console.error(`A tabela "${tabela}" não existe neste backup.`);
  console.error(`Tabelas disponíveis: ${Object.keys(dados?.tabelas ?? {}).join(", ")}`);
  process.exit(1);
}

console.log(`Backup de ${dados.dia}, gerado em ${dados.gerado_em}`);
console.log(`Tabela ${tabela}: ${linhas.length} linhas no arquivo.`);

if (!gravar) {
  console.log("\nMODO DE CONFERÊNCIA — nada foi gravado.");
  console.log("Primeiras 3 linhas, para você reconhecer o dado:");
  console.log(JSON.stringify(linhas.slice(0, 3), null, 2));
  console.log("\nSe for isto mesmo, rode o mesmo comando com --gravar no fim.");
  process.exit(0);
}

const sb = createClient(url, chave, { auth: { persistSession: false } });
let gravadas = 0;
for (let i = 0; i < linhas.length; i += 500) {
  const lote = linhas.slice(i, i + 500);
  const { error } = await sb.from(tabela).upsert(lote, { onConflict: "id" });
  if (error) {
    console.error(`\nFalhou no lote a partir da linha ${i}: ${error.message}`);
    console.error(`Gravadas até aqui: ${gravadas}. Nada foi apagado.`);
    process.exit(1);
  }
  gravadas += lote.length;
  process.stdout.write(`\rGravadas ${gravadas}/${linhas.length}`);
}
console.log(`\nPronto. ${gravadas} linhas restauradas em ${tabela}. Nenhuma linha foi apagada.`);
