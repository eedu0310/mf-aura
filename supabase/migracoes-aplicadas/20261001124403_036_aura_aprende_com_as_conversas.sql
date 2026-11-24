-- 20261001124403 036_aura_aprende_com_as_conversas

create table if not exists public.aura_aprendizado (
  id             uuid primary key default gen_random_uuid(),
  empresa        text not null,
  canal          text not null default 'whatsapp'
                   check (canal in ('whatsapp', 'instagram', 'manual')),
  tipo           text not null
                   check (tipo in ('objecao', 'pergunta', 'abordagem')),
  gatilho        text not null,
  resposta       text not null,
  chave          text not null,
  vezes_visto    integer not null default 1,
  vezes_fechou   integer not null default 0,
  status         text not null default 'sugerido'
                   check (status in ('sugerido', 'aprovado', 'recusado')),
  revisado_por   uuid references public.profiles(id) on delete set null,
  revisado_em    timestamptz,
  fonte          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create unique index if not exists aura_aprendizado_chave_unica
  on public.aura_aprendizado (empresa, canal, tipo, chave);

create index if not exists aura_aprendizado_para_prompt
  on public.aura_aprendizado (empresa, status, vezes_fechou desc, vezes_visto desc);

alter table public.aura_aprendizado enable row level security;

drop policy if exists "Ver aprendizado da própria loja" on public.aura_aprendizado;
create policy "Ver aprendizado da própria loja"
  on public.aura_aprendizado for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor revisa o aprendizado da loja" on public.aura_aprendizado;
create policy "Gestor revisa o aprendizado da loja"
  on public.aura_aprendizado for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

create or replace function public.aura_aprendizado_toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists aura_aprendizado_atualizado_em on public.aura_aprendizado;
create trigger aura_aprendizado_atualizado_em
  before update on public.aura_aprendizado
  for each row execute function public.aura_aprendizado_toca_atualizado_em();
