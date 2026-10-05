/**
 * De onde o contato é, pelo DDD do telefone.
 *
 * POR QUE PELO DDD. A tabela de relacionamentos tem campo de estado e de
 * cidade. Medi na base real: estado está preenchido em ZERO dos 132 contatos,
 * cidade em 18. Telefone está em 129 — 97%. Esperar que alguém preencha o
 * estado é esperar o que não acontece há meses; o DDD já está lá, de graça, em
 * quase todo contato.
 *
 * PARA QUE SERVE. A AURA sugere texto pronto para o vendedor mandar, e sugeria
 * "venha conhecer nosso showroom" para um cliente de São Paulo. Cerca de 20%
 * da carteira está fora do Rio Grande do Sul — convite impossível não é só
 * inútil, é a mensagem que mostra ao cliente que do outro lado não tem
 * ninguém prestando atenção.
 */

/** DDD → sigla do estado. */
const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP",
  "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF",
  "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

const NOME_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export interface Origem {
  ddd: string | null;
  uf: string | null;
  estado: string | null;
  /** Número estrangeiro: não tem DDD brasileiro e o atendimento é outro. */
  exterior: boolean;
}

/**
 * Lê o DDD de um telefone em qualquer formato.
 *
 * Aceita com e sem o 55 do Brasil, com e sem o nono dígito, formatado ou não —
 * porque o número chega de três lugares diferentes (digitado à mão, vindo do
 * WhatsApp, vindo de campanha) e cada um escreve de um jeito.
 */
export function origemDoTelefone(telefone: string | null | undefined): Origem {
  const cru = (telefone ?? "").trim();
  const so = cru.replace(/\D/g, "");
  if (so.length < 10) return { ddd: null, uf: null, estado: null, exterior: false };

  /**
   * Estrangeiro declarado: começa com "+" e o país não é o 55.
   *
   * Sem esta checagem, "+1 415 555 2671" (Estados Unidos) virava "14155552671",
   * e "14" é DDD de Bauru — o sistema diria que o cliente é de São Paulo. Foi
   * exatamente o que o teste pegou.
   */
  if (/^\+/.test(cru) && !so.startsWith("55")) {
    return { ddd: null, uf: null, estado: null, exterior: true };
  }

  // Comprimento de número internacional (12 ou 13 dígitos) sem o 55 do Brasil:
  // é como o WhatsApp entrega número de fora.
  if (so.length >= 12 && !so.startsWith("55")) {
    return { ddd: null, uf: null, estado: null, exterior: true };
  }

  // Tira o código do Brasil quando ele veio junto.
  const nacional = so.startsWith("55") && so.length >= 12 ? so.slice(2) : so;

  if (nacional.length > 11) {
    return { ddd: null, uf: null, estado: null, exterior: true };
  }

  const ddd = nacional.slice(0, 2);
  const uf = DDD_UF[ddd] ?? null;
  // DDD que não existe no Brasil: provavelmente número estrangeiro.
  if (!uf) return { ddd, uf: null, estado: null, exterior: !so.startsWith("55") };

  return { ddd, uf, estado: NOME_UF[uf] ?? uf, exterior: false };
}

/** Este contato pode ser atendido presencialmente pela loja? */
export function atendePresencial(
  telefone: string | null | undefined,
  estadosPresenciais: string[],
): boolean {
  const o = origemDoTelefone(telefone);
  // Número de fora do Brasil nunca é presencial.
  if (o.exterior) return false;
  // Sem saber de onde é, não se tira a opção do vendedor: ele pergunta.
  if (!o.uf) return true;
  return estadosPresenciais.map((e) => e.toUpperCase()).includes(o.uf);
}
