-- Pós-venda automático, histórico e avaliação do cliente.
create table if not exists public.pos_vendas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null unique references public.vendas(id) on delete cascade,
  empresa text not null,
  status text not null default 'aguardando_instalacao',
  data_agendamento date,
  hora_agendamento time,
  observacao text,
  reclamacao text,
  reclamacao_resolvida boolean not null default false,
  avaliou_loja boolean not null default false,
  nota_avaliacao integer check (nota_avaliacao between 1 and 5),
  comentario_avaliacao text,
  token_avaliacao uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_venda_notas (
  id uuid primary key default gen_random_uuid(),
  pos_venda_id uuid not null references public.pos_vendas(id) on delete cascade,
  autor_nome text,
  texto text not null,
  created_at timestamptz not null default now()
);

alter table public.pos_vendas enable row level security;
alter table public.pos_venda_notas enable row level security;

drop policy if exists "Usuários consultam pós-vendas da empresa" on public.pos_vendas;
create policy "Usuários consultam pós-vendas da empresa" on public.pos_vendas for select
using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));
drop policy if exists "Usuários atualizam pós-vendas da empresa" on public.pos_vendas;
create policy "Usuários atualizam pós-vendas da empresa" on public.pos_vendas for update
using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));
drop policy if exists "Usuários consultam notas da empresa" on public.pos_venda_notas;
create policy "Usuários consultam notas da empresa" on public.pos_venda_notas for select
using (exists (select 1 from public.pos_vendas pv where pv.id = pos_venda_id and pv.empresa = (select p.empresa from public.profiles p where p.id = auth.uid())));
drop policy if exists "Usuários criam notas da empresa" on public.pos_venda_notas;
create policy "Usuários criam notas da empresa" on public.pos_venda_notas for insert
with check (exists (select 1 from public.pos_vendas pv where pv.id = pos_venda_id and pv.empresa = (select p.empresa from public.profiles p where p.id = auth.uid())));

create or replace function public.criar_pos_venda_apos_venda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pos_vendas (venda_id, empresa)
  values (new.id, new.empresa)
  on conflict (venda_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_criar_pos_venda_apos_venda on public.vendas;
create trigger trg_criar_pos_venda_apos_venda
after insert on public.vendas for each row execute function public.criar_pos_venda_apos_venda();

-- Função usada pela página pública de avaliação.
create or replace function public.registrar_avaliacao_publica(p_token uuid, p_nota integer, p_comentario text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.pos_vendas
  set avaliou_loja = true, nota_avaliacao = p_nota, comentario_avaliacao = p_comentario, updated_at = now()
  where token_avaliacao = p_token and p_nota between 1 and 5;
  return found;
end;
$$;

insert into public.pos_vendas (venda_id, empresa)
select v.id, v.empresa from public.vendas v
where not exists (select 1 from public.pos_vendas pv where pv.venda_id = v.id);

grant execute on function public.registrar_avaliacao_publica(uuid, integer, text) to anon, authenticated;
