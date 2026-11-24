-- 20261006175601 073_parceiro_ve_a_venda_da_dupla

-- 073 — O parceiro vê a venda da dupla
--
-- Faltou esta tabela em 070b. O parceiro passou a ver o cliente, o negócio e a
-- conversa, mas não a venda — e a venda é justamente onde está a divisão do
-- valor. Ou seja: ele era avisado do fechamento e não conseguia abrir o que
-- lhe cabia. "Os dois estarem cientes" quebrava no último passo.
--
-- Como em 070b, as DUAS políticas permissivas de SELECT são alteradas, porque
-- o Postgres faz OR entre elas e mexer em uma só não mudaria nada.
--
-- VER sim, MEXER não. O parceiro não entra no UPDATE nem no DELETE da venda:
-- quem responde pelo número é o dono, e deixar dois donos editarem valor e
-- comissão da mesma venda é conflito garantido. Se a divisão combinada estiver
-- errada, quem corrige é o dono ou o gestor.

alter policy "Ver vendas conforme papel" on public.vendas
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

alter policy "Gestor e diretor veem todas as empresas" on public.vendas
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

-- A venda em dupla pode nascer com parceiro já no INSERT (a tela de Vendas
-- grava a venda completa). O WITH CHECK continuava exigindo só que o dono
-- fosse quem insere, o que já está certo — mas o parceiro precisa poder ser
-- gravado. Não há o que mudar aqui: parceiro_id não é restringido pelo
-- WITH CHECK. Fica registrado que foi conferido, e não esquecido.

create index if not exists idx_vendas_parceiro_empresa
  on public.vendas (parceiro_id, empresa) where parceiro_id is not null;
