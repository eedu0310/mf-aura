-- ============================================================================
-- 037 — De onde veio o lead, ponta a ponta
--
-- Objetivo: saber, em cada atividade e em cada venda, se aquilo nasceu de
-- procura na loja, de indicação passada pela MF (a fábrica), de campanha de
-- marketing, ou da prospecção do próprio vendedor. Sem isso não há como dizer
-- ao marketing o que foi investido e o que voltou.
--
-- POR QUE UMA COLUNA NOVA, E NÃO A "origem" QUE JÁ EXISTE
-- A coluna atividades.origem já está ocupada com outro significado: ela guarda
-- QUAL PARTE DO SISTEMA criou o registro ('whatsapp_ia', 'whatsapp_auto'), e
-- não de onde o lead veio comercialmente. Em relacionamentos.origem há uma
-- mistura ('WhatsApp', 'Marketing') — canal de contato junto com origem — e em
-- vendas.origem está tudo nulo. Reaproveitar esses campos misturaria
-- "quem escreveu a linha" com "de onde veio o negócio", e os números do
-- marketing nasceriam errados. Por isso: campo novo, vocabulário fechado.
--
-- COMO A ORIGEM ANDA PELO SISTEMA
-- A verdade mora no lead (relacionamentos). Dali ela é ESTAMPADA na
-- oportunidade, na atividade e na venda no momento em que cada uma nasce.
-- Estampada, não lida por join, de propósito: se amanhã alguém corrigir a
-- origem do lead, a venda do mês passado continua contando no lugar onde foi
-- contada. Relatório fechado não muda sozinho.
-- ============================================================================

-- loja       — cliente procurou a loja
-- mf         — indicação que veio da MF International (fábrica)
-- marketing  — campanha (o campanha_id diz qual)
-- proprio    — prospecção do próprio vendedor
-- indicacao  — indicação de cliente/parceiro
do $$
begin
  if not exists (select 1 from pg_type where typname = 'origem_lead') then
    create type public.origem_lead as enum
      ('loja', 'mf', 'marketing', 'proprio', 'indicacao');
  end if;
end $$;

alter table public.relacionamentos
  add column if not exists origem_lead public.origem_lead,
  add column if not exists campanha_id uuid references public.campanhas_marketing(id) on delete set null;

alter table public.oportunidades
  add column if not exists origem_lead public.origem_lead,
  add column if not exists campanha_id uuid references public.campanhas_marketing(id) on delete set null;

alter table public.atividades
  add column if not exists origem_lead public.origem_lead,
  add column if not exists campanha_id uuid references public.campanhas_marketing(id) on delete set null;

alter table public.vendas
  add column if not exists origem_lead public.origem_lead,
  add column if not exists campanha_id uuid references public.campanhas_marketing(id) on delete set null;

-- A planilha do Meu Dia e o relatório do marketing leem sempre por
-- empresa + origem + mês, então o índice acompanha esse caminho.
create index if not exists vendas_por_origem
  on public.vendas (empresa, origem_lead, data desc);
create index if not exists atividades_por_origem
  on public.atividades (empresa, origem_lead, created_at desc);
create index if not exists oportunidades_por_origem
  on public.oportunidades (empresa, origem_lead, etapa);

-- ---------------------------------------------------------------------------
-- Estampa da origem: cada filha copia do lead no momento em que nasce.
-- Se quem inseriu já informou a origem, respeitamos — o vendedor pode estar
-- registrando uma atividade cuja origem ele conhece melhor que o cadastro.
-- ---------------------------------------------------------------------------
-- DUAS funcoes, nao uma com desvio por TG_TABLE_NAME.
-- Motivo descoberto testando: PL/pgSQL nao faz curto-circuito na RESOLUCAO do
-- campo. "TG_TABLE_NAME = 'vendas' and new.oportunidade_id is not null"
-- estourava com 'record new has no field oportunidade_id' ao inserir em
-- oportunidades, o que derrubava a criacao de QUALQUER oportunidade. Cada
-- funcao abaixo toca apenas campos que existem na sua tabela.

-- Oportunidades e atividades: a origem vem do lead.
create or replace function public.estampar_origem_do_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.origem_lead;
  c uuid;
begin
  if new.origem_lead is not null then
    return new;
  end if;
  if new.relacionamento_id is not null then
    select origem_lead, campanha_id into o, c
      from public.relacionamentos where id = new.relacionamento_id;
  end if;
  new.origem_lead := o;
  if new.campanha_id is null then
    new.campanha_id := c;
  end if;
  return new;
end;
$$;

-- Vendas: tenta primeiro pela oportunidade (ja estampada quando nasceu) e so
-- depois pelo lead, porque a oportunidade e o retrato mais proximo do negocio
-- que de fato fechou.
create or replace function public.estampar_origem_da_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.origem_lead;
  c uuid;
begin
  if new.origem_lead is not null then
    return new;
  end if;
  if new.oportunidade_id is not null then
    select origem_lead, campanha_id into o, c
      from public.oportunidades where id = new.oportunidade_id;
  end if;
  if o is null and new.relacionamento_id is not null then
    select origem_lead, campanha_id into o, c
      from public.relacionamentos where id = new.relacionamento_id;
  end if;
  new.origem_lead := o;
  if new.campanha_id is null then
    new.campanha_id := c;
  end if;
  return new;
end;
$$;

drop trigger if exists oportunidades_estampa_origem on public.oportunidades;
create trigger oportunidades_estampa_origem
  before insert on public.oportunidades
  for each row execute function public.estampar_origem_do_lead();

drop trigger if exists atividades_estampa_origem on public.atividades;
create trigger atividades_estampa_origem
  before insert on public.atividades
  for each row execute function public.estampar_origem_do_lead();

drop trigger if exists vendas_estampa_origem on public.vendas;
create trigger vendas_estampa_origem
  before insert on public.vendas
  for each row execute function public.estampar_origem_da_venda();

-- ---------------------------------------------------------------------------
-- Retorno por origem: o que entrou de lead, o que virou venda, quanto faturou,
-- e — quando a origem é campanha — quanto foi investido para isso.
-- É uma view para a conta ser sempre a mesma na planilha do vendedor, no painel
-- do gestor e no relatório do marketing. Três telas lendo a mesma verdade.
-- ---------------------------------------------------------------------------
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
  coalesce(l.empresa, f.empresa, p.empresa)                as empresa,
  coalesce(l.origem_lead, f.origem_lead, p.origem_lead)    as origem_lead,
  coalesce(l.campanha_id, f.campanha_id, p.campanha_id)    as campanha_id,
  coalesce(l.mes, f.mes, p.mes)                            as mes,
  coalesce(l.leads, 0)                                     as leads,
  coalesce(f.vendas, 0)                                    as vendas,
  coalesce(f.faturamento, 0)                               as faturamento,
  coalesce(p.perdidas, 0)                                  as perdidas,
  -- conversão só faz sentido quando houve lead no período
  case when coalesce(l.leads, 0) > 0
       then round(100.0 * coalesce(f.vendas, 0) / l.leads, 1)
       else null end                                       as conversao_pct,
  cm.nome                                                  as campanha,
  cm.orcamento                                             as investido,
  -- retorno sobre o investido: só quando existe orçamento, para não dividir por zero
  case when cm.orcamento is not null and cm.orcamento > 0
       then round(coalesce(f.faturamento, 0) / cm.orcamento, 2)
       else null end                                       as retorno_sobre_investido
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
