-- 116 — Lixeira de leads.
--
-- O botão "Excluir" da tela Leads (e a exclusão de contato na tela do Site)
-- apagavam o lead de vez. Em 25/11/2026 uma vendedora excluiu 43 leads da
-- própria lista e só deu para saber quais pelo backup da noite anterior.
--
-- A exclusão continua valendo (o dono quer que o que a equipe exclui fique
-- excluído), mas agora o banco guarda uma cópia do lead na hora em que ele
-- sai, venha de onde vier: tela, rota do servidor ou SQL. O gestor vê quem
-- excluiu, quando e de onde o lead veio, e pode restaurar se foi engano.
--
-- Uma tabela à parte (e não um "excluído = sim" na própria leads_recebidos)
-- para nenhuma das dezenas de consultas de leads precisar mudar.

create table if not exists public.leads_lixeira (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  empresa text,
  nome text,
  origem text,
  status text,
  vendedor_id uuid,
  dados jsonb not null,
  excluido_em timestamptz not null default now(),
  excluido_por uuid,
  -- "tela" quando veio de um login; "sistema" quando veio do servidor;
  -- "backup" para os que entraram depois, recuperados do backup da noite.
  como text not null default 'tela',
  restaurado_em timestamptz,
  restaurado_por uuid
);

create index if not exists leads_lixeira_empresa_idx on public.leads_lixeira (empresa, excluido_em desc);
create index if not exists leads_lixeira_lead_idx on public.leads_lixeira (lead_id);

alter table public.leads_lixeira enable row level security;

-- Gestor da loja vê a lixeira da loja; o mestre, todas. Ninguém grava direto:
-- quem grava é o gatilho e a função de restaurar.
drop policy if exists leads_lixeira_gestor on public.leads_lixeira;
create policy leads_lixeira_gestor on public.leads_lixeira
  for select to authenticated
  using (public.administro_a_loja(empresa));

create or replace function public.aura_guardar_lead_na_lixeira()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.leads_lixeira (lead_id, empresa, nome, origem, status, vendedor_id, dados, excluido_por, como)
  values (old.id, old.empresa, old.nome, old.origem, old.status, old.vendedor_id, to_jsonb(old), auth.uid(),
          case when auth.uid() is null then 'sistema' else 'tela' end);
  return old;
end;
$function$;
revoke all on function public.aura_guardar_lead_na_lixeira() from public, anon, authenticated;

drop trigger if exists trg_leads_lixeira on public.leads_recebidos;
create trigger trg_leads_lixeira
  before delete on public.leads_recebidos
  for each row execute function public.aura_guardar_lead_na_lixeira();

-- Restaurar: devolve o lead com o MESMO id. Só as colunas que estão na cópia
-- (coluna criada depois da exclusão fica com o padrão dela).
create or replace function public.aura_restaurar_lead(p_lixeira uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l public.leads_lixeira%rowtype;
  colunas text;
begin
  select * into l from public.leads_lixeira where id = p_lixeira;
  if l.id is null then
    raise exception 'Este lead não está na lixeira.';
  end if;
  if not public.administro_a_loja(l.empresa) then
    raise exception 'Só o gestor da loja restaura este lead.';
  end if;
  if l.restaurado_em is not null then
    raise exception 'Este lead já foi restaurado.';
  end if;
  if exists (select 1 from public.leads_recebidos where id = l.lead_id) then
    raise exception 'Este lead já está na lista de leads.';
  end if;

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position)
    into colunas
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'leads_recebidos'
     and l.dados ? c.column_name;

  execute format(
    'insert into public.leads_recebidos (%1$s) select %1$s from jsonb_populate_record(null::public.leads_recebidos, $1)',
    colunas
  ) using l.dados;

  update public.leads_lixeira
     set restaurado_em = now(), restaurado_por = auth.uid()
   where id = l.id;

  return jsonb_build_object('ok', true, 'lead_id', l.lead_id);
end;
$function$;
revoke all on function public.aura_restaurar_lead(uuid) from public, anon;
grant execute on function public.aura_restaurar_lead(uuid) to authenticated;
