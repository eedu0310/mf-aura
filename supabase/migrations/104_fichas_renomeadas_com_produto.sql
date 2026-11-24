-- 104 · Devolve o nome do cliente às fichas que viraram "produto - R$ valor" (24/11/2026)
--
-- Ao criar uma oportunidade com cliente novo, a tela registrava a atividade
-- "Oportunidade criada" sem o nome do cliente; o "produto - R$ valor" do
-- contexto ia para cliente_nome e o gatilho aura_sync_atividade_relacionamento
-- renomeava a ficha com ele (ex.: "Adatto 70 PRO E - R$ 12.550"). A tela já
-- foi corrigida; aqui voltam os nomes, tirados da oportunidade ou da venda.
-- Ficha sem oportunidade nem venda fica como está.

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
