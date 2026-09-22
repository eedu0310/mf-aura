-- Central WhatsApp da AURA.
-- O processo Baileys precisa rodar em ambiente Node persistente para manter a sessão QR.

create table if not exists public.whatsapp_status (
  id bigint primary key,
  conectado boolean not null default false,
  numero text,
  qr_code text,
  ultimo_erro text,
  atualizado_em timestamptz not null default now()
);

insert into public.whatsapp_status (id, conectado)
values (1, false)
on conflict (id) do nothing;

create table if not exists public.whatsapp_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  telefone text not null,
  nome_cliente text,
  avatar_url text,
  phone_number_id text not null,
  status text not null default 'aguardando_aceite',
  ia_ativa boolean not null default false,
  lead_id uuid,
  nao_lidas integer not null default 0,
  arquivada boolean not null default false,
  fixada boolean not null default false,
  silenciada boolean not null default false,
  ultima_mensagem_preview text,
  ultima_mensagem_em timestamptz,
  respostas_qualificacao jsonb not null default '{}'::jsonb,
  etapa_qualificacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number_id, telefone)
);

create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.whatsapp_conversas(id) on delete cascade,
  phone_number_id text,
  whatsapp_message_id text unique,
  remetente text not null check (remetente in ('cliente', 'vendedor', 'ia', 'sistema')),
  texto text not null,
  reacao text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_contactos (
  id uuid primary key default gen_random_uuid(),
  phone_number_id text not null,
  telefone text not null,
  nome text,
  avatar_url text,
  tipo text not null default 'contacto',
  actualizado_em timestamptz not null default now(),
  unique (phone_number_id, telefone)
);

create index if not exists whatsapp_conversas_linha_idx on public.whatsapp_conversas(phone_number_id, ultima_mensagem_em desc);
create index if not exists whatsapp_mensagens_conversa_idx on public.whatsapp_mensagens(conversa_id, created_at);
create index if not exists whatsapp_contactos_linha_idx on public.whatsapp_contactos(phone_number_id);

alter table public.whatsapp_status enable row level security;
alter table public.whatsapp_conversas enable row level security;
alter table public.whatsapp_mensagens enable row level security;
alter table public.whatsapp_contactos enable row level security;

drop policy if exists "Usuário autenticado vê status WhatsApp" on public.whatsapp_status;
create policy "Usuário autenticado vê status WhatsApp" on public.whatsapp_status for select to authenticated using (true);

drop policy if exists "Usuário autenticado vê conversas WhatsApp" on public.whatsapp_conversas;
create policy "Usuário autenticado vê conversas WhatsApp" on public.whatsapp_conversas for select to authenticated using (true);

drop policy if exists "Usuário autenticado vê mensagens WhatsApp" on public.whatsapp_mensagens;
create policy "Usuário autenticado vê mensagens WhatsApp" on public.whatsapp_mensagens for select to authenticated using (true);

drop policy if exists "Usuário autenticado atualiza mensagens WhatsApp" on public.whatsapp_mensagens;
create policy "Usuário autenticado atualiza mensagens WhatsApp" on public.whatsapp_mensagens for update to authenticated using (true) with check (true);

drop policy if exists "Usuário autenticado vê contatos WhatsApp" on public.whatsapp_contactos;
create policy "Usuário autenticado vê contatos WhatsApp" on public.whatsapp_contactos for select to authenticated using (true);

do $$ begin
  alter publication supabase_realtime add table public.whatsapp_status;
exception when duplicate_object then null;
end $$;
