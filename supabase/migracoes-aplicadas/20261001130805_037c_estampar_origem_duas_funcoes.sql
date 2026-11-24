-- 20261001130805 037c_estampar_origem_duas_funcoes

-- Duas funcoes em vez de uma com desvio por TG_TABLE_NAME.
-- Motivo, aprendido na pratica: PL/pgSQL nao faz curto-circuito na RESOLUCAO
-- do campo. A expressao "TG_TABLE_NAME = 'vendas' and new.oportunidade_id is
-- not null" estourava com "record new has no field oportunidade_id" ao inserir
-- em oportunidades, o que derrubava a criacao de qualquer oportunidade. Cada
-- funcao agora toca apenas campos que existem na sua tabela.

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

-- Vendas: tenta primeiro pela oportunidade (que ja foi estampada no nascimento
-- dela) e so depois pelo lead, porque a oportunidade e o retrato mais proximo
-- do negocio que de fato fechou.
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

drop trigger if exists vendas_estampa_origem on public.vendas;
create trigger vendas_estampa_origem
  before insert on public.vendas
  for each row execute function public.estampar_origem_da_venda();
