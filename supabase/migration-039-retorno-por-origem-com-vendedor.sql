-- 039 — A view do retorno por origem, com o vendedor no grão.
--
-- Nasceu na 037 agregando só por empresa. Com o vendedor no grão, a MESMA view
-- serve o painel do vendedor (filtrando owner_id), o do gestor e o relatório do
-- marketing (somando por empresa) — em vez de três contas parecidas que um dia
-- divergem e ninguém sabe em qual acreditar.
--
-- É drop e create, não "create or replace": replace não muda a ordem nem o nome
-- das colunas de uma view, e o grão mudou. Nada lia a view ainda.
drop view if exists public.retorno_por_origem;

create view public.retorno_por_origem
with (security_invoker = on) as
with leads as (
  select empresa, owner_id, origem_lead, campanha_id,
         to_char(created_at, 'YYYY-MM') as mes, count(*) as leads
    from public.relacionamentos where origem_lead is not null group by 1,2,3,4,5
),
fechadas as (
  select empresa, owner_id, origem_lead, campanha_id,
         to_char(data, 'YYYY-MM') as mes, count(*) as vendas,
         sum(coalesce(valor_fechado, valor, 0)) as faturamento
    from public.vendas where origem_lead is not null group by 1,2,3,4,5
),
perdidas as (
  select empresa, owner_id, origem_lead, campanha_id,
         to_char(created_at, 'YYYY-MM') as mes, count(*) as perdidas
    from public.oportunidades
   where origem_lead is not null and etapa = 'Perdidos' group by 1,2,3,4,5
),
base as (
  select
    coalesce(l.empresa, f.empresa, p.empresa)             as empresa,
    coalesce(l.owner_id, f.owner_id, p.owner_id)          as owner_id,
    coalesce(l.origem_lead, f.origem_lead, p.origem_lead) as origem_lead,
    coalesce(l.campanha_id, f.campanha_id, p.campanha_id) as campanha_id,
    coalesce(l.mes, f.mes, p.mes)                         as mes,
    coalesce(l.leads, 0) as leads, coalesce(f.vendas, 0) as vendas,
    coalesce(f.faturamento, 0) as faturamento, coalesce(p.perdidas, 0) as perdidas
  from leads l
  full join fechadas f
    on  f.empresa = l.empresa and f.owner_id = l.owner_id
    and f.origem_lead = l.origem_lead and f.mes = l.mes
    and f.campanha_id is not distinct from l.campanha_id
  full join perdidas p
    on  p.empresa = coalesce(l.empresa, f.empresa)
    and p.owner_id = coalesce(l.owner_id, f.owner_id)
    and p.origem_lead = coalesce(l.origem_lead, f.origem_lead)
    and p.mes = coalesce(l.mes, f.mes)
    and p.campanha_id is not distinct from coalesce(l.campanha_id, f.campanha_id)
)
select
  b.empresa, b.owner_id, b.origem_lead, b.campanha_id, b.mes,
  b.leads, b.vendas, b.faturamento, b.perdidas,
  pr.nome as vendedor, cm.nome as campanha, cm.orcamento as investido,
  -- conversão sobre o que foi DECIDIDO (fechou + perdeu), não sobre os leads
  -- recebidos: lead ainda em negociação não é acerto nem erro, e contá-lo como
  -- erro puniria justamente quem tem muita coisa em aberto
  case when (b.vendas + b.perdidas) > 0
       then round(100.0 * b.vendas / (b.vendas + b.perdidas), 1) else null end as conversao_pct,
  case when cm.orcamento is not null and cm.orcamento > 0
       then round(b.faturamento / cm.orcamento, 2) else null end as retorno_sobre_investido
from base b
left join public.profiles pr on pr.id = b.owner_id
left join public.campanhas_marketing cm on cm.id = b.campanha_id;

comment on view public.retorno_por_origem is
  'Leads, vendas, faturamento, perdas e conversao por origem, por vendedor e por mes. Base unica do painel do vendedor, do gestor e do relatorio do marketing.';
