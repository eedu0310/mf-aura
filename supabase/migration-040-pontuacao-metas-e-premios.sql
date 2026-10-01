-- ============================================================================
-- 040 — Pontuação da prospecção, acumulado do ano e prêmios
--
-- A meta por vendedor NÃO precisou de tabela nova: metas_indicadores já tinha o
-- grão certo (vendedor_id, mes, metrica) e até as métricas por origem
-- (leads_loja, leads_mf, leads_marketing e os faturamentos/vendas
-- equivalentes). Aqui só acrescentamos a métrica da prospecção e as duas
-- origens que faltavam para bater com o enum origem_lead.
--
-- O que é novo de fato: pontos por etapa e por atividade ajustáveis mês a mês,
-- o acumulado do ano (o ranking existente só olhava o mês) e o registro do
-- prêmio mensal e do anual.
-- ============================================================================

-- Pontos de cada coisa. mes = 'padrao' é a regra usada em todo mês que não tiver
-- regra própria — assim o gestor ajusta um mês sem recadastrar os outros, e um
-- mês esquecido não zera a pontuação da equipe.
--
-- Atenção ao índice: a primeira versão usava COALESCE(mes,''), uma expressão.
-- Upsert com lista de colunas (onConflict) não alcança índice de expressão, e a
-- gravação da regra falhava silenciosamente. Daí a sentinela e o índice normal.
create table if not exists public.pontuacao_regras (
  id        uuid primary key default gen_random_uuid(),
  empresa   text not null,
  mes       text not null default 'padrao',   -- 'YYYY-MM' ou 'padrao'
  tipo      text not null check (tipo in ('atividade', 'etapa')),
  chave     text not null,                    -- 'Visita', 'Ligação', 'Proposta'...
  pontos    numeric not null default 0 check (pontos >= 0),
  criado_em timestamptz not null default now()
);

create unique index if not exists pontuacao_regras_unica
  on public.pontuacao_regras (empresa, mes, tipo, chave);

comment on column public.pontuacao_regras.mes is
  'YYYY-MM para a regra de um mes especifico, ou ''padrao'' para a regra usada em todo mes sem regra propria.';

-- Prêmios: o brinde do mês e o prêmio maior do fim do ano.
--
-- Uma coluna 'periodo' em vez de mes e ano separados, e índice normal em vez de
-- índices parciais por escopo: upsert por colunas não alcança índice parcial, e
-- a gravação do prêmio falhava com "no unique or exclusion constraint matching
-- the ON CONFLICT specification".
create table if not exists public.premios (
  id          uuid primary key default gen_random_uuid(),
  empresa     text not null,
  escopo      text not null check (escopo in ('mensal', 'anual')),
  periodo     text not null,            -- 'YYYY-MM' quando mensal, 'YYYY' quando anual
  descricao   text not null,
  vencedor_id uuid references public.profiles(id) on delete set null,
  -- congela o placar da apuração: lançamento novo depois disso não reescreve a
  -- história de quem ganhou
  pontos_na_apuracao numeric,
  entregue    boolean not null default false,
  definido_por uuid references public.profiles(id) on delete set null,
  criado_em   timestamptz not null default now(),
  constraint premio_periodo_no_formato check (
    (escopo = 'mensal' and periodo ~ '^\d{4}-\d{2}$') or
    (escopo = 'anual'  and periodo ~ '^\d{4}$')
  )
);

create unique index if not exists premio_unico_por_periodo
  on public.premios (empresa, escopo, periodo);

alter table public.pontuacao_regras enable row level security;
alter table public.premios enable row level security;

-- Todos veem regras e prêmios: a pontuação só motiva se a equipe souber quanto
-- vale cada coisa e o que está em jogo.
drop policy if exists "Equipe ve as regras de pontuacao" on public.pontuacao_regras;
create policy "Equipe ve as regras de pontuacao"
  on public.pontuacao_regras for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor define a pontuacao" on public.pontuacao_regras;
create policy "Gestor define a pontuacao"
  on public.pontuacao_regras for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

drop policy if exists "Equipe ve os premios" on public.premios;
create policy "Equipe ve os premios"
  on public.premios for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor define os premios" on public.premios;
create policy "Gestor define os premios"
  on public.premios for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

