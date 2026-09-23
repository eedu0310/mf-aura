/**
 * Conteúdo do Mapa Comercial (tela "Mapa Comercial completo").
 *
 * O arquivo anterior era um rascunho: exportava objetos no formato errado e
 * a tela não abria. Aqui está o formato que o componente espera, com um
 * conteúdo inicial do ramo (lareiras, churrasqueiras e aquecimento). O
 * gestor pode trocar estes textos pelos da casa — e o que a IA usa para
 * orientar os vendedores fica na área "Materiais que a AURA estuda".
 */

export interface ItemConteudo {
  t: string;
  d?: string;
  copy?: string;
}

export interface ModuloConteudo {
  title: string;
  desc?: string;
  children?: readonly ItemConteudo[];
}

export const FUNIL: readonly ModuloConteudo[] = [
  {
    title: "1. Prospecção",
    desc: "Encher o funil com quem tem obra, reforma ou projeto em andamento.",
    children: [
      { t: "Quem procurar", d: "Arquitetos, designers de interiores, construtoras, lojas de acabamento e clientes que já compraram (indicação)." },
      { t: "Meta diária", d: "Pelo menos 5 contatos novos por dia. Sem prospecção, o funil seca em 30 dias." },
      { t: "Registre sempre", d: "Todo contato vira atividade no CRM, mesmo o que não deu certo. É isso que mostra o seu ritmo." },
    ],
  },
  {
    title: "2. Qualificação",
    desc: "Descobrir se há projeto, prazo e orçamento antes de gastar tempo.",
    children: [
      { t: "Etapa da obra", d: "Na planta, em execução ou em acabamento? Isso define o prazo da venda." },
      { t: "Tipo de ambiente", d: "Interno ou externo, área de lazer, varanda gourmet, metragem e pé-direito." },
      { t: "Tipo de aquecimento", d: "Gás, elétrico, lenha ou pellet — muda produto, instalação e preço." },
      { t: "Quem decide", d: "Cliente final, arquiteto ou construtora. Fale com quem assina." },
    ],
  },
  {
    title: "3. Apresentação",
    desc: "Mostrar a solução certa, não o catálogo inteiro.",
    children: [
      { t: "Leve referência visual", d: "Fotos de obras parecidas com a do cliente valem mais que folheto." },
      { t: "Explique a instalação", d: "Exaustão, alvenaria, ponto de gás e prazo. Cliente inseguro não fecha." },
      { t: "Registre o relato", d: "Ao sair da visita, grave o relato por voz no CRM enquanto está fresco." },
    ],
  },
  {
    title: "4. Proposta",
    desc: "Orçamento claro, com prazo e o que está incluído.",
    children: [
      { t: "Envie em até 24h", d: "Proposta que demora perde para quem respondeu antes." },
      { t: "Deixe explícito", d: "Produto, instalação, frete, prazo de entrega e garantia — separados." },
      { t: "Combine o retorno", d: "Nunca encerre sem data do próximo contato marcada no CRM." },
    ],
  },
  {
    title: "5. Negociação e fechamento",
    desc: "Conduzir para a decisão, sem derrubar o preço por reflexo.",
    children: [
      { t: "Antes de dar desconto", d: "Ofereça prazo, brinde de instalação ou manutenção. Desconto é a última carta." },
      { t: "Confirme o combinado", d: "Valor, forma de pagamento, prazo de instalação e responsável pela obra." },
      { t: "Registre a venda", d: "Fechou, registra na hora: é o que dispara o pós-venda automático." },
    ],
  },
];

