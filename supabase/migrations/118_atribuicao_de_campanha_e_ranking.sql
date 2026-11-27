-- 118 — Venda de lead de campanha conta de verdade, e o ranking revisado
-- (pedido do Elton, 27/11/2026: "as vendas dos leads não estão computando;
-- os agentes não conseguem acompanhar o que veio de campanha e fechou;
-- negociação sai do ranking, indicação entra, e os KPIs também").
--
-- O QUE ESTAVA QUEBRADO (levantamento de 27/11, 60 dias):
--   * a conversa do WhatsApp sabe de qual anúncio o cliente veio
--     (whatsapp_ia_leads.campanha_id), mas isso só ia para o cliente/negócio
--     quando eles eram CRIADOS pela conversa. Cliente que já existia (clicou
--     no anúncio depois) ficava sem campanha, e a venda nascia "sem origem".
--     Jociane: 7 vendas, 2 contadas como de lead; Deise: 8, nenhuma;
--   * a IA pode mover o negócio direto para Pós-venda (pulando Fechamento) e
--     aí a venda nunca era criada — 13 casos em 60 dias.
--
-- O QUE MUDA (nada no código do WhatsApp; tudo aqui no banco):
--   1. a campanha da conversa passa para o cliente, o negócio e a venda,
--      sempre que a conversa tiver campanha e eles ainda não — nunca por cima
--      de uma campanha/origem já gravada;
--   2. venda nova sem campanha procura a campanha na conversa do cliente
--      (clique no anúncio até 120 dias antes da venda);
--   3. negócio que pula de uma etapa aberta para Pós-venda sem venda ganha a
--      venda "aguardando detalhes", igual a arrastar para Fechamento;
--   4. ranking: Negociação desligada; entram Indicação e os KPIs (o gestor
--      ajusta pesos e metas na tela de configuração);
--   5. backfill do que já existe.

-- ---------------------------------------------------------------- 1 e 2

-- A campanha de onde o cliente veio, pela conversa. p_ate = data da venda:
-- só vale clique de anúncio até ela (e no máximo 120 dias antes).
create or replace function public.aura_campanha_da_conversa(
  p_relacionamento uuid,
  p_oportunidade uuid,
  p_ate date default null
) returns uuid
language sql stable security definer set search_path = public as $$
  select l.campanha_id
    from public.whatsapp_ia_leads l
   where l.campanha_id is not null
     and (
       (p_relacionamento is not null and (l.relacionamento_id = p_relacionamento or l.carteira_relacionamento_id = p_relacionamento))
       or (p_oportunidade is not null and l.oportunidade_id = p_oportunidade)
     )
     and (
       p_ate is null or l.anuncio_em is null
       or ((l.anuncio_em at time zone 'America/Sao_Paulo')::date <= p_ate
           and (l.anuncio_em at time zone 'America/Sao_Paulo')::date >= p_ate - 120)
     )
   order by l.anuncio_em desc nulls last
   limit 1;
$$;

-- Venda sem campanha: procura na conversa. Roda depois de vendas_estampa_origem
-- e venda_herda_campanha_trg (ordem alfabética), que tentam o negócio e o cliente primeiro.
create or replace function public.aura_venda_campanha_da_conversa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  if new.campanha_id is not null then return new; end if;
  c := public.aura_campanha_da_conversa(new.relacionamento_id, new.oportunidade_id, coalesce(new.data, current_date));
  if c is not null then
    new.campanha_id := c;
    if new.origem_lead is null then new.origem_lead := 'marketing'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_zz_campanha_da_conversa on public.vendas;
create trigger vendas_zz_campanha_da_conversa
  before insert or update of relacionamento_id, oportunidade_id on public.vendas
  for each row execute function public.aura_venda_campanha_da_conversa();

-- Espalha a campanha de UMA conversa para o cliente, os negócios e as vendas
-- dele que ainda não têm campanha. Nunca troca o que já está gravado.
create or replace function public.aura_espalhar_campanha(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
  clique date;
begin
  select id, campanha_id, relacionamento_id, carteira_relacionamento_id, oportunidade_id, anuncio_em
    into l from public.whatsapp_ia_leads where id = p_lead;
  if l.id is null or l.campanha_id is null then return; end if;
  clique := (l.anuncio_em at time zone 'America/Sao_Paulo')::date;

  update public.relacionamentos
     set campanha_id = l.campanha_id,
         origem_lead = coalesce(origem_lead, 'marketing')
   where id in (l.relacionamento_id, l.carteira_relacionamento_id)
     and campanha_id is null;

  -- Negócio: o da conversa, ou os do cliente que estavam vivos depois do clique.
  update public.oportunidades
     set campanha_id = l.campanha_id,
         origem_lead = coalesce(origem_lead, 'marketing')
   where campanha_id is null
     and (id = l.oportunidade_id or relacionamento_id in (l.relacionamento_id, l.carteira_relacionamento_id))
     and (l.anuncio_em is null or coalesce(updated_at, created_at) >= l.anuncio_em);

  -- Venda: depois do clique e até 120 dias depois dele.
  update public.vendas
     set campanha_id = l.campanha_id,
         origem_lead = coalesce(origem_lead, 'marketing')
   where campanha_id is null
     and (oportunidade_id = l.oportunidade_id or relacionamento_id in (l.relacionamento_id, l.carteira_relacionamento_id))
     and (clique is null or (data >= clique and data <= clique + 120));
end;
$$;

create or replace function public.aura_conversa_espalha_campanha()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.campanha_id is not null then
    perform public.aura_espalhar_campanha(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aura_conversa_espalha_campanha on public.whatsapp_ia_leads;
create trigger trg_aura_conversa_espalha_campanha
  after insert or update of campanha_id, relacionamento_id, carteira_relacionamento_id, oportunidade_id
  on public.whatsapp_ia_leads
  for each row execute function public.aura_conversa_espalha_campanha();

-- ---------------------------------------------------------------- 3

-- Negócio que salta de etapa ABERTA direto para Pós-venda, sem venda: cria a
-- venda "aguardando detalhes" (o vendedor completa), igual ao arrasto para
-- Fechamento. Vindo de Fechamento (o caminho normal) ou de Perda, nada muda.
create or replace function public.aura_posvenda_sem_venda_cria_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tipo_novo text;
  tipo_antigo text;
begin
  if new.etapa is not distinct from old.etapa then return new; end if;
  select tipo into tipo_novo from public.etapas_funil where empresa = new.empresa and nome = new.etapa limit 1;
  if tipo_novo is distinct from 'posvenda' then return new; end if;
  select tipo into tipo_antigo from public.etapas_funil where empresa = new.empresa and nome = old.etapa limit 1;
  if coalesce(tipo_antigo, 'aberta') <> 'aberta' then return new; end if;
  if current_setting('aura.venda_em_curso', true) = 'sim' then return new; end if;
  if exists (select 1 from public.vendas where oportunidade_id = new.id) then return new; end if;

  insert into public.vendas (
    owner_id, empresa, cliente, produto,
    valor, valor_original, valor_fechado,
    desconto_valor, desconto_percentual,
    quantidade_parcelas, valor_parcela, entrada_valor, taxa_financeira,
    comissao_base, data, relacionamento_id, oportunidade_id, status,
    parceiro_id, percentual_parceiro
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    coalesce(new.valor, 0), coalesce(new.valor, 0), coalesce(new.valor, 0),
    0, 0, 1, coalesce(new.valor, 0), 0, 0,
    coalesce(new.valor, 0), current_date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
         then coalesce(new.percentual_parceiro, 50) else 0 end
  );
  return new;
end;
$$;

drop trigger if exists trg_aura_posvenda_sem_venda_cria_venda on public.oportunidades;
create trigger trg_aura_posvenda_sem_venda_cria_venda
  after update of etapa on public.oportunidades
  for each row execute function public.aura_posvenda_sem_venda_cria_venda();

-- ---------------------------------------------------------------- 4 ranking

-- As medidas novas que a nota sabe calcular (src/lib/ranking/nota.ts).
-- "negociacao" continua aceita só para a linha antiga, que fica desligada.
alter table public.ranking_criterios drop constraint if exists ranking_criterios_medida_check;
alter table public.ranking_criterios add constraint ranking_criterios_medida_check check (medida = any (array[
  'avaliacao_conquistada', 'avaliacao_enviada', 'recompra', 'prospeccao_fechada', 'venda_nova', 'venda_lead',
  'faturamento', 'prospeccao', 'lead_recebido', 'negociacao', 'atividades', 'crm_em_dia',
  'indicacao', 'ticket_medio', 'conversao', 'preco_mantido', 'ciclo_medio', 'cancelamentos', 'atingimento_meta'
]::text[]));

update public.ranking_criterios set ativo = false where medida = 'negociacao';

insert into public.ranking_criterios (medida, titulo, descricao, peso, meta_mes, categoria_alvo, ativo, ordem)
select v.medida, v.titulo, v.descricao, v.peso, v.meta, null, true, v.ordem
  from (values
    ('indicacao', 'Indicação de clientes', 'Clientes que chegaram por indicação no mês (um por cliente).', 2, 3, 8),
    ('atingimento_meta', 'Atingimento da meta', 'Faturamento ÷ meta de faturamento aprovada do mês, em %.', 3, 100, 9),
    ('conversao', 'Conversão', 'Ganhos ÷ (ganhos + perdidos) dos negócios decididos no mês, em %.', 2, 30, 10),
    ('ticket_medio', 'Ticket médio', 'Faturamento ÷ número de vendas do mês, em reais.', 1, 15000, 11),
    ('preco_mantido', 'Preço mantido', 'Quanto do preço de tabela foi mantido nas vendas, em %.', 1, 95, 12),
    ('ciclo_medio', 'Ciclo médio', 'Dias do cadastro do cliente até a venda. Menor é melhor: a meta é o teto.', 1, 30, 13),
    ('cancelamentos', 'Cancelamentos', 'Vendas canceladas no mês. Menor é melhor: a meta é o teto (até 1 no mês).', 1, 1, 14)
  ) as v(medida, titulo, descricao, peso, meta, ordem)
 where not exists (select 1 from public.ranking_criterios c where c.medida = v.medida);

-- ---------------------------------------------------------------- 5 backfill

select public.aura_espalhar_campanha(id) from public.whatsapp_ia_leads where campanha_id is not null;

-- Vendas que ainda ficaram sem campanha: procura pela conversa do cliente.
update public.vendas v
   set campanha_id = c.campanha_id,
       origem_lead = coalesce(v.origem_lead, 'marketing')
  from (
    select id, public.aura_campanha_da_conversa(relacionamento_id, oportunidade_id, data) as campanha_id
      from public.vendas where campanha_id is null
  ) c
 where v.id = c.id and c.campanha_id is not null;
