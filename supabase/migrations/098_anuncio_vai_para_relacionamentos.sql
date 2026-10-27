-- Contato que veio de anúncio entra em Relacionamentos (o banco de leads da
-- loja) assim que aparece, mas NÃO entra no funil. Só vai para o Pipeline
-- quando a vendedora decide que é lead ("Tratar como lead").
--
-- Por que colunas novas e não relacionamento_id: em whatsapp_ia_leads,
-- relacionamento_id quer dizer "é lead, está no CRM" — o painel do WhatsApp,
-- os alertas de lead sem resposta e as atividades automáticas decidem por
-- ele. O contato de anúncio ainda não decidido precisa do vínculo com o
-- cadastro sem ganhar esse significado.

alter table public.whatsapp_ia_leads
  add column if not exists carteira_relacionamento_id uuid
    references public.relacionamentos(id) on delete set null,
  -- Quando o contato foi posto em Relacionamentos (ou quando tentamos e ele já
  -- era de outra vendedora). Preenchido = não tenta de novo.
  add column if not exists carteira_em timestamptz,
  -- Quando a vendedora recebeu a pergunta "é lead?" dos 3 dias. Uma vez só.
  add column if not exists pergunta_lead_em timestamptz;

create index if not exists whatsapp_ia_leads_anuncio_sem_carteira
  on public.whatsapp_ia_leads (owner_id)
  where carteira_em is null and relacionamento_id is null
    and (anuncio_em is not null or campanha_id is not null);

create index if not exists whatsapp_ia_leads_pergunta_lead
  on public.whatsapp_ia_leads (owner_id)
  where carteira_relacionamento_id is not null and relacionamento_id is null
    and pergunta_lead_em is null;
