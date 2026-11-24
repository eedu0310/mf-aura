-- 20261016164932 085_venda_igual_no_mesmo_dia

-- 085: a mesma venda não pode entrar duas vezes, e venda sem negócio cria o negócio.
-- (Comentários completos em supabase/migrations/085 no repositório.)

create or replace function public.impedir_venda_igual_no_dia()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existente uuid;
begin
  select v.id into v_existente
  from public.vendas v
  where v.owner_id = new.owner_id
    and v.data = new.data
    and coalesce(v.valor_fechado, v.valor) = coalesce(new.valor_fechado, new.valor)
    and (
      (new.relacionamento_id is not null and v.relacionamento_id = new.relacionamento_id)
      or (new.relacionamento_id is null and lower(trim(v.cliente)) = lower(trim(new.cliente)))
    )
    and v.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existente is not null then
    raise exception
      'Este cliente já tem uma venda igual registrada hoje (mesmo valor). Se for outra venda, use produto ou data diferente.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

-- "trg_0_": os BEFORE disparam em ordem alfabética; a trava corre antes de
-- qualquer gatilho que crie negócio ou mande aviso para uma venda recusada.
create or replace trigger trg_0_impedir_venda_igual_no_dia
  before insert on public.vendas
  for each row execute function public.impedir_venda_igual_no_dia();

-- Venda sem negócio aberto passa a CRIAR o negócio em Fechamento, com o valor
-- e o produto da venda, e grava o oportunidade_id de volta. BEFORE para poder
-- escrever em new.
create or replace function public.aura_venda_fecha_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
begin
  if new.oportunidade_id is not null or new.relacionamento_id is not null then
    v_op := public.aura_avancar_oportunidade(
      new.oportunidade_id, new.relacionamento_id, 'fechamento',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'),
      true);
    if v_op is not null then
      if new.oportunidade_id is null then new.oportunidade_id := v_op; end if;
      update oportunidades
         set valor = case when coalesce(valor, 0) = 0 then coalesce(new.valor_fechado, new.valor) else valor end,
             produto = coalesce(produto, new.produto),
             updated_at = now()
       where id = v_op;
    end if;
  end if;
  if new.relacionamento_id is not null then
    update relacionamentos set temperatura = 'quente', ultimo_contato_em = now(), updated_at = now()
     where id = new.relacionamento_id;
  end if;
  return new;
end;
$$;

create or replace trigger trg_aura_venda_fecha_pipeline
  before insert on public.vendas
  for each row execute function public.aura_venda_fecha_pipeline();