-- Métricas de meta: prospeccao_total é o número redondo do mês (lead + ligação
-- + visita). As demais são por origem, no mesmo vocabulário do enum origem_lead.
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

-- ---------------------------------------------------------------------------
-- Pontos por vendedor e mês: atividades registradas mais etapas alcançadas.
--
-- A etapa é contada pela etapa ATUAL da oportunidade, uma vez cada. Contar a
-- passagem por cada etapa exigiria um histórico de movimentação que não existe,
-- e inventar isso daria ponto errado — melhor uma conta simples e honesta do
-- que uma complicada e furada.
-- ---------------------------------------------------------------------------
create or replace view public.pontos_do_mes
with (security_invoker = on) as
with de_atividade as (
  select a.owner_id, a.empresa,
         to_char(a.created_at, 'YYYY-MM') as mes,
         sum(coalesce(r_mes.pontos, r_pad.pontos, 0)) as pontos,
         count(*) as quantidade
    from public.atividades a
    left join public.pontuacao_regras r_mes
           on r_mes.empresa = a.empresa and r_mes.tipo = 'atividade'
          and r_mes.chave = a.tipo and r_mes.mes = to_char(a.created_at, 'YYYY-MM')
    left join public.pontuacao_regras r_pad
           on r_pad.empresa = a.empresa and r_pad.tipo = 'atividade'
          and r_pad.chave = a.tipo and r_pad.mes = 'padrao'
   where a.owner_id is not null
   group by 1,2,3
),
de_etapa as (
  select o.owner_id, o.empresa,
         to_char(coalesce(o.updated_at, o.created_at), 'YYYY-MM') as mes,
         sum(coalesce(r_mes.pontos, r_pad.pontos, 0)) as pontos
    from public.oportunidades o
    left join public.pontuacao_regras r_mes
           on r_mes.empresa = o.empresa and r_mes.tipo = 'etapa'
          and r_mes.chave = o.etapa
          and r_mes.mes = to_char(coalesce(o.updated_at, o.created_at), 'YYYY-MM')
    left join public.pontuacao_regras r_pad
           on r_pad.empresa = o.empresa and r_pad.tipo = 'etapa'
          and r_pad.chave = o.etapa and r_pad.mes = 'padrao'
   where o.owner_id is not null
   group by 1,2,3
)
select
  coalesce(a.owner_id, e.owner_id) as vendedor_id,
  coalesce(a.empresa, e.empresa)   as empresa,
  coalesce(a.mes, e.mes)           as mes,
  coalesce(a.quantidade, 0)        as atividades,
  coalesce(a.pontos, 0)            as pontos_atividades,
  coalesce(e.pontos, 0)            as pontos_etapas,
  coalesce(a.pontos, 0) + coalesce(e.pontos, 0) as pontos
from de_atividade a
full join de_etapa e
  on e.owner_id = a.owner_id and e.empresa = a.empresa and e.mes = a.mes;

-- O acumulado do ano, que decide o prêmio maior de dezembro.
create or replace view public.pontos_do_ano
with (security_invoker = on) as
select p.vendedor_id, p.empresa, left(p.mes, 4) as ano,
       sum(p.pontos) as pontos, sum(p.atividades) as atividades,
       count(distinct p.mes) as meses_com_registro
  from public.pontos_do_mes p
 group by 1,2,3;

-- Regras padrão: pontos que refletem esforço, para o gestor ajustar depois.
insert into public.pontuacao_regras (empresa, mes, tipo, chave, pontos)
select e.empresa, 'padrao', r.tipo, r.chave, r.pontos
from (select distinct empresa from public.profiles where empresa is not null) e
cross join (values
  ('atividade','Visita',10), ('atividade','Prospecção',8), ('atividade','Reunião',8),
  ('atividade','Orçamento',5), ('atividade','Ligação',3), ('atividade','Pós-venda',3),
  ('atividade','Treinamento',2), ('atividade','WhatsApp',1), ('atividade','E-mail',1),
  ('atividade','Outro',1),
  ('etapa','Apresentação',5), ('etapa','Proposta',10),
  ('etapa','Negociação',15), ('etapa','Fechados',30)
) as r(tipo, chave, pontos)
on conflict do nothing;
