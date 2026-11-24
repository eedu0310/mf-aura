-- 20261002121619 048_separar_leads_recebidos_por_vendedor

-- Mesmo defeito da migracao 046, agora na tabela que se chama literalmente
-- "leads_recebidos" - a dos leads que entram por WhatsApp, Instagram e campanha.
--
-- Das quatro politicas de leitura, duas tinham "empresa = minha_empresa()"
-- solto, sem olhar cargo nem dono. Somadas com OU, bastava ser da loja:
-- todo mundo da Sole via os 39 leads da Sole (27 do Jeferson, 12 da Denise).
--
-- A de EXCLUSAO tinha o mesmo furo, o que e pior do que ver: um vendedor podia
-- apagar o lead de outro.
--
-- Leitura do marketing continua ampla de proposito: e ela que responde qual
-- campanha gerou qual lead, no relatorio de retorno por origem. Escrita do
-- marketing passa a ser limitada a propria loja.

-- 1) Leitura: as quatro politicas com a mesma condicao correta.
--    (pode_ver_marketing() ja inclui Gestor e Diretor.)
alter policy "Marketing e gestão veem todos os leads" on public.leads_recebidos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_marketing()
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  );
alter policy "Trava de loja nos leads" on public.leads_recebidos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_marketing()
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  );
alter policy "Ver leads conforme papel" on public.leads_recebidos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_marketing()
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  );
alter policy "Vendedores veem seus leads" on public.leads_recebidos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_marketing()
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  );

-- 2) Escrita: dono, gestor da loja, gestor mestre, ou marketing da propria loja.
alter policy "Atualizar leads conforme papel" on public.leads_recebidos
  using (
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
alter policy "Marketing e gestão atualizam todos os leads" on public.leads_recebidos
  using (
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
alter policy "Vendedores atualizam seus leads" on public.leads_recebidos
  using (
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

-- 3) Exclusao: so o dono do lead, o gestor da loja ou o gestor mestre.
alter policy "Excluir leads da própria empresa" on public.leads_recebidos
  using (
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
