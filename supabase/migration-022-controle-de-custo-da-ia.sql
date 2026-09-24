-- Migration 022 — Controle de custo da IA (aplicada em produção)
-- Objetivo: o gestor enxerga quanto a AURA consome, registra depósitos
-- e nunca é pego de surpresa com o saldo zerado.

-- 1) Cada chamada de IA vira uma linha aqui, com o custo já calculado.
create table if not exists ia_uso (
  id uuid primary key default gen_random_uuid(),
  empresa text,
  usuario_id uuid,
  funcao text not null,           -- coach, recados, whatsapp, relatorio...
  modelo text,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists ia_uso_criado_em_idx on ia_uso (criado_em desc);
create index if not exists ia_uso_funcao_idx on ia_uso (funcao);

-- 2) Depósitos de crédito lançados pelo gestor.
create table if not exists ia_creditos (
  id uuid primary key default gen_random_uuid(),
  valor_usd numeric not null check (valor_usd > 0),
  descricao text,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

-- 3) Linha única de configuração (preços por milhão de tokens e alerta).
create table if not exists ia_config (
  id boolean primary key default true check (id),
  preco_entrada_usd numeric not null default 2,
  preco_saida_usd numeric not null default 10,
  alerta_saldo_usd numeric not null default 10,
  bloquear_sem_saldo boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into ia_config (id) values (true) on conflict (id) do nothing;

-- 4) Só o gestor enxerga custo.
alter table ia_uso enable row level security;
alter table ia_creditos enable row level security;
alter table ia_config enable row level security;

create policy ia_uso_gestor on ia_uso
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
create policy ia_creditos_gestor on ia_creditos
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
create policy ia_config_gestor on ia_config
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
