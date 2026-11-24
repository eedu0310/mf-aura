-- 20261124133608 104_fichas_renomeadas_com_produto

-- 104 · Devolve o nome do cliente às fichas que viraram "produto - R$ valor" (24/11/2026)
update public.relacionamentos r
   set nome = coalesce(
         (select o.cliente from public.oportunidades o where o.relacionamento_id = r.id order by o.created_at limit 1),
         (select v.cliente from public.vendas v where v.relacionamento_id = r.id order by v.created_at limit 1)
       ),
       updated_at = now()
 where r.nome like '% - R$%'
   and coalesce(
         (select o.cliente from public.oportunidades o where o.relacionamento_id = r.id order by o.created_at limit 1),
         (select v.cliente from public.vendas v where v.relacionamento_id = r.id order by v.created_at limit 1)
       ) is not null;
