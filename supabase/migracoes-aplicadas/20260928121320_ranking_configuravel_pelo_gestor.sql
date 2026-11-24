-- 20260928121320 ranking_configuravel_pelo_gestor

-- Ranking configurável: o gestor decide o que conta, quanto pesa e onde
-- fica o corte do bônus. Antes os pesos viviam no código (venda 100,
-- atividade 10, relacionamento 2) e mudá-los exigia um deploy.
--
-- A nota final de cada vendedor no mês vai de 0 a 10. Cada critério tem um
-- peso (quanto dos 10 pontos ele vale) e uma meta (quanto é preciso fazer
-- para levar o peso inteiro). Fez metade da meta, leva metade do peso.

create table if not exists ranking_config (
  id boolean primary key default true check (id),
  -- Percentual de preenchimento do CRM exigido para o bônus mensal sair.
  bonus_crm_minimo integer not null default 80 check (bonus_crm_minimo between 0 and 100),
  bonus_descricao text default 'Bônus mensal da equipe',
  -- Fábrica não disputa com loja: a MF vende para revendedor, não para
  -- cliente final. O gestor dela decide se entra no ranking do grupo.
  mf_no_ranking_do_grupo boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into ranking_config (id) values (true) on conflict (id) do nothing;

create table if not exists ranking_criterios (
  id uuid primary key default gen_random_uuid(),
  -- O que o sistema sabe medir. 'prospeccao' usa categoria_alvo.
  medida text not null check (medida in (
    'avaliacao_conquistada',   -- cliente abriu ou confirmou a avaliação
    'recompra',                -- venda para cliente que já havia comprado
    'prospeccao_fechada',      -- contato novo que virou negócio fechado
    'venda_nova',              -- quantidade de vendas no período
    'faturamento',             -- soma vendida no período
    'prospeccao',              -- contatos novos de uma categoria
    'atividades',              -- atividades registradas
    'crm_em_dia'               -- percentual de preenchimento do CRM
  )),
  titulo text not null,
  descricao text,
  -- Quanto dos 10 pontos este critério vale.
  peso numeric not null default 1 check (peso >= 0 and peso <= 10),
  -- Quanto é preciso fazer no mês para levar o peso inteiro.
  meta_mes numeric not null default 1 check (meta_mes > 0),
  categoria_alvo text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists ranking_criterios_ordem_idx on ranking_criterios (ativo, ordem);

-- Ponto de partida com a prioridade que o Elton definiu: avaliação no Google
-- pesa mais que venda. O gestor ajusta tudo isto pela tela.
insert into ranking_criterios (medida, titulo, descricao, peso, meta_mes, categoria_alvo, ordem)
select * from (values
  ('avaliacao_conquistada','Avaliações conquistadas','Clientes que abriram a avaliação depois do seu convite',3.0,4,null,1),
  ('recompra','Recompra','Venda para cliente que já havia comprado antes',2.0,2,null,2),
  ('prospeccao_fechada','Prospecção que fechou','Contato novo que você trouxe e levou até a venda',2.0,3,null,3),
  ('venda_nova','Vendas fechadas','Quantidade de negócios fechados no mês',1.5,4,null,4),
  ('crm_em_dia','CRM em dia','Próximo contato marcado, relato da visita e categoria preenchida',1.5,100,null,5)
) as v
where not exists (select 1 from ranking_criterios);

alter table ranking_config enable row level security;
alter table ranking_criterios enable row level security;

-- Todo mundo lê (o vendedor precisa saber como está sendo pontuado);
-- só o gestor muda.
create policy ranking_config_ler on ranking_config for select using (true);
create policy ranking_config_gestor on ranking_config
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');

create policy ranking_criterios_ler on ranking_criterios for select using (true);
create policy ranking_criterios_gestor on ranking_criterios
  for all using (meu_cargo() = 'Gestor') with check (meu_cargo() = 'Gestor');
