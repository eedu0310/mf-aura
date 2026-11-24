-- 20260928115747 travar_exclusao_de_tarefa_obrigatoria

-- A tabela já tinha duas políticas permissivas de exclusão ("Usuário exclui
-- próprias tarefas" e "Vendedores gerenciam suas tarefas", esta FOR ALL).
-- Políticas permissivas se somam por OU, então acrescentar mais uma não
-- restringe nada — a trava precisa ser RESTRICTIVE, que combina por E.
drop policy if exists tarefas_excluir_proprias on tarefas;

create policy tarefas_obrigatoria_nao_se_apaga on tarefas
  as restrictive
  for delete
  using (origem = 'vendedor');

comment on policy tarefas_obrigatoria_nao_se_apaga on tarefas is
  'Tarefa da AURA ou do gestor é obrigação: conclui-se, não se descarta.';
