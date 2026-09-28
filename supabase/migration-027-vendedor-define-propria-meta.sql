-- Migration 027 — Vendedor define a própria meta de atividade (aplicada)
--
-- A AURA já lia metas_atividade — é de lá que sai o recado "Faltam X
-- atividades na semana" — e o gestor já tinha um formulário completo no
-- roster da equipe. O que não existia era o vendedor definir a própria: a
-- RLS só lhe dava leitura, então ele não tinha como se comprometer com uma
-- meta de prospecção, e o recado nunca aparecia para quem o gestor ainda
-- não havia configurado.
--
-- A política do gestor continua intacta e mais ampla: ele pode sobrescrever.
create policy metas_atividade_propria on metas_atividade
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());
