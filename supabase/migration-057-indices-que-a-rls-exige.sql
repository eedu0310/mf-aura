-- Indices nas colunas que a RLS consulta em toda query.
--
-- O exame de desempenho achou 49 chaves estrangeiras sem indice. Nao criei 49:
-- indice que ninguem le ainda custa escrita em todo insert. Criei os que a RLS
-- da migration 046 passou a exigir, e os de junção quente.
--
-- O caso mais grave: a regra nova filtra "owner_id = auth.uid()" em TODA
-- consulta de vendedor, e relacionamentos.owner_id nao tinha indice - cada
-- abertura da tela varria a tabela inteira. Com 70 linhas ninguem sente; com
-- 7.000 a tela para de abrir. Eu teria entregado a correcao de seguranca com
-- um problema de lentidao embutido.
create index if not exists relacionamentos_owner_idx on public.relacionamentos (owner_id);
create index if not exists oportunidades_owner_idx    on public.oportunidades (owner_id);
create index if not exists atividades_owner_idx       on public.atividades (owner_id);
create index if not exists tarefas_vendedor_idx       on public.tarefas (vendedor_id);
create index if not exists coach_conversas_owner_idx  on public.coach_conversas (owner_id);
create index if not exists leads_recebidos_sdr_idx    on public.leads_recebidos (sdr_id);

create index if not exists oportunidades_relacionamento_idx   on public.oportunidades (relacionamento_id);
create index if not exists leads_recebidos_relacionamento_idx on public.leads_recebidos (relacionamento_id);
create index if not exists vendas_oportunidade_idx            on public.vendas (oportunidade_id);
create index if not exists whatsapp_ia_leads_rel_idx          on public.whatsapp_ia_leads (relacionamento_id);
create index if not exists whatsapp_ia_leads_op_idx           on public.whatsapp_ia_leads (oportunidade_id);
create index if not exists pos_venda_notas_pos_venda_idx      on public.pos_venda_notas (pos_venda_id);
create index if not exists pedidos_avaliacao_venda_idx        on public.pedidos_avaliacao (venda_id);

-- A busca de trechos junta aura_material_trechos com aura_materiais para
-- respeitar material desligado, e roda em cada analise de conversa.
create index if not exists aura_material_trechos_material_idx
  on public.aura_material_trechos (material_id);
