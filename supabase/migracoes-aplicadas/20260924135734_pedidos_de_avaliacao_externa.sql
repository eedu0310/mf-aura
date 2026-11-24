-- 20260924135734 pedidos_de_avaliacao_externa

-- Onde o gestor guarda os links de avaliação de cada loja.
create table if not exists config_avaliacao (
  empresa text primary key,
  link_google text,
  link_instagram text,
  link_facebook text,
  mensagem_padrao text default 'Oi {cliente}! Foi um prazer te atender. Se puder deixar sua avaliação, ajuda muito a gente: {link}',
  atualizado_em timestamptz not null default now()
);

-- Um pedido por venda. O token vira um link curto nosso, que redireciona
-- para o Google — é assim que dá para saber que o cliente realmente abriu,
-- em vez de acreditar no "eu mandei".
create table if not exists pedidos_avaliacao (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references vendas(id) on delete cascade,
  vendedor_id uuid,
  empresa text not null,
  cliente text,
  telefone text,
  token uuid not null unique default gen_random_uuid(),
  canal text not null default 'google' check (canal in ('google','instagram','facebook')),
  enviado_em timestamptz,
  aberto_em timestamptz,
  confirmado_em timestamptz,
  confirmado_por uuid,
  criado_em timestamptz not null default now()
);

create index if not exists pedidos_avaliacao_vendedor_idx on pedidos_avaliacao (vendedor_id, criado_em desc);
create index if not exists pedidos_avaliacao_pendente_idx on pedidos_avaliacao (vendedor_id) where enviado_em is null;

-- Toda venda nasce com o pedido de avaliação pendente para o vendedor.
create or replace function aura_criar_pedido_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente text;
  v_telefone text;
begin
  select r.nome, r.telefone into v_cliente, v_telefone
  from relacionamentos r where r.id = new.relacionamento_id;

  insert into pedidos_avaliacao (venda_id, vendedor_id, empresa, cliente, telefone)
  values (new.id, new.owner_id, new.empresa,
          coalesce(v_cliente, new.cliente), v_telefone);
  return new;
end;
$$;

drop trigger if exists trg_aura_criar_pedido_avaliacao on vendas;
create trigger trg_aura_criar_pedido_avaliacao
  after insert on vendas
  for each row execute function aura_criar_pedido_avaliacao();

revoke execute on function public.aura_criar_pedido_avaliacao() from anon, authenticated;

alter table config_avaliacao enable row level security;
alter table pedidos_avaliacao enable row level security;

-- O vendedor enxerga e atualiza só os pedidos dele; o gestor vê o grupo todo.
create policy pedidos_avaliacao_ler on pedidos_avaliacao
  for select using (vendedor_id = auth.uid() or meu_cargo() = 'Gestor');
create policy pedidos_avaliacao_atualizar on pedidos_avaliacao
  for update using (vendedor_id = auth.uid() or meu_cargo() = 'Gestor')
  with check (vendedor_id = auth.uid() or meu_cargo() = 'Gestor');

-- Os links todo mundo lê (precisa para montar a mensagem), só o gestor muda.
create policy config_avaliacao_ler on config_avaliacao for select using (true);
create policy config_avaliacao_escrever on config_avaliacao
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
