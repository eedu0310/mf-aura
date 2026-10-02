-- O que e este contato, em dois eixos independentes.
--
-- O PROBLEMA: a AURA tratava como lead novo todo mundo que mandava mensagem -
-- instalador, colega de equipe, chefe, amigo. E o unico jeito de dizer "nao e"
-- era o booleano "ignorado", cujo botao so aparecia quando a propria IA tinha
-- chutado que era lead. Quem sabia desde o inicio que o numero era o instalador
-- nao tinha onde dizer isso.
--
--   natureza  - o que ele e para o negocio:
--               'lead'     prospecto, entra no pipeline
--               'nao_lead' instalador, colega, chefe, amigo, fornecedor
--               'cliente'  ja comprou; e pos-venda, nao prospeccao
--
--   categoria - o que ele e no mercado: Cliente Final, Arquiteto, Construtora,
--               Designer de Interiores... o mesmo vocabulario de
--               relacionamentos.categoria, de proposito: quando o contato virar
--               lead, a categoria vai junto para a carteira.
--
-- "ignorado" continua existindo e em uso. Natureza 'nao_lead' e 'cliente'
-- mantem ignorado = true para a analise automatica nao voltar a mexer.
alter table public.whatsapp_ia_leads
  add column if not exists natureza text,
  add column if not exists categoria text,
  add column if not exists motivo_natureza text,
  add column if not exists classificado_em timestamptz,
  add column if not exists classificado_por uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_ia_leads_natureza_valida') then
    alter table public.whatsapp_ia_leads
      add constraint whatsapp_ia_leads_natureza_valida
      check (natureza is null or natureza in ('lead', 'nao_lead', 'cliente'));
  end if;
end $$;

-- Herda o que ja se sabe, para ninguem reclassificar o que ja decidiu.
update public.whatsapp_ia_leads
   set natureza = 'lead', classificado_em = coalesce(classificado_em, updated_at)
 where natureza is null and oportunidade_id is not null;

update public.whatsapp_ia_leads
   set natureza = 'nao_lead', classificado_em = coalesce(classificado_em, updated_at)
 where natureza is null and ignorado = true;

create index if not exists whatsapp_ia_leads_natureza_idx
  on public.whatsapp_ia_leads (owner_id, natureza);
