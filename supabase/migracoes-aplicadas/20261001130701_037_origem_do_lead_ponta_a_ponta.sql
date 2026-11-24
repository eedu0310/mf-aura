-- 20261001130701 037_origem_do_lead_ponta_a_ponta

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

create index if not exists vendas_por_origem
  on public.vendas (empresa, origem_lead, data desc);
create index if not exists atividades_por_origem
  on public.atividades (empresa, origem_lead, created_at desc);
create index if not exists oportunidades_por_origem
  on public.oportunidades (empresa, origem_lead, etapa);

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

  if to_jsonb(new) ? 'oportunidade_id' and new.oportunidade_id is not null then
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
  for each row execute function public.estampar_origem_do_lead();
