-- 20261013130816 080_lead_de_anuncio

-- Lead que nasce de anúncio do Facebook/Instagram.
--
-- A estrutura de atribuição já existia inteira (campanhas_marketing ligada a
-- relacionamentos, oportunidades, atividades e vendas) e estava 100% vazia:
-- 257 relacionamentos, todos com origem_lead nulo. Faltava alguém preencher.

-- 1. A campanha precisa de uma chave estável para o mesmo anúncio não virar
--    várias campanhas. Vem do id do anúncio na Meta.
alter table public.campanhas_marketing
  add column if not exists chave_externa text;

create unique index if not exists campanhas_marketing_chave_externa_idx
  on public.campanhas_marketing (empresa, chave_externa)
  where chave_externa is not null;

-- 2. A conversa guarda de qual anúncio veio.
alter table public.whatsapp_ia_leads
  add column if not exists anuncio_titulo text,
  add column if not exists anuncio_id text,
  add column if not exists anuncio_url text,
  add column if not exists anuncio_plataforma text,
  add column if not exists anuncio_clique_id text,
  add column if not exists anuncio_em timestamptz,
  add column if not exists campanha_id uuid references public.campanhas_marketing(id) on delete set null;

create index if not exists whatsapp_ia_leads_campanha_idx
  on public.whatsapp_ia_leads (campanha_id) where campanha_id is not null;

-- 3. Resolver a campanha de um anúncio, criando se ainda não existe.
--
--    É uma função no banco, e não duas consultas no código, porque duas
--    análises simultâneas do mesmo anúncio criariam duas campanhas iguais —
--    e aí o relatório mostraria o mesmo anúncio dividido em dois, cada um
--    com metade dos leads. O índice único mais o on conflict resolvem isso
--    numa operação só.
create or replace function public.campanha_do_anuncio(
  p_empresa text,
  p_chave text,
  p_nome text,
  p_canal text,
  p_criado_por uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if p_empresa is null or p_chave is null or p_criado_por is null then
    return null;
  end if;

  insert into public.campanhas_marketing (empresa, nome, canal, status, chave_externa, criado_por, data_inicio)
  values (p_empresa, coalesce(p_nome, p_chave), coalesce(p_canal, 'meta'), 'ativa', p_chave, p_criado_por, current_date)
  on conflict (empresa, chave_externa) where chave_externa is not null
  do update set nome = excluded.nome
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.campanha_do_anuncio(text, text, text, text, uuid) from public;
grant execute on function public.campanha_do_anuncio(text, text, text, text, uuid) to service_role;
