-- 20261027174708 098_anuncio_vai_para_relacionamentos

alter table public.whatsapp_ia_leads
  add column if not exists carteira_relacionamento_id uuid
    references public.relacionamentos(id) on delete set null,
  add column if not exists carteira_em timestamptz,
  add column if not exists pergunta_lead_em timestamptz;

create index if not exists whatsapp_ia_leads_anuncio_sem_carteira
  on public.whatsapp_ia_leads (owner_id)
  where carteira_em is null and relacionamento_id is null
    and (anuncio_em is not null or campanha_id is not null);

create index if not exists whatsapp_ia_leads_pergunta_lead
  on public.whatsapp_ia_leads (owner_id)
  where carteira_relacionamento_id is not null and relacionamento_id is null
    and pergunta_lead_em is null;
