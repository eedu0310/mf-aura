-- 041 — Duas correções apontadas pelo linter de segurança do Supabase, nas
-- funções criadas nas migrations 036 e 037.
--
-- 1) aura_aprendizado_toca_atualizado_em ficou sem "set search_path". Numa
--    função SECURITY DEFINER isso deixa o search_path de quem chama decidir
--    quais objetos a função resolve. Estava nas funções de origem e faltou
--    nesta.
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

-- 2) As três funções de trigger estavam alcançáveis como RPC em
--    /rest/v1/rpc/... por anon e authenticated. Chamar função de trigger fora
--    de um trigger falha de qualquer forma (não existe NEW), mas função
--    SECURITY DEFINER não deve ficar exposta na API pública. O trigger roda
--    como dono da tabela e não depende deste EXECUTE — validado com insert em
--    cadeia e rollback: a venda continuou sendo estampada com a origem do lead.
revoke execute on function public.estampar_origem_do_lead() from anon, authenticated;
revoke execute on function public.estampar_origem_da_venda() from anon, authenticated;
revoke execute on function public.aura_aprendizado_toca_atualizado_em() from anon, authenticated;

-- Nota para depois: aura_apagar_card_leva_a_venda() (migration 034) tem a mesma
-- forma — função de trigger exposta como RPC. Não mexi porque não é desta
-- entrega; vale o mesmo revoke quando for conveniente.
