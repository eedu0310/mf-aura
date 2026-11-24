-- 20261027181528 099_aura_aprende_com_resultado

create table if not exists public.aura_sugestoes_resultado (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  owner_id uuid not null,
  chat_jid text not null,
  sugestao text not null,
  enviado text,
  similaridade numeric,
  uso text not null check (uso in ('usou', 'adaptou', 'ignorou', 'automatica')),
  enviado_em timestamptz not null default now(),
  cliente_respondeu boolean,
  resposta_cliente text,
  respondeu_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists aura_sugestoes_resultado_chat
  on public.aura_sugestoes_resultado (owner_id, chat_jid, enviado_em desc);
create index if not exists aura_sugestoes_resultado_loja
  on public.aura_sugestoes_resultado (empresa, enviado_em desc);
alter table public.aura_sugestoes_resultado enable row level security;

create table if not exists public.aura_aprendizado_origem (
  id uuid primary key default gen_random_uuid(),
  aprendizado_id uuid not null references public.aura_aprendizado(id) on delete cascade,
  empresa text not null,
  owner_id uuid,
  chat_jid text,
  oportunidade_id uuid,
  relacionamento_id uuid,
  resultado text check (resultado in ('fechado', 'perdido')),
  resolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (aprendizado_id, owner_id, chat_jid)
);
create index if not exists aura_aprendizado_origem_aberta_op
  on public.aura_aprendizado_origem (oportunidade_id) where resultado is null;
create index if not exists aura_aprendizado_origem_aberta_rel
  on public.aura_aprendizado_origem (relacionamento_id) where resultado is null;
alter table public.aura_aprendizado_origem enable row level security;

alter table public.aura_aprendizado
  add column if not exists vezes_perdeu integer not null default 0,
  add column if not exists aprovado_auto boolean not null default false;
