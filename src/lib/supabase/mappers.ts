import type {
  Atividade,
  CategoriaRelacionamento,
  Etapa,
  MotivoPerda,
  Oportunidade,
  Probabilidade,
  Relacionamento,
  TemperaturaRelacionamento,
  TipoAtividade,
  Venda,
} from "@/lib/types";

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim()) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : undefined;
  }
  return undefined;
}

export function relacionamentoDoBanco(
  linha: Record<string, unknown>,
): Relacionamento {
  return {
    id: linha.id as string,
    vendedorId:
      (linha.vendedor_id as string) ?? (linha.owner_id as string) ?? "",
    ownerId: linha.owner_id as string,
    empresa: texto(linha.empresa),
    nome: texto(linha.nome) ?? "Relacionamento sem nome",
    categoria: linha.categoria as CategoriaRelacionamento,
    origem: texto(linha.origem),
    temperatura: linha.temperatura as TemperaturaRelacionamento,
    telefone: texto(linha.telefone),
    email: texto(linha.email),
    cidade: texto(linha.cidade),
    estado: texto(linha.estado),
    ultimoContato: texto(linha.ultimo_contato),
    ultimoContatoEm: texto(linha.ultimo_contato_em),
    proximoContato: texto(linha.proximo_contato) ?? "a definir",
    proximoContatoEm: texto(linha.proximo_contato_em),
    valor: numero(linha.valor),
    valorGerado: numero(linha.valor_gerado),
    criadoEm: texto(linha.created_at),
    atualizado: texto(linha.updated_at),
  };
}

export function relacionamentoParaBanco(dados: Omit<Relacionamento, "id">) {
  return {
    nome: dados.nome.trim(),
    categoria: dados.categoria,
    origem: dados.origem || null,
    telefone: dados.telefone?.trim() || null,
    email: dados.email?.trim().toLowerCase() || null,
    cidade: dados.cidade?.trim() || null,
    estado: dados.estado?.trim() || null,
    temperatura: dados.temperatura,
    ultimo_contato: dados.ultimoContato || null,
    ultimo_contato_em: dados.ultimoContatoEm || null,
    proximo_contato: dados.proximoContato || "a definir",
    proximo_contato_em: dados.proximoContatoEm || null,
  };
}

export function oportunidadeDoBanco(
  linha: Record<string, unknown>,
): Oportunidade {
  return {
    id: linha.id as string,
    cliente: texto(linha.cliente) ?? "Cliente sem nome",
    valor: numero(linha.valor) ?? 0,
    etapa: linha.etapa as Etapa,
    probabilidade: linha.probabilidade as Probabilidade,
    produto: texto(linha.produto),
    descricao: texto(linha.descricao),
    motivoPerda: (linha.motivo_perda as MotivoPerda | null) || null,
    descricaoPerda: texto(linha.descricao_perda) || null,
    dataPerda: texto(linha.data_perda) || null,
    relacionamentoId: texto(linha.relacionamento_id),
    ownerId: linha.owner_id as string,
    ownerNome: texto(linha.owner_nome),
    criadoEm: texto(linha.created_at),
    atualizado: texto(linha.updated_at),
    empresa: texto(linha.empresa),
    diasParado: numero(linha.dias_parado),
    orcamentoPath: texto(linha.orcamento_path) || null,
    orcamentoNome: texto(linha.orcamento_nome) || null,
  };
}

export function oportunidadeParaBanco(
  dados: Omit<Oportunidade, "id" | "diasParado">,
) {
  return {
    empresa: dados.empresa,
    cliente: dados.cliente.trim(),
    produto: dados.produto?.trim() || null,
    descricao: dados.descricao?.trim() || null,
    valor: dados.valor,
    etapa: dados.etapa,
    probabilidade: dados.probabilidade,
    motivo_perda: dados.motivoPerda ?? null,
    descricao_perda: dados.descricaoPerda ?? null,
    data_perda: dados.dataPerda ?? null,
    relacionamento_id: dados.relacionamentoId || null,
  };
}

export function vendaDoBanco(linha: Record<string, unknown>): Venda {
  return {
    id: linha.id as string,
    vendedorId:
      (linha.vendedor_id as string) ?? (linha.owner_id as string) ?? "",
    cliente: texto(linha.cliente) ?? "Cliente sem nome",
    valor: numero(linha.valor_fechado) ?? numero(linha.valor) ?? 0,
    valorOriginal: numero(linha.valor_original),
    valorFechado: numero(linha.valor_fechado),
    descontoValor: numero(linha.desconto_valor),
    descontoPercentual: numero(linha.desconto_percentual),
    formaPagamento: texto(linha.forma_pagamento),
    quantidadeParcelas: numero(linha.quantidade_parcelas),
    valorParcela: numero(linha.valor_parcela),
    entradaValor: numero(linha.entrada_valor),
    taxaFinanceira: numero(linha.taxa_financeira),
    comissaoBase: numero(linha.comissao_base),
    comissaoPercentual: numero(linha.comissao_percentual),
    comissaoValor: numero(linha.comissao_valor),
    tipo: texto(linha.forma_pagamento) ?? texto(linha.tipo),
    produto: texto(linha.produto),
    descricao: texto(linha.descricao),
    origem: texto(linha.origem),
    data: texto(linha.data) ?? "",
    loja: texto(linha.loja),
    empresa: texto(linha.empresa),
    relacionamentoId: texto(linha.relacionamento_id),
    oportunidadeId: texto(linha.oportunidade_id),
    indicadorId: texto(linha.indicador_id),
    ownerId: linha.owner_id as string,
    status: texto(linha.status),
    criadoEm: texto(linha.created_at),
    atualizado: texto(linha.updated_at),
  };
}

