-- 1) A VIEW QUE EU CRIEI NA MIGRATION 053 ESTAVA FURADA.
--
-- No Postgres, view nasce com security_invoker DESLIGADO: roda com os direitos
-- de quem a criou (postgres), nao de quem consulta. A aura_trechos_ativos
-- passava por cima da RLS e entregaria os trechos das QUATRO lojas para
-- qualquer um - eu fechei o vazamento de carteira e abri outro ao lado, na
-- mesma tarde. O linter de seguranca do Supabase pegou, nivel ERROR.
--
-- Provado depois: Jeferson (Sole) passou a ver 66 trechos de uma loja, a dele,
-- em vez dos 264 das quatro.
alter view public.aura_trechos_ativos set (security_invoker = true);

-- 2) FUNCOES DE GATILHO NAO SAO PARA CHAMAR PELA API.
--    Expostas em /rest/v1/rpc, qualquer um autenticado - e algumas sem login -
--    podia invoca-las. Nao se ganha nada e e superficie aberta de graca.
--
--    revoke de PUBLIC, nao so de anon: anon e authenticated HERDAM de PUBLIC,
--    e revogar apenas de anon deixa a permissao de pe pelo caminho de tras.
--    Foi o que aconteceu com aura_buscar_trechos, que eu "revoguei" na 044 e o
--    exame continuou apontando.
do $$
declare f text;
begin
  foreach f in array array[
    'public.aura_apagar_card_leva_a_venda()',
    'public.aura_aprendizado_toca_atualizado_em()',
    'public.estampar_origem_da_venda()',
    'public.estampar_origem_do_lead()',
    'public.aura_normalizar_relacionamento()',
    'public.tocar_updated_at_compromisso_mensal()',
    'public.tocar_updated_at_indicador()',
    'public.atualizar_meta_atualizada_em()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', f);
    exception when undefined_function then
      raise notice 'funcao ausente, ignorada: %', f;
    end;
  end loop;
end $$;

-- 3) Busca de trechos e ajudantes de RLS: so para quem esta logado.
revoke all on function public.aura_buscar_trechos(text, text, integer) from public, anon;
grant execute on function public.aura_buscar_trechos(text, text, integer) to authenticated, service_role;

revoke all on function public.vejo_a_loja_toda()        from public, anon;
revoke all on function public.pode_ver_todas_empresas() from public, anon;
revoke all on function public.pode_ver_marketing()      from public, anon;
revoke all on function public.meu_cargo()               from public, anon;
revoke all on function public.minha_empresa()           from public, anon;
revoke all on function public.cargo_atual()             from public, anon;
grant execute on function public.vejo_a_loja_toda()        to authenticated, service_role;
grant execute on function public.pode_ver_todas_empresas() to authenticated, service_role;
grant execute on function public.pode_ver_marketing()      to authenticated, service_role;
grant execute on function public.meu_cargo()               to authenticated, service_role;
grant execute on function public.minha_empresa()           to authenticated, service_role;
grant execute on function public.cargo_atual()             to authenticated, service_role;

-- 4) SEARCH_PATH FIXO: sem isto, quem conseguir criar um schema no caminho de
--    busca pode sequestrar a resolucao de nomes dentro da funcao.
alter function public.aura_normalizar_telefone(text)          set search_path = public;
alter function public.aura_normalizar_email(text)             set search_path = public;
alter function public.aura_normalizar_relacionamento()        set search_path = public;
alter function public.tocar_updated_at_compromisso_mensal()   set search_path = public;
alter function public.tocar_updated_at_indicador()            set search_path = public;
alter function public.atualizar_meta_atualizada_em()          set search_path = public;
