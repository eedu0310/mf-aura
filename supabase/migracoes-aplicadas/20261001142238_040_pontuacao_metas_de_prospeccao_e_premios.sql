-- 20261001142238 040_pontuacao_metas_de_prospeccao_e_premios

-- ============================================================================
-- 040 — Pontuação da prospecção, acumulado do ano e prêmios
--
-- A meta por vendedor ja tinha lugar: metas_indicadores (vendedor_id, mes,
-- metrica, meta) aceita 200 para um representante e 400 para outro, que e
-- exatamente o que foi pedido. Nao criamos tabela nova para isso.
--
-- O que faltava e entra aqui:
--   1. pontos por etapa e por tipo de atividade, ajustaveis mes a mes;
--   2. o acumulado do ano, porque o ranking atual so olha o mes;
--   3. o registro do premio mensal e do premio anual, com o ganhador.
-- ============================================================================

-- Pontos de cada coisa. mes NULL = regra padrao, usada em todo mes que nao
-- tiver regra propria. Assim o gestor ajusta a pontuacao de um mes sem ter de
-- recadastrar tudo nos outros, e um mes esquecido nao zera a pontuacao da
-- equipe - ele cai no padrao.
create table if not exists public.pontuacao_regras (
  id        uuid primary key default gen_random_uuid(),
  empresa   text not null,
  mes       text,                    -- 'YYYY-MM' ou NULL para o padrao
  tipo      text not null check (tipo in ('atividade', 'etapa')),
  chave     text not null,           -- 'Visita', 'Ligação', 'Proposta'...
  pontos    numeric not null default 0 check (pontos >= 0),
  criado_em timestamptz not null default now()
);

create unique index if not exists pontuacao_regras_unica
  on public.pontuacao_regras (empresa, coalesce(mes, ''), tipo, chave);

-- Premios: o brinde do mes (jantar, hospedagem) e o premio maior do fim do ano.
create table if not exists public.premios (
  id          uuid primary key default gen_random_uuid(),
  empresa     text not null,
  escopo      text not null check (escopo in ('mensal', 'anual')),
  mes         text,                  -- 'YYYY-MM' quando mensal
  ano         integer,               -- quando anual
  descricao   text not null,         -- "Jantar para dois", "Hospedagem..."
  vencedor_id uuid references public.profiles(id) on delete set null,
  pontos_na_apuracao numeric,        -- congela o placar do momento da apuracao
  entregue    boolean not null default false,
  definido_por uuid references public.profiles(id) on delete set null,
  criado_em   timestamptz not null default now(),
  -- um premio por escopo e periodo, por loja
  constraint premio_periodo_coerente check (
    (escopo = 'mensal' and mes is not null) or
    (escopo = 'anual'  and ano is not null)
  )
);

create unique index if not exists premio_mensal_unico
  on public.premios (empresa, mes) where escopo = 'mensal';
create unique index if not exists premio_anual_unico
  on public.premios (empresa, ano) where escopo = 'anual';

alter table public.pontuacao_regras enable row level security;
alter table public.premios enable row level security;

-- Todos veem as regras e os premios: a pontuacao so motiva se a equipe souber
-- quanto vale cada coisa e o que esta em jogo.
drop policy if exists "Equipe ve as regras de pontuacao" on public.pontuacao_regras;
create policy "Equipe ve as regras de pontuacao"
  on public.pontuacao_regras for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor define a pontuacao" on public.pontuacao_regras;
create policy "Gestor define a pontuacao"
  on public.pontuacao_regras for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

drop policy if exists "Equipe ve os premios" on public.premios;
create policy "Equipe ve os premios"
  on public.premios for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor define os premios" on public.premios;
create policy "Gestor define os premios"
  on public.premios for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));
