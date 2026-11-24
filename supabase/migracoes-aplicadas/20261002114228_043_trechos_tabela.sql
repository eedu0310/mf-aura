-- 20261002114228 043_trechos_tabela

create table if not exists public.aura_material_trechos (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.aura_materiais(id) on delete cascade,
  empresa     text not null,
  ordem       integer not null,
  origem      text not null,
  texto       text not null,
  busca       tsvector generated always as (
                to_tsvector('portuguese', coalesce(origem,'') || ' ' || coalesce(texto,''))
              ) stored,
  criado_em   timestamptz not null default now()
);

create index if not exists aura_material_trechos_busca
  on public.aura_material_trechos using gin (busca);
create index if not exists aura_material_trechos_da_loja
  on public.aura_material_trechos (empresa, material_id, ordem);

alter table public.aura_material_trechos enable row level security;

create policy "Ver trechos da propria loja"
  on public.aura_material_trechos for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor administra os trechos da loja"
  on public.aura_material_trechos for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));
