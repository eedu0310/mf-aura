/** Rodar com: npx tsx src/lib/avaliacoes/mensagens.teste.ts */
import { montarMensagensDeAvaliacao } from "./mensagens";

let passou = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
    console.error(`FALHOU: ${nome}\n  esperado ${JSON.stringify(esperado)}\n  obtido   ${JSON.stringify(obtido)}`);
    process.exit(1);
  }
  passou += 1;
}

const config = {
  mensagem_padrao: "Oi, {cliente}! Tudo bem?\n\nAvalie aqui:\n👉 {link}",
  mensagem_redes: "Siga a gente!\n\nInstagram: {instagram}\nFacebook: {facebook}\n\nObrigado!",
  link_instagram: "https://instagram.com/loja",
  link_facebook: "https://facebook.com/loja",
};
const G = "https://crm/av/abc";

{
  const m = montarMensagensDeAvaliacao(config, "Maria Silva", G);
  conferir("duas mensagens", m.length, 2);
  conferir("1ª com nome e link", m[0], "Oi, Maria Silva! Tudo bem?\n\nAvalie aqui:\n👉 https://crm/av/abc");
  conferir("2ª com as redes", m[1], "Siga a gente!\n\nInstagram: https://instagram.com/loja\nFacebook: https://facebook.com/loja\n\nObrigado!");
}
{
  const m = montarMensagensDeAvaliacao({ ...config, link_facebook: null }, "Ana", G);
  conferir("sem facebook: linha some", m[1], "Siga a gente!\n\nInstagram: https://instagram.com/loja\n\nObrigado!");
}
{
  const m = montarMensagensDeAvaliacao({ ...config, link_facebook: "", link_instagram: "" }, "Ana", G);
  conferir("sem nenhuma rede: só a 1ª", m.length, 1);
}
{
  const m = montarMensagensDeAvaliacao({ ...config, mensagem_redes: null }, "Ana", G);
  conferir("sem 2ª configurada: só a 1ª", m.length, 1);
}
{
  const m = montarMensagensDeAvaliacao(config, "+55 54 9940-4307", G);
  conferir("nome que é telefone não entra na saudação", m[0].startsWith("Oi! Tudo bem?"), true);
  const n = montarMensagensDeAvaliacao(config, null, G);
  conferir("sem nome", n[0].startsWith("Oi! Tudo bem?"), true);
}
{
  const m = montarMensagensDeAvaliacao({ mensagem_padrao: null }, "Ana", G);
  conferir("sem modelo: usa o padrão", m[0], "Oi Ana! Foi um prazer te atender. Se puder deixar sua avaliação, ajuda muito a gente: https://crm/av/abc");
}
{
  const m = montarMensagensDeAvaliacao({ ...config, mensagem_padrao: "{cliente}, {link} e {link}" }, "Ana", G);
  conferir("marcador repetido troca todos", m[0], "Ana, https://crm/av/abc e https://crm/av/abc");
}

console.log(`${passou}/${passou} verificações passaram`);
