-- 20260928115531 tarefa_obrigatoria_da_aura

-- Tarefa que a AURA manda é obrigação, não sugestão: o vendedor conclui,
-- não descarta. A que ele mesmo criou continua sendo dele para apagar.
--
-- Sem esta coluna a tela não tinha como distinguir as duas, e o botão de
-- lixeira valia para todas.
alter table tarefas
  add column if not exists origem text not null default 'vendedor'
    check (origem in ('vendedor', 'aura', 'gestor'));

-- Quem cria a tarefa continua sendo o dono dela; o que muda é quem pode
-- apagar. Obrigatória só sai do caminho quando é concluída.
drop policy if exists tarefas_excluir_proprias on tarefas;
create policy tarefas_excluir_proprias on tarefas
  for delete using (vendedor_id = auth.uid() and origem = 'vendedor');

comment on column tarefas.origem is
  'vendedor = criada pela pessoa, pode apagar. aura/gestor = obrigatória, só concluir.';
