-- 20260928125541 cliente_recorrente_e_historico

-- Cliente que compra hoje e volta daqui a um ano precisa ser reconhecido:
-- sem isso ele entra como contato novo, o vendedor perde o histórico e a
-- recompra não pontua no ranking.
--
-- A view junta o histórico de cada contato num lugar só, para a ficha do
-- cliente e para o cálculo da recompra não precisarem recalcular isso
-- espalhado pelo código.
create or replace view cliente_historico as
select
  r.id                                   as relacionamento_id,
  r.owner_id,
  r.empresa,
  r.nome,
  r.categoria,
  count(v.id)                            as compras,
  coalesce(sum(coalesce(v.valor_fechado, v.valor, 0)), 0) as total_comprado,
  min(v.data)                            as primeira_compra,
  max(v.data)                            as ultima_compra,
  -- Já comprou mais de uma vez: é recorrente.
  (count(v.id) > 1)                      as recorrente,
  -- Dias desde a última compra, para a AURA saber quando é hora de voltar.
  case when max(v.data) is not null
       then (current_date - max(v.data))
       end                               as dias_desde_ultima_compra
from relacionamentos r
left join vendas v on v.relacionamento_id = r.id
group by r.id, r.owner_id, r.empresa, r.nome, r.categoria;

comment on view cliente_historico is
  'Histórico de compras por contato: quantas vezes, quanto, quando foi a primeira e a última.';

-- A view herda a RLS das tabelas de origem quando é security_invoker.
alter view cliente_historico set (security_invoker = on);
