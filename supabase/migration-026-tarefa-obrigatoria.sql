-- Migration 026 — Tarefa obrigatória da AURA (aplicada em produção)
--
-- Tarefa que a AURA ou o gestor manda é obrigação, não sugestão: o vendedor
-- conclui, não descarta. A que ele mesmo criou continua sendo dele.
--
-- Detalhe que quase passou: a tabela já tinha DUAS políticas permissivas de
-- exclusão, e uma delas FOR ALL. Políticas permissivas se somam por OU, então
-- acrescentar uma terceira não restringia nada. A trava precisou ser
-- RESTRICTIVE, que combina por E.

alter table tarefas
  add column if not exists origem text not null default 'vendedor'
    check (origem in ('vendedor', 'aura', 'gestor'));

create policy tarefas_obrigatoria_nao_se_apaga on tarefas
  as restrictive
  for delete
  using (origem = 'vendedor');
