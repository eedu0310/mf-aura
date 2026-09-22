-- Agent Suggestions Table for WhatsApp Autonomous Agent
-- Stores AI-generated suggestions for vendors based on message analysis

create table if not exists public.agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendedores(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversas(id) on delete cascade,
  related_message_id uuid references public.whatsapp_mensagens(id) on delete set null,
  
  -- Suggestion Type
  type text not null check (type in ('opportunity', 'follow_up', 'objection_handling', 'negotiation', 'upsell', 'retention')),
  
  -- Suggestion Content
  title text not null,
  description text not null,
  suggested_action text not null,
  
  -- Confidence and Status
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending' check (status in ('pending', 'viewed', 'applied', 'dismissed')),
  
  -- Metadata
  claude_message_id text,
  processing_time_ms integer,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  applied_at timestamptz,
  dismissed_at timestamptz,
  
  unique (related_message_id, type)
);

create table if not exists public.agent_auto_responses (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendedores(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversas(id) on delete cascade,
  related_message_id uuid not null references public.whatsapp_mensagens(id) on delete cascade,
  
  -- Response Content
  suggested_response text not null,
  response_type text not null check (response_type in ('greeting', 'product_info', 'pricing', 'scheduling', 'follow_up', 'closing')),
  
  -- Status
  status text not null default 'pending' check (status in ('pending', 'edited', 'sent', 'discarded')),
  sent_response text,
  
  -- Confidence
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  
  -- Timestamps
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.agent_notifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendedores(id) on delete cascade,
  suggestion_id uuid references public.agent_suggestions(id) on delete cascade,
  
  -- Notification Content
  title text not null,
  message text not null,
  notification_type text not null check (notification_type in ('suggestion', 'alert', 'milestone', 'reminder')),
  
  -- Status
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  
  -- Metadata
  icon text,
  action_url text,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);

-- Indexes for Performance
create index if not exists agent_suggestions_vendor_created_idx on public.agent_suggestions(vendor_id, created_at desc);
create index if not exists agent_suggestions_status_idx on public.agent_suggestions(status);
create index if not exists agent_suggestions_conversation_idx on public.agent_suggestions(conversation_id);
create index if not exists agent_suggestions_type_idx on public.agent_suggestions(type);

create index if not exists agent_auto_responses_vendor_created_idx on public.agent_auto_responses(vendor_id, created_at desc);
create index if not exists agent_auto_responses_status_idx on public.agent_auto_responses(status);
create index if not exists agent_auto_responses_conversation_idx on public.agent_auto_responses(conversation_id);

create index if not exists agent_notifications_vendor_created_idx on public.agent_notifications(vendor_id, created_at desc);
create index if not exists agent_notifications_status_idx on public.agent_notifications(status);
create index if not exists agent_notifications_priority_idx on public.agent_notifications(priority);

-- Enable RLS
alter table public.agent_suggestions enable row level security;
alter table public.agent_auto_responses enable row level security;
alter table public.agent_notifications enable row level security;

-- RLS Policies for agent_suggestions
drop policy if exists "Vendors can see their own suggestions" on public.agent_suggestions;
create policy "Vendors can see their own suggestions" on public.agent_suggestions for select to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Vendors can update their own suggestions" on public.agent_suggestions;
create policy "Vendors can update their own suggestions" on public.agent_suggestions for update to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
) with check (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Service role can insert suggestions" on public.agent_suggestions;
create policy "Service role can insert suggestions" on public.agent_suggestions for insert to service_role with check (true);

-- RLS Policies for agent_auto_responses
drop policy if exists "Vendors can see their own auto responses" on public.agent_auto_responses;
create policy "Vendors can see their own auto responses" on public.agent_auto_responses for select to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Vendors can update their own auto responses" on public.agent_auto_responses;
create policy "Vendors can update their own auto responses" on public.agent_auto_responses for update to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
) with check (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Service role can insert auto responses" on public.agent_auto_responses;
create policy "Service role can insert auto responses" on public.agent_auto_responses for insert to service_role with check (true);

-- RLS Policies for agent_notifications
drop policy if exists "Vendors can see their own notifications" on public.agent_notifications;
create policy "Vendors can see their own notifications" on public.agent_notifications for select to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Vendors can update their own notifications" on public.agent_notifications;
create policy "Vendors can update their own notifications" on public.agent_notifications for update to authenticated using (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
) with check (
  vendor_id in (
    select id from public.vendedores where auth_id = auth.uid()
  )
);

drop policy if exists "Service role can insert notifications" on public.agent_notifications;
create policy "Service role can insert notifications" on public.agent_notifications for insert to service_role with check (true);

-- Enable realtime for new tables
do $$ begin
  alter publication supabase_realtime add table public.agent_suggestions;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.agent_auto_responses;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.agent_notifications;
exception when duplicate_object then null;
end $$;
