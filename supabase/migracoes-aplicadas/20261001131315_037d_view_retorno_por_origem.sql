-- 20261001131315 037d_view_retorno_por_origem

create or replace view public.retorno_por_origem
with (security_invoker = on) as
with leads as (
  select empresa, origem_lead, campanha_id,
         to_char(created_at, 'YYYY-MM') as mes,
         count(*) as leads
    from public.relacionamentos
   where origem_lead is not null
   group by 1,2,3,4
),
fechadas as (
  select empresa, origem_lead, campanha_id,
         to_char(data, 'YYYY-MM') as mes,
         count(*) as vendas,
         sum(coalesce(valor_fechado, valor, 0)) as faturamento
    from public.vendas
   where origem_lead is not null
   group by 1,2,3,4
),
perdidas as (
  select empresa, origem_lead, campanha_id,
         to_char(created_at, 'YYYY-MM') as mes,
         count(*) as perdidas
    from public.oportunidades
   where origem_lead is not null and etapa = 'Perdidos'
   group by 1,2,3,4
)
select
  coalesce(l.empresa, f.empresa, p.empresa)             as empresa,
  coalesce(l.origem_lead, f.origem_lead, p.origem_lead) as origem_lead,
  coalesce(l.campanha_id, f.campanha_id, p.campanha_id) as campanha_id,
  coalesce(l.mes, f.mes, p.mes)                         as mes,
  coalesce(l.leads, 0)                                  as leads,
  coalesce(f.vendas, 0)                                 as vendas,
  coalesce(f.faturamento, 0)                            as faturamento,
  coalesce(p.perdidas, 0)                               as perdidas,
  case when coalesce(l.leads, 0) > 0
       then round(100.0 * coalesce(f.vendas, 0) / l.leads, 1)
       else null end                                    as conversao_pct,
  cm.nome                                               as campanha,
  cm.orcamento                                          as investido,
  case when cm.orcamento is not null and cm.orcamento > 0
       then round(coalesce(f.faturamento, 0) / cm.orcamento, 2)
       else null end                                    as retorno_sobre_investido
from leads l
full join fechadas f
  on  f.empresa = l.empresa and f.origem_lead = l.origem_lead
  and f.mes = l.mes and f.campanha_id is not distinct from l.campanha_id
full join perdidas p
  on  p.empresa = coalesce(l.empresa, f.empresa)
  and p.origem_lead = coalesce(l.origem_lead, f.origem_lead)
  and p.mes = coalesce(l.mes, f.mes)
  and p.campanha_id is not distinct from coalesce(l.campanha_id, f.campanha_id)
left join public.campanhas_marketing cm
  on cm.id = coalesce(l.campanha_id, f.campanha_id, p.campanha_id);

comment on view public.retorno_por_origem is
  'Leads, vendas, faturamento e perdas por origem e por mes. Base unica da planilha do Meu Dia, do painel do gestor e do relatorio do marketing.';
