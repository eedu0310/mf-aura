-- Cada aba do ranking passa a contar o que o nome diz (combinado com o Elton
-- em 03/11). Os nomes tinham sido trocados na configuração sem trocar o que
-- cada critério mede: "Enviar avaliação" contava prospecção fechada,
-- "Receber avaliação" contava vendas, e "Lead recebido" e "Fechamentos de
-- prospecção" mediam a mesma coisa e mostravam o mesmo número.
--
-- Só dados de configuração; pesos continuam os que o gestor definiu. A meta
-- de "Negociação" era 100 porque o critério media "CRM em dia" (percentual);
-- contando negócios, 100 seria inalcançável, então vai para 5.
-- Aplicar DEPOIS do deploy do código que conhece as medidas novas.

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
