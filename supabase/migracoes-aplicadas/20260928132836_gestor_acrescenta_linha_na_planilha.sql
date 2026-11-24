-- 20260928132836 gestor_acrescenta_linha_na_planilha

-- O gestor acrescenta linhas na planilha mensal do vendedor.
--
-- As nove linhas da planilha estavam escritas no componente. O gestor pediu
-- para poder medir outras coisas sem depender de alguém mexer no código, e
-- cada loja mede coisas diferentes — por isso a linha é da empresa, não do
-- sistema inteiro.
--
-- Desligar em vez de apagar: o mês que já foi preenchido continua tendo a
-- linha, senão o histórico perde a coluna no meio do ano.
create table if not exists planilha_linhas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (empresa, titulo)
);

alter table planilha_linhas enable row level security;

-- Quem é da loja vê as linhas dela; gestor e diretor veem todas, porque o
-- painel consolidado mostra as quatro lojas lado a lado.
create policy planilha_linhas_leitura on planilha_linhas
  for select
  using (
    empresa = minha_empresa()
    or meu_cargo() = any (array['Gestor', 'Diretor', 'Marketing'])
  );

create policy planilha_linhas_gestor_escreve on planilha_linhas
  for all
  using (meu_cargo() = any (array['Gestor', 'Diretor']))
  with check (meu_cargo() = any (array['Gestor', 'Diretor']));

create index if not exists idx_planilha_linhas_empresa on planilha_linhas (empresa, ativo, ordem);
