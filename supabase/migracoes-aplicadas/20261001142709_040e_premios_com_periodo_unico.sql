-- 20261001142709 040e_premios_com_periodo_unico

-- Os indices anteriores eram PARCIAIS (where escopo = 'mensal'), e upsert com
-- lista de colunas nao alcanca indice parcial - a gravacao do premio falhava
-- com "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Em vez de mes e ano separados, uma coluna periodo:
-- 'YYYY-MM' quando mensal, 'YYYY' quando anual. Colunas simples, indice
-- normal, upsert direto. A tabela nasceu vazia nesta sequencia, entao
-- reconstruir nao perde nada.
drop table if exists public.premios;

create table public.premios (
  id          uuid primary key default gen_random_uuid(),
  empresa     text not null,
  escopo      text not null check (escopo in ('mensal', 'anual')),
  -- 'YYYY-MM' para o brinde do mes, 'YYYY' para o premio do fim do ano
  periodo     text not null,
  descricao   text not null,
  vencedor_id uuid references public.profiles(id) on delete set null,
  -- congela o placar do momento da apuracao: lancamento novo depois disso nao
  -- reescreve a historia de quem ganhou
  pontos_na_apuracao numeric,
  entregue    boolean not null default false,
  definido_por uuid references public.profiles(id) on delete set null,
  criado_em   timestamptz not null default now(),
  constraint premio_periodo_no_formato check (
    (escopo = 'mensal' and periodo ~ '^\d{4}-\d{2}$') or
    (escopo = 'anual'  and periodo ~ '^\d{4}$')
  )
);

create unique index premio_unico_por_periodo
  on public.premios (empresa, escopo, periodo);

alter table public.premios enable row level security;

-- Todos veem: a premiacao so motiva se a equipe souber o que esta em jogo.
create policy "Equipe ve os premios"
  on public.premios for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor define os premios"
  on public.premios for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));
