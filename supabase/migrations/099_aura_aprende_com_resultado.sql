-- A AURA aprendendo com o resultado do que ela mesma faz.
--
-- 1. aura_sugestoes_resultado: cada sugestão de resposta que a AURA deu no
--    WhatsApp e o que aconteceu depois — o vendedor usou como estava, adaptou
--    ou ignorou, e o cliente respondeu ou sumiu. A rodada da noite lê isto
--    para aprender quais sugestões funcionam.
-- 2. aura_aprendizado_origem: de qual conversa/negócio veio cada aprendizado
--    da rodada da noite. Quando aquele negócio fecha ou perde, o placar do
--    aprendizado é atualizado (vezes_fechou / vezes_perdeu).
-- 3. aura_aprendizado.vezes_perdeu e aprovado_auto: o placar completo e a
--    marca de quem entrou em uso sozinho (regra em lib/aura/aprendizado.ts).
--
-- As duas tabelas novas só são escritas e lidas pelo servidor (cliente de
-- serviço). RLS ligada e sem política: ninguém de fora lê nem escreve.

create table if not exists public.aura_sugestoes_resultado (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  owner_id uuid not null,
  chat_jid text not null,
  sugestao text not null,
  enviado text,
  similaridade numeric,
  -- usou: mandou como estava · adaptou: mudou o texto · ignorou: mandou outra
  -- coisa · automatica: a própria AURA mandou (resposta automática)
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
