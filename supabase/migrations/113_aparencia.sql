-- 113 — Aparência do sistema (paleta, fundo do pipeline e datas comemorativas)
--
-- Uma linha só (id = true), como ranking_config: vale para o grupo inteiro.
-- Todo mundo logado lê (a tela aplica as cores); só quem enxerga todas as
-- lojas (gestor mestre) muda. Os valores são conferidos de novo no código
-- (src/lib/aparencia.ts, normalizarAparencia): valor estranho vira o padrão.
--
-- Só cria coisa nova: não toca em tabela, função ou política existente, e a
-- AURA no ar (que não lê esta tabela) continua igual.

create table if not exists public.aparencia_config (
  id boolean primary key default true check (id),
  paleta text not null default 'aura',
  fundo_pipeline text not null default 'liso',
  agenda jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

alter table public.aparencia_config enable row level security;

drop policy if exists aparencia_config_ler on public.aparencia_config;
create policy aparencia_config_ler on public.aparencia_config
  for select to authenticated
  using (true);

drop policy if exists aparencia_config_gestor on public.aparencia_config;
create policy aparencia_config_gestor on public.aparencia_config
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

-- Limites de sanidade: id curto, agenda é lista e não um documento enorme.
alter table public.aparencia_config drop constraint if exists aparencia_config_valores;
alter table public.aparencia_config add constraint aparencia_config_valores check (
  paleta ~ '^[a-z]{2,20}$'
  and fundo_pipeline ~ '^[a-z]{2,20}$'
  and jsonb_typeof(agenda) = 'array'
  and pg_column_size(agenda) < 20000
);

insert into public.aparencia_config (id) values (true) on conflict (id) do nothing;
