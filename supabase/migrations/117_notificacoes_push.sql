-- 117 — Notificações push (o aviso do sino chega no celular).
--
-- Todo aviso do AURA já passa pela tabela notificacoes (lead novo, cliente
-- esperando resposta, briefing do dia, fechamento, supervisora...). O que
-- faltava era ele sair do sino e tocar no aparelho com o AURA fechado.
--
-- Como funciona:
--   * cada aparelho que liga as notificações grava aqui a sua "inscrição"
--     (endereço de entrega do navegador — Chrome, Safari do iPhone com o AURA
--     na tela de início, Edge...);
--   * o servidor do AURA olha a notificacoes de poucos em poucos segundos,
--     pega o que ainda não foi entregue (push_enviado_em vazio) e manda para
--     os aparelhos do dono do aviso.
--
-- As chaves VAPID (a "assinatura" do AURA perante o serviço de push do
-- navegador) ficam numa tabela que só o servidor lê. Se a VPS tiver
-- VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no .env.local, elas têm preferência.

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  falhas integer not null default 0
);

create index if not exists push_inscricoes_user_idx on public.push_inscricoes (user_id);

alter table public.push_inscricoes enable row level security;

-- Cada um vê e apaga só os próprios aparelhos. Quem grava é o servidor
-- (rota /api/push/inscricao, que confere o login).
drop policy if exists push_inscricoes_proprias on public.push_inscricoes;
create policy push_inscricoes_proprias on public.push_inscricoes
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_inscricoes_apagar_proprias on public.push_inscricoes;
create policy push_inscricoes_apagar_proprias on public.push_inscricoes
  for delete to authenticated
  using (user_id = auth.uid());

-- Chaves VAPID: uma linha só, sem política nenhuma (RLS ligada = ninguém de
-- fora lê; só a chave de serviço do servidor).
create table if not exists public.aura_push_chaves (
  id integer primary key default 1 check (id = 1),
  publica text not null,
  privada text not null,
  criada_em timestamptz not null default now()
);
alter table public.aura_push_chaves enable row level security;
revoke all on public.aura_push_chaves from anon, authenticated;

-- Marca de entrega em cada aviso.
alter table public.notificacoes add column if not exists push_enviado_em timestamptz;

-- O que já existe conta como entregue: ninguém recebe no celular, de uma vez,
-- os 3 mil avisos antigos quando a função entrar no ar.
update public.notificacoes set push_enviado_em = now() where push_enviado_em is null;

create index if not exists notificacoes_push_pendente_idx
  on public.notificacoes (criada_em)
  where push_enviado_em is null;