export const MENSAGENS: readonly ModuloConteudo[] = [
  {
    title: "Primeiro contato",
    children: [
      {
        t: "Lead que chegou pelo site",
        d: "Responda em minutos — é o que mais aumenta a chance de fechar.",
        copy: "Olá [Nome], aqui é da loja. Vi que você se interessou por lareiras. Me conta rapidinho: é para ambiente interno ou externo, e a obra já está em andamento?",
      },
      {
        t: "Indicação de arquiteto",
        copy: "Olá [Nome], tudo bem? Fui indicado pelo seu arquiteto. Trabalho com lareiras e aquecimento e posso te mandar algumas referências parecidas com o seu projeto. Posso enviar?",
      },
    ],
  },
  {
    title: "Follow-up",
    children: [
      {
        t: "2 dias depois da proposta",
        d: "Traga algo novo — nunca só 'passando para saber'.",
        copy: "Oi [Nome], separei duas fotos de uma instalação bem parecida com a sua, para você ver o resultado final. Faz sentido conversarmos esta semana?",
      },
      {
        t: "Cliente sumiu há uma semana",
        copy: "Oi [Nome], tudo certo por aí? Sei que obra tem mil frentes. Quer que eu segure as condições da proposta por mais alguns dias?",
      },
      {
        t: "Retomada de cliente antigo",
        copy: "Oi [Nome], lembrei do seu projeto agora que chegaram modelos novos. Quer que eu te mande as novidades e um orçamento atualizado?",
      },
    ],
  },
  {
    title: "Pós-venda",
    children: [
      {
        t: "Confirmação de instalação",
        copy: "Oi [Nome], sua instalação está agendada. No dia, preciso que o ambiente esteja livre e com o ponto de energia disponível. Qualquer coisa, fala comigo.",
      },
      {
        t: "Pedido de avaliação",
        copy: "Oi [Nome], que bom que deu tudo certo! Você poderia avaliar sua experiência com a loja? É rapidinho e ajuda demais a gente.",
      },
    ],
  },
];

export const OBJECOES: readonly ItemConteudo[] = [
  {
    t: "Está caro",
    d: "Leve para valor de uso, não para preço de etiqueta.",
    copy: "Entendo, [Nome]. Esse valor inclui a instalação e a garantia — é um equipamento que fica na casa por 15, 20 anos. Posso te mostrar uma opção com o mesmo acabamento e investimento menor?",
  },
  {
    t: "Vou pensar",
    d: "Descubra o que trava de verdade antes de aceitar.",
    copy: "Claro, [Nome]. Só para eu te ajudar melhor: o que ainda está em aberto — o valor, o prazo ou o modelo?",
  },
  {
    t: "Vou ver com meu marido / esposa / sócio",
    copy: "Perfeito, [Nome]. Quer que eu monte um resumo de uma página com fotos e valores para facilitar essa conversa?",
  },
  {
    t: "Achei mais barato em outro lugar",
    copy: "Pode me mandar o que te passaram? Muitas vezes a diferença está na instalação ou na potência do equipamento — te mostro item a item.",
  },
  {
    t: "A obra ainda vai demorar",
    d: "Não perca o contato: marque o retorno no CRM.",
    copy: "Sem problema, [Nome]. Deixo o orçamento registrado e te procuro quando estiver perto do acabamento. Qual mês faz mais sentido?",
  },
];

export const MANUAL: readonly ModuloConteudo[] = [
  {
    title: "Ritmo da semana",
    desc: "O que sustenta o resultado do mês.",
    children: [
      { t: "Todo dia", d: "Abrir o Meu Dia, resolver os follow-ups vencidos e registrar toda atividade." },
      { t: "Toda semana", d: "Pelo menos 1 visita a arquiteto ou construtora e revisão do pipeline parado." },
      { t: "Todo mês", d: "Revisar a meta com o gestor e retomar os clientes perdidos do trimestre." },
    ],
  },
  {
    title: "Regras de registro",
    desc: "O CRM só ajuda quem alimenta.",
    children: [
      { t: "Relato obrigatório", d: "Toda visita, reunião e venda pede o relato — pode ser falado no microfone." },
      { t: "Próximo passo sempre", d: "Nenhum atendimento termina sem data do próximo contato." },
      { t: "Venda fechada na hora", d: "Registrar a venda é o que abre o pós-venda e conta no ranking." },
    ],
  },
];

/** Mensagens fixadas no topo da aba "Mensagens". */
export const PINNED: readonly ItemConteudo[] = [
  {
    t: "Resposta rápida para lead novo",
    d: "Use nos primeiros minutos. Velocidade é o que ganha o lead.",
    copy: "Olá [Nome]! Recebi seu contato agora. Para eu já te mandar as opções certas: é para ambiente interno ou externo, e você prefere a gás, elétrica ou a lenha?",
  },
];
