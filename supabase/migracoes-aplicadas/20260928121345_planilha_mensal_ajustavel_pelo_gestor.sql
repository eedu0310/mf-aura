-- 20260928121345 planilha_mensal_ajustavel_pelo_gestor

-- A planilha mensal tinha colunas fixas (faturamento, clientes novos,
-- arquitetos, construtoras, obras, ligações, visitas). Acrescentar uma linha
-- exigia migração e deploy.
--
-- As padrão continuam onde estão — nada quebra. O que o gestor acrescentar
-- vira linha nesta tabela e valor no jsonb `extras` do compromisso.

create table if not exists compromisso_mensal_campos (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  rotulo text not null,
  ajuda text,
  tipo text not null default 'numero' check (tipo in ('numero','moeda','texto')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table compromissos_mensais
  add column if not exists extras jsonb not null default '{}'::jsonb;

comment on column compromissos_mensais.extras is
  'Valores dos campos que o gestor acrescentou, por chave de compromisso_mensal_campos.';

alter table compromisso_mensal_campos enable row level security;

-- O vendedor precisa ler para preencher; só o gestor cria e edita.
create policy campos_extras_ler on compromisso_mensal_campos for select using (true);
create policy campos_extras_gestor on compromisso_mensal_campos
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
