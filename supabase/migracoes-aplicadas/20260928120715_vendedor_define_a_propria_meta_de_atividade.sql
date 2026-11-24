-- 20260928120715 vendedor_define_a_propria_meta_de_atividade

-- O vendedor só podia LER as próprias metas de atividade: escrever era
-- privilégio do gestor. Na prática ele não tinha como se comprometer com uma
-- meta de prospecção, e o recado da AURA "Faltam X atividades na semana"
-- nunca aparecia para quem o gestor ainda não tinha configurado.
--
-- A meta do gestor continua valendo e pode sobrescrever: a política dele é
-- mais ampla e permanece intacta.
create policy metas_atividade_propria on metas_atividade
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());
