-- Supervisor AURA: vínculo conversa do WhatsApp ↔ relacionamento/oportunidade + análise da IA
create table if not exists public.whatsapp_ia_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  empresa text,
  chat_jid text not null,
  telefone text,
  nome text,
  relacionamento_id uuid references public.relacionamentos(id) on delete set null,
  oportunidade_id uuid references public.oportunidades(id) on delete set null,
  etapa text,
  ignorado boolean not null default false,
  resumo text,
  proxima_acao text,
  dicas jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  historico jsonb not null default '[]'::jsonb,
  interesse text,
  valor_estimado numeric,
  ultimo_msg_id text,
  ultima_analise_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, chat_jid)
);
alter table public.whatsapp_ia_leads enable row level security;
create policy "Dono gerencia seus leads de WhatsApp" on public.whatsapp_ia_leads
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Gestor e diretor veem leads de WhatsApp" on public.whatsapp_ia_leads
  for select using (meu_cargo() = any (array['Gestor','Diretor']));
create index if not exists whatsapp_ia_leads_owner_idx on public.whatsapp_ia_leads(owner_id);
