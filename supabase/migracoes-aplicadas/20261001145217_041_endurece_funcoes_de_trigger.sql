-- 20261001145217 041_endurece_funcoes_de_trigger

-- Duas correcoes apontadas pelo linter de seguranca, nas funcoes que criei.
--
-- 1) aura_aprendizado_toca_atualizado_em ficou sem "set search_path". Numa
--    funcao SECURITY DEFINER isso permite que o search_path de quem chama
--    decida quais objetos ela resolve. Eu tinha posto nas funcoes de origem e
--    esqueci nesta.
create or replace function public.aura_aprendizado_toca_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- 2) As tres funcoes de trigger estavam expostas como RPC em /rest/v1/rpc/...
--    para anon e authenticated. Chamar uma funcao de trigger fora de um trigger
--    falha de qualquer forma (nao existe NEW), mas funcao SECURITY DEFINER nao
--    deve ficar alcancavel pela API publica. Elas sao chamadas pelo trigger, que
--    roda como dono da tabela e nao depende deste EXECUTE.
revoke execute on function public.estampar_origem_do_lead() from anon, authenticated;
revoke execute on function public.estampar_origem_da_venda() from anon, authenticated;
revoke execute on function public.aura_aprendizado_toca_atualizado_em() from anon, authenticated;
