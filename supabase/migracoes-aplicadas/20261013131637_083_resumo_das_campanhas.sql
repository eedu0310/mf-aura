-- 20261013131637 083_resumo_das_campanhas

-- Quanto cada campanha gerou, contado na hora.
--
-- A tabela tem uma coluna leads_gerados que nunca foi atualizada por ninguém:
-- a aba de marketing mostrava zero para toda campanha. A saída NÃO é criar um
-- gatilho para manter esse contador — contador denormalizado desencontra do
-- dado real no primeiro caso de borda (lead transferido de vendedor, venda
-- cancelada, cliente apagado) e ninguém percebe, porque ele continua
-- mostrando um número plausível.
--
-- Aqui conta direto da fonte. A base é pequena (257 relacionamentos, 210
-- oportunidades), então o custo é irrelevante e o número é sempre verdade.
--
-- security_invoker: a view respeita a RLS de quem está consultando, em vez de
-- rodar com os poderes do dono. Sem isso, um vendedor veria o faturamento de
-- campanhas de outras lojas.
create or replace view public.campanhas_resumo
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.relacionamentos r where r.campanha_id = c.id) as leads,
  (select count(*) from public.oportunidades o where o.campanha_id = c.id) as negocios,
  (select count(*) from public.vendas v where v.campanha_id = c.id) as vendas_fechadas,
  (select coalesce(sum(coalesce(v.valor_fechado, v.valor)), 0)
     from public.vendas v where v.campanha_id = c.id) as valor_gerado,
  (select count(*) from public.whatsapp_ia_leads w where w.campanha_id = c.id) as conversas
from public.campanhas_marketing c;

grant select on public.campanhas_resumo to authenticated;

-- O mesmo, quebrado por vendedor: é a pergunta real do gestor, porque os
-- vendedores internos vivem de lead de campanha e os externos quase não os
-- recebem.
create or replace view public.campanhas_por_vendedor
with (security_invoker = true) as
select
  c.id as campanha_id,
  c.empresa,
  c.nome as campanha,
  c.canal,
  p.id as vendedor_id,
  p.nome as vendedor,
  count(distinct r.id) as leads,
  count(distinct o.id) as negocios,
  count(distinct v.id) as vendas_fechadas,
  coalesce(sum(distinct coalesce(v.valor_fechado, v.valor)), 0) as valor_gerado
from public.campanhas_marketing c
join public.relacionamentos r on r.campanha_id = c.id
join public.profiles p on p.id = r.owner_id
left join public.oportunidades o on o.campanha_id = c.id and o.owner_id = p.id
left join public.vendas v on v.campanha_id = c.id and v.owner_id = p.id
group by c.id, c.empresa, c.nome, c.canal, p.id, p.nome;

grant select on public.campanhas_por_vendedor to authenticated;