export function vendaParaBanco(dados: Omit<Venda, "id">) {
  const valorFechado = dados.valorFechado ?? dados.valor;
  const valorOriginal = dados.valorOriginal ?? valorFechado;
  const descontoValor = Math.max(
    dados.descontoValor ?? valorOriginal - valorFechado,
    0,
  );
  const descontoPercentual =
    dados.descontoPercentual ??
    (valorOriginal > 0 ? (descontoValor / valorOriginal) * 100 : 0);
  const quantidadeParcelas = Math.max(dados.quantidadeParcelas ?? 1, 1);
  const entradaValor = Math.max(dados.entradaValor ?? 0, 0);
  const valorParcela =
    dados.valorParcela ??
    Math.max(valorFechado - entradaValor, 0) / quantidadeParcelas;
  const comissaoBase = dados.comissaoBase ?? valorFechado;
  const comissaoValor =
    dados.comissaoValor ??
    (dados.comissaoPercentual !== undefined
      ? (comissaoBase * dados.comissaoPercentual) / 100
      : undefined);

  return {
    cliente: dados.cliente.trim(),
    produto: dados.produto?.trim() || null,
    valor: valorFechado,
    valor_original: valorOriginal,
    valor_fechado: valorFechado,
    desconto_valor: descontoValor,
    desconto_percentual: descontoPercentual,
    forma_pagamento: dados.formaPagamento || dados.tipo || null,
    quantidade_parcelas: quantidadeParcelas,
    valor_parcela: valorParcela,
    entrada_valor: entradaValor,
    taxa_financeira: dados.taxaFinanceira ?? 0,
    comissao_base: comissaoBase,
    comissao_percentual: dados.comissaoPercentual ?? null,
    comissao_valor: comissaoValor ?? null,
    origem: dados.origem || null,
    data: dados.data,
    loja: dados.loja || null,
    empresa: dados.empresa,
    relacionamento_id: dados.relacionamentoId || null,
    oportunidade_id: dados.oportunidadeId || null,
    indicador_id: dados.indicadorId || null,
    status: dados.status || null,
    descricao: dados.descricao?.trim() || null,
  };
}

export function atividadeDoBanco(linha: Record<string, unknown>): Atividade {
  return {
    id: linha.id as string,
    vendedorId:
      (linha.vendedor_id as string) ?? (linha.owner_id as string) ?? "",
    empresa: texto(linha.empresa),
    tipo: linha.tipo as TipoAtividade,
    subtipo: texto(linha.subtipo),
    titulo: texto(linha.titulo) ?? "Atividade",
    contexto: texto(linha.contexto) ?? "",
    anotacoes: texto(linha.observacao),
    resultado: texto(linha.resultado),
    objetivo: texto(linha.objetivo),
    proximoPasso: texto(linha.proximo_passo),
    quando: texto(linha.ocorrida_em) ?? texto(linha.created_at) ?? "",
    ocorridaEm: texto(linha.ocorrida_em) ?? texto(linha.created_at),
    proximoContatoEm: texto(linha.proximo_contato_em),
    relacionamentoId: texto(linha.relacionamento_id),
    clienteNome: texto(linha.cliente_nome),
    clienteTelefone: texto(linha.cliente_telefone),
    clienteEmail: texto(linha.cliente_email),
    clienteCategoria: linha.cliente_categoria as
      | CategoriaRelacionamento
      | undefined,
    origem: texto(linha.origem),
    latitude: numero(linha.latitude),
    longitude: numero(linha.longitude),
    precisaoMetros: numero(linha.precisao_metros),
    endereco: texto(linha.endereco),
    localizacaoCapturadaEm: texto(linha.localizacao_capturada_em),
    origemDispositivo: texto(linha.origem_dispositivo),
    metadata:
      linha.metadata && typeof linha.metadata === "object"
        ? (linha.metadata as Record<string, unknown>)
        : undefined,
    criadoEm: texto(linha.created_at) ?? new Date().toISOString(),
    atualizado: texto(linha.updated_at),
    ownerId: linha.owner_id as string,
  };
}

export function atividadeParaBanco(dados: Omit<Atividade, "id">) {
  return {
    tipo: dados.tipo,
    subtipo: dados.subtipo || null,
    titulo: dados.titulo,
    contexto: dados.contexto || null,
    observacao: dados.anotacoes || null,
    resultado: dados.resultado || null,
    objetivo: dados.objetivo || null,
    proximo_passo: dados.proximoPasso || null,
    ocorrida_em: dados.ocorridaEm || dados.quando || new Date().toISOString(),
    proximo_contato_em: dados.proximoContatoEm || null,
    relacionamento_id: dados.relacionamentoId || null,
    cliente_nome: dados.clienteNome || dados.contexto || null,
    cliente_telefone: dados.clienteTelefone || null,
    cliente_email: dados.clienteEmail?.trim().toLowerCase() || null,
    cliente_categoria: dados.clienteCategoria || null,
    origem: dados.origem || null,
    latitude: dados.latitude ?? null,
    longitude: dados.longitude ?? null,
    precisao_metros: dados.precisaoMetros ?? null,
    endereco: dados.endereco || null,
    localizacao_capturada_em: dados.localizacaoCapturadaEm || null,
    origem_dispositivo: dados.origemDispositivo || null,
    metadata: dados.metadata || {},
    empresa: dados.empresa,
  };
}
