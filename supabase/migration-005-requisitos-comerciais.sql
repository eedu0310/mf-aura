-- Requisitos comerciais: granularidade de atividades, fechamento de vendas,
-- ranking por empresa e transferência/desativação de vendedores.

alter table public.atividades add column if not exists subtipo text;
alter table public.atividades add column if not exists objetivo text;
alter table public.atividades add column if not exists resultado text;
alter table public.atividades add column if not exists proximo_passo text;
alter table public.atividades add column if not exists observacao text;
alter table public.atividades add column if not exists ocorrida_em timestamptz;
alter table public.atividades add column if not exists proximo_contato_em timestamptz;
alter table public.atividades add column if not exists relacionamento_id uuid;
alter table public.atividades add column if not exists cliente_nome text;
alter table public.atividades add column if not exists cliente_telefone text;
alter table public.atividades add column if not exists cliente_email text;
alter table public.atividades add column if not exists cliente_categoria text;
alter table public.atividades add column if not exists latitude numeric;
alter table public.atividades add column if not exists longitude numeric;
alter table public.atividades add column if not exists precisao_metros numeric;
alter table public.atividades add column if not exists endereco text;
alter table public.atividades add column if not exists localizacao_capturada_em timestamptz;
alter table public.atividades add column if not exists origem_dispositivo text;
alter table public.atividades add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.vendas add column if not exists valor_original numeric;
alter table public.vendas add column if not exists valor_fechado numeric;
alter table public.vendas add column if not exists desconto_valor numeric not null default 0;
alter table public.vendas add column if not exists desconto_percentual numeric not null default 0;
alter table public.vendas add column if not exists quantidade_parcelas integer not null default 1;
alter table public.vendas add column if not exists valor_parcela numeric;
alter table public.vendas add column if not exists entrada_valor numeric not null default 0;
alter table public.vendas add column if not exists taxa_financeira numeric not null default 0;
alter table public.vendas add column if not exists comissao_base numeric;
alter table public.vendas add column if not exists comissao_percentual numeric;
alter table public.vendas add column if not exists comissao_valor numeric;
alter table public.vendas add column if not exists relacionamento_id uuid;
alter table public.vendas add column if not exists oportunidade_id uuid;
alter table public.vendas add column if not exists indicador_id uuid;
alter table public.vendas add column if not exists loja text;
alter table public.vendas add column if not exists status text;
alter table public.vendas add column if not exists descricao text;

update public.vendas
set valor_fechado = coalesce(valor_fechado, valor),
    valor_original = coalesce(valor_original, valor),
    comissao_base = coalesce(comissao_base, valor_fechado, valor)
where valor_fechado is null or valor_original is null or comissao_base is null;

create index if not exists atividades_empresa_tipo_subtipo_idx on public.atividades (empresa, tipo, subtipo);
create index if not exists vendas_empresa_data_pagamento_idx on public.vendas (empresa, data, forma_pagamento);

-- Permite que usuários da mesma empresa consultem nomes para o ranking.
-- As métricas continuam limitadas pela empresa e pelas políticas das tabelas.
drop policy if exists "Perfis visíveis para ranking da empresa" on public.profiles;
create policy "Perfis visíveis para ranking da empresa"
  on public.profiles for select
  using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));

-- Tabela opcional para registrar transferência de carteira sem apagar histórico.
create table if not exists public.transferencias_carteira (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  usuario_origem_id uuid not null references auth.users(id),
  usuario_destino_id uuid not null references auth.users(id),
  criado_por uuid not null references auth.users(id),
  motivo text,
  relacionamentos_transferidos integer not null default 0,
  oportunidades_transferidas integer not null default 0,
  desativou_origem boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.transferencias_carteira enable row level security;
create policy "Gestor registra transferência da própria empresa"
  on public.transferencias_carteira for insert
  with check (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()) and criado_por = auth.uid());
create policy "Gestor consulta transferências da própria empresa"
  on public.transferencias_carteira for select
  using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));
