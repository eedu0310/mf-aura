-- 20260922144808 ligar_rls_tabelas_centrais

alter table public.relacionamentos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.vendas enable row level security;
alter table public.leads_recebidos enable row level security;
