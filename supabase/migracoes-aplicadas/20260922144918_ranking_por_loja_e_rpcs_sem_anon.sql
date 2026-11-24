-- 20260922144918 ranking_por_loja_e_rpcs_sem_anon

-- Ranking passa a respeitar as regras de loja de quem consulta
-- (vendedor vê o ranking da própria loja; gestor/diretor veem todas).
alter view public.aura_ranking_vendas set (security_invoker = on);

-- Funções que mexem em leads não podem ser chamadas sem login.
revoke execute on function public.distribuir_lead_novo(uuid) from anon, public;
revoke execute on function public.repassar_leads_expirados() from anon, public;
revoke execute on function public.aura_transferir_carteira(uuid, uuid, text, boolean) from anon, public;
revoke execute on function public.contagem_atividades_recentes(integer) from anon, public;
grant execute on function public.distribuir_lead_novo(uuid) to authenticated, service_role;
grant execute on function public.repassar_leads_expirados() to authenticated, service_role;
grant execute on function public.aura_transferir_carteira(uuid, uuid, text, boolean) to authenticated, service_role;
grant execute on function public.contagem_atividades_recentes(integer) to authenticated, service_role;
