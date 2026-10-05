-- Marketing lia os leads das QUATRO lojas, com nome e telefone de cada um.
--
-- Quatro politicas de leitura (herdadas umas das outras ao longo do tempo,
-- todas com a mesma regra) liberavam "cargo = Marketing" sem dizer de qual
-- loja. Como politicas permissivas se SOMAM, bastava uma para abrir tudo. A
-- politica de ESCRITA da mesma tabela sempre teve "and empresa =
-- minha_empresa()": a regra pretendida era a propria loja, e a leitura ficou
-- de fora por descuido. Medido: a conta de Marketing da MF enxergava os 121
-- leads do grupo; agora enxerga os 17 da loja dela.
--
-- As quatro sao alteradas porque OR entre elas significa que consertar uma so
-- nao muda nada.
alter policy "Marketing e gestão veem todos os leads" on public.leads_recebidos
  using (pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or vendedor_id = (select auth.uid()) or sdr_id = (select auth.uid()));

alter policy "Trava de loja nos leads" on public.leads_recebidos
  using (pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or vendedor_id = (select auth.uid()) or sdr_id = (select auth.uid()));

alter policy "Vendedores veem seus leads" on public.leads_recebidos
  using (pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or vendedor_id = (select auth.uid()) or sdr_id = (select auth.uid()));

alter policy "Ver leads conforme papel" on public.leads_recebidos
  using (pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or vendedor_id = (select auth.uid()) or sdr_id = (select auth.uid()));
