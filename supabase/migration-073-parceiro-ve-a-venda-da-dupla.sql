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

-- O WITH CHECK do INSERT exige que quem grava seja o dono, o que já está
-- certo, e não restringe parceiro_id — então a venda em dupla pode nascer
-- completa pela tela de Vendas. Fica registrado que foi conferido.

create index if not exists idx_vendas_parceiro_empresa
  on public.vendas (parceiro_id, empresa) where parceiro_id is not null;
