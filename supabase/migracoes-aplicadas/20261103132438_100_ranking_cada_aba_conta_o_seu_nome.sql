-- 20261103132438 100_ranking_cada_aba_conta_o_seu_nome

alter table public.ranking_criterios drop constraint if exists ranking_criterios_medida_check;
alter table public.ranking_criterios add constraint ranking_criterios_medida_check check (medida = any (array[
  'avaliacao_conquistada', 'avaliacao_enviada', 'recompra', 'prospeccao_fechada', 'venda_nova',
  'venda_lead', 'faturamento', 'prospeccao', 'lead_recebido', 'negociacao', 'atividades', 'crm_em_dia'
]::text[]));

update public.ranking_criterios set medida = 'venda_lead',
  descricao = 'Venda fechada de cliente que veio de anúncio ou campanha'
where titulo = 'Venda lead fechada';

update public.ranking_criterios set medida = 'prospeccao', categoria_alvo = null,
  descricao = 'Contatos novos que você trouxe (sem os leads de anúncio)'
where titulo = 'Prospecções';

update public.ranking_criterios set medida = 'avaliacao_enviada',
  descricao = 'Pedidos de avaliação que você mandou ao cliente'
where titulo = 'Enviar avaliação';

update public.ranking_criterios set medida = 'avaliacao_conquistada',
  descricao = 'Avaliações que o cliente abriu ou o gestor confirmou'
where titulo = 'Receber avaliação';

update public.ranking_criterios set medida = 'negociacao', meta_mes = 5,
  descricao = 'Negócios que chegaram em Negociação (um por cliente)'
where titulo = 'Negociação';

update public.ranking_criterios set medida = 'lead_recebido', categoria_alvo = null,
  descricao = 'Leads de anúncio ou campanha que chegaram para você'
where titulo = 'Lead recebido';

update public.ranking_criterios set medida = 'prospeccao_fechada', categoria_alvo = null,
  descricao = 'Contato novo que você trouxe e virou venda'
where titulo = 'Fechamentos de prospecção';
