import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * As variáveis NEXT_PUBLIC_ são assadas dentro do JavaScript do navegador na
 * hora do build. Se faltarem AQUI, o servidor continua funcionando — ele lê o
 * .env.local em tempo de execução — e só o navegador fica sem: o cliente do
 * Supabase nasce nulo e qualquer tela que grave direto do navegador quebra.
 *
 * Foi assim que o "Salvar compromisso" da agenda ficou quebrado sem ninguém
 * saber: o resto do sistema usa rotas de servidor e continuou de pé, então o
 * sintoma era uma tela só, com uma mensagem que culpava a internet do
 * vendedor.
 *
 * Por isso o build PARA em vez de produzir um pacote pela metade. Build que
 * falha custa dois minutos; build que passa quebrado custa semanas, porque
 * ninguém vai procurar no lugar certo.
 */
function conferirVariaveisDoNavegador() {
  // Só no build de produção: em dev, parar o servidor por isso atrapalha mais
  // do que ajuda, e o desenvolvedor vê o erro na primeira tela que abrir.
  if (process.env.NODE_ENV !== "production") return;
  /**
   * Escotilha para build de verificação fora do servidor (CI, sandbox), onde
   * não existe .env.local e o objetivo é só conferir que o código compila.
   * No servidor ninguém define isto, então a trava vale.
   */
  if (process.env.AURA_PULAR_CONFERENCIA_ENV === "1") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const faltando: string[] = [];
  if (!url?.trim()) faltando.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!chave?.trim()) {
    faltando.push("NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
  }

  if (faltando.length) {
    throw new Error(
      `\n\n  BUILD INTERROMPIDO: falta configuração do navegador no .env.local\n\n` +
        faltando.map((v) => `    - ${v}`).join("\n") +
        `\n\n  Sem isso o servidor sobe, mas toda tela que grava direto do\n` +
        `  navegador (agenda, por exemplo) quebra dizendo que o banco não\n` +
        `  está configurado. Acrescente ao /opt/aura/.env.local e rode o\n` +
        `  build de novo.\n`,
    );
  }
}

conferirVariaveisDoNavegador();

/**
 * Identidade deste build. Vai assada no JavaScript do navegador E na rota
 * /api/versao; quando as duas deixam de bater, o navegador está rodando uma
 * versão antiga e se atualiza (componente AtualizadorDeVersao).
 *
 * Precisa ser IGUAL em toda leitura deste arquivo. O build com webpack lê o
 * next.config uma vez para o servidor e outra para o navegador; com a hora do
 * relógio, cada lado ganhava uma data diferente, a faixa "Saiu uma versão
 * nova" aparecia para todo mundo e a aba escondida recarregava a cada 5 min
 * (26/10/2026). O commit do git é o mesmo nas duas leituras.
 */
function versaoDoBuild(): string {
  if (process.env.AURA_VERSAO_BUILD) return process.env.AURA_VERSAO_BUILD;
  let versao = "";
  try {
    versao = execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Sem git (build fora do servidor): cai na hora, guardada abaixo.
  }
  if (!versao) versao = new Date().toISOString();
  process.env.AURA_VERSAO_BUILD = versao;
  return versao;
}
const VERSAO_DO_BUILD = versaoDoBuild();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_VERSAO: VERSAO_DO_BUILD },
  // Pacotes de servidor que não devem ser empacotados pelo Next (o Baileys é
  // ESM puro e usa módulos nativos do Node; empacotado ele quebra em runtime).
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "qrcode", "jimp", "sharp"],
};

export default nextConfig;
