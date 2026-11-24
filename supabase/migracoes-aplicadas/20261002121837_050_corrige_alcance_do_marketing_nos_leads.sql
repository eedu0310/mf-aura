-- 20261002121837 050_corrige_alcance_do_marketing_nos_leads

-- Correcao da migracao 048.
--
-- Eu usei pode_ver_marketing() para dar ao marketing a visao ampla dos leads
-- que o relatorio de retorno por campanha exige. Mas essa funcao e
-- "cargo in ('Marketing','Gestor','Diretor')", sem loja - entao ela tambem
-- liberava todas as lojas para QUALQUER gestor, mestre ou nao. No teste, a
-- conta "Elton Gestor" (Gestor, LF Lareiras, nao mestre) enxergou os 67 leads
-- do grupo em vez dos da LF.
--
-- Agora o alcance de grupo e so do cargo Marketing, que cuida das campanhas das
-- quatro lojas. Gestor segue pela regra de loja, e so o gestor mestre ve tudo.
do $$
declare
  regra text := $regra$
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or meu_cargo() = 'Marketing'
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  $regra$;
  politica text;
begin
  foreach politica in array array[
    'Marketing e gestão veem todos os leads',
    'Trava de loja nos leads',
    'Ver leads conforme papel',
    'Vendedores veem seus leads'
  ] loop
    execute format('alter policy %I on public.leads_recebidos using (%s)', politica, regra);
  end loop;
end $$;
