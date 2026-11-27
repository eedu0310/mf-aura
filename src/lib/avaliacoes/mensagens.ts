/**
 * Monta as mensagens do pedido de avaliação de uma loja.
 *
 * São DUAS, enviadas uma depois da outra, para não chegar um texto enorme de
 * uma vez (pedido de 21/10):
 *   1ª mensagem_padrao: agradecimento + {link} (avaliação no Google)
 *   2ª mensagem_redes:  convite para {instagram} e {facebook}
 *
 * Os links das redes vêm da própria configuração da loja, então o gestor muda
 * o endereço num lugar só. Se a loja não tem um dos links, a linha que o usa
 * sai da mensagem, em vez de chegar ao cliente "Facebook: " vazio ou
 * "{facebook}" cru.
 */

export interface ConfigDeAvaliacao {
  mensagem_padrao: string | null;
  /** Endereço da loja para o link curto (migração 123), ex.: avaliar.aegaquecimento.com.br. */
  dominio_link?: string | null;
  link_google?: string | null;
  mensagem_redes?: string | null;
  link_instagram?: string | null;
  link_facebook?: string | null;
}

/**
 * O link que vai para o cliente (27/11/2026: "precisamos mascarar o domínio
 * crm.mflaser"). NUNCA o endereço do CRM: o cliente da A&G via "mflaser", o
 * nome da fábrica, no link da loja.
 *   - loja com endereço próprio no ar (dominio_link) e pedido com token:
 *     https://avaliar.<loja>/av/<token> — o AURA vê quando o cliente abre;
 *   - senão: o link do Google da loja, direto. O envio e o "avaliei"
 *     continuam contando (rastreio da conversa); só o "abriu" não.
 */
export function linkParaOCliente(
  config: Pick<ConfigDeAvaliacao, "dominio_link" | "link_google">,
  token: string | null | undefined,
): string {
  const dominio = (config.dominio_link ?? "").trim().toLowerCase();
  if (token && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) return `https://${dominio}/av/${token}`;
  return (config.link_google ?? "").trim();
}

const PADRAO_1 = "Oi {cliente}! Foi um prazer te atender. Se puder deixar sua avaliação, ajuda muito a gente: {link}";

function preencher(modelo: string, valores: Record<string, string | null | undefined>): string {
  const linhas = modelo.split("\n").filter((linha) => {
    // Linha que depende de um link que a loja não tem: fora.
    for (const [chave, valor] of Object.entries(valores)) {
      if (linha.includes(`{${chave}}`) && !(valor ?? "").trim() && chave !== "cliente") return false;
    }
    return true;
  });
  let texto = linhas.join("\n");
  for (const [chave, valor] of Object.entries(valores)) {
    texto = texto.split(`{${chave}}`).join((valor ?? "").trim());
  }
  // "Oi, !" quando o cliente veio sem nome.
  texto = texto.replace(/(Oi|Olá),\s*!/g, "$1!").replace(/\s+!/g, "!");
  // Linhas em branco repetidas, sobra de linha removida.
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

export function montarMensagensDeAvaliacao(
  config: ConfigDeAvaliacao,
  cliente: string | null | undefined,
  linkDoGoogle: string,
): string[] {
  // Nome como está no cadastro. Card sem nome vira o telefone ("+55 54 9...")
  // — isso não vai para a saudação.
  const bruto = (cliente ?? "").trim();
  const nome = /^[+\d(]/.test(bruto) ? "" : bruto;
  const valores = {
    cliente: nome,
    link: linkDoGoogle,
    instagram: config.link_instagram ?? "",
    facebook: config.link_facebook ?? "",
  };
  const mensagens = [preencher(config.mensagem_padrao?.trim() || PADRAO_1, valores)];
  const redes = (config.mensagem_redes ?? "").trim();
  if (redes) {
    const segunda = preencher(redes, valores);
    // Sem nenhum link de rede, a 2ª mensagem perde o sentido.
    const temRede = (config.link_instagram ?? "").trim() || (config.link_facebook ?? "").trim();
    if (segunda && temRede) mensagens.push(segunda);
  }
  return mensagens;
}
