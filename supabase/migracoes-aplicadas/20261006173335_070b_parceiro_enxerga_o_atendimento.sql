-- 20261006173335 070b_parceiro_enxerga_o_atendimento

-- O parceiro passa a ver e a trabalhar o atendimento em que foi convidado.
--
-- Cada politica de leitura ganha " or parceiro_id = eu". Nada mais muda: quem
-- nao e dono nem parceiro continua sem ver, e e por isso que a condicao e
-- exatamente essa e nao "da mesma loja".
--
-- As politicas sao alteradas em pares porque ha duas copias identicas de cada
-- uma (heranca de versoes antigas) e politicas permissivas se somam: consertar
-- so uma nao muda nada, e consertar so uma das duas deixaria a outra decidindo.
alter policy "Ver relacionamentos conforme papel" on public.relacionamentos
  using (pode_ver_todas_empresas()
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid()));

alter policy "Gestor e diretor veem todas as empresas" on public.relacionamentos
  using (pode_ver_todas_empresas()
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid()));

alter policy "Atualizar relacionamentos conforme papel" on public.relacionamentos
  using (owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid())
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or pode_ver_todas_empresas());

alter policy "Ver oportunidades conforme papel" on public.oportunidades
  using (pode_ver_todas_empresas()
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid()));

alter policy "Gestor e diretor veem todas as empresas" on public.oportunidades
  using (pode_ver_todas_empresas()
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid()));

alter policy "Atualizar oportunidades conforme papel" on public.oportunidades
  using (owner_id = (select auth.uid())
      or parceiro_id = (select auth.uid())
      or (vejo_a_loja_toda() and empresa = minha_empresa())
      or pode_ver_todas_empresas());

-- APAGAR continua so do dono e do gestor: o parceiro entra para ajudar a
-- vender, nao para apagar o cliente de outra pessoa.

-- A analise da conversa (resumo, dicas, alertas) o parceiro ve; as mensagens
-- cruas ficam no WhatsApp de quem atende, que e outra sessao e outro aparelho.
create policy "Parceiro ve a analise da conversa" on public.whatsapp_ia_leads
  for select to authenticated
  using (parceiro_id = (select auth.uid()));

-- O gestor da loja passa a ver as conversas da loja dele. Ate agora so o
-- gestor mestre via, e um gestor que nao enxerga as conversas da propria
-- equipe nao tem como cobrar atendimento.
create policy "Gestor ve as conversas da loja" on public.whatsapp_ia_leads
  for select to authenticated
  using (vejo_a_loja_toda() and empresa = minha_empresa());
