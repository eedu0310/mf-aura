-- 20261001142634 040d_metrica_de_prospeccao_nas_metas

-- metas_indicadores ja tinha as metricas por origem (leads_loja, leads_mf,
-- leads_marketing e os faturamentos/vendas equivalentes), que e exatamente a
-- separacao pedida. Faltavam duas coisas:
--   - a meta de PROSPECCAO do mes, o numero redondo (200 para alguns
--     representantes, 400 para outros) que soma lead, ligacao e visita;
--   - as duas origens que o enum origem_lead tem e aqui nao tinha
--     (prospeccao propria e indicacao), para as duas tabelas falarem a mesma
--     lingua e nao sobrar origem sem meta possivel.
alter table public.metas_indicadores
  drop constraint if exists metas_indicadores_metrica_check;

alter table public.metas_indicadores
  add constraint metas_indicadores_metrica_check check (metrica = any (array[
    'prospeccao_total',
    'leads_loja', 'leads_mf', 'leads_marketing', 'leads_proprio', 'leads_indicacao',
    'faturamento_loja', 'faturamento_mf', 'faturamento_marketing',
      'faturamento_proprio', 'faturamento_indicacao',
    'vendas_loja', 'vendas_mf', 'vendas_marketing',
      'vendas_proprio', 'vendas_indicacao'
  ]));

comment on column public.metas_indicadores.metrica is
  'prospeccao_total e a meta redonda do mes (lead + ligacao + visita). As demais sao por origem, no mesmo vocabulario do enum origem_lead.';
