-- Desfazer uma exclusao, e dar senha nova a quem esqueceu a dela.
--
-- A exclusao foi feita para ser definitiva: tira das listas, bane o acesso e
-- repassa a carteira. Faltou a porta de volta -- e a primeira pessoa excluida
-- no sistema foi excluida POR ENGANO, num teste. Sem isto, o caminho que
-- parece obvio e apagar a conta no Supabase e criar de novo; so que a conta e
-- referenciada por notificacoes, tarefas e leads, e o banco recusa a exclusao
-- (no caso real, 21 notificacoes). A pessoa fica num limbo: fora da equipe e
-- impossivel de recriar.
--
-- O QUE NAO VOLTA, de proposito:
--  - A CARTEIRA: os clientes ja sao de quem recebeu, e devolver na marra
--    passaria por cima de um trabalho que talvez ja tenha comecado. Para
--    desfazer, usa-se a transferencia de carteira, que registra a devolucao.
--  - OS PODERES: gestor volta esperando aprovacao, e ninguem volta como
--    mestre. Devolver poder junto com o acesso seria repor, sem ninguem
--    decidir, exatamente o que a exclusao tirou.
create or replace function public.aura_restaurar_funcionario(
  p_executor uuid, p_alvo uuid
) returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  exec_p public.profiles%rowtype;
  alvo_p public.profiles%rowtype;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into alvo_p from public.profiles where id = p_alvo;

  if exec_p.id is null or exec_p.gestor_mestre is not true then
    raise exception 'Só um gestor mestre pode trazer alguém de volta.';
  end if;
  if alvo_p.id is null then
    raise exception 'Não encontrei esta pessoa.';
  end if;
  if alvo_p.excluido_em is null then
    raise exception '% não está excluído.', alvo_p.nome;
  end if;

  update public.profiles set
    excluido_em = null, excluido_por = null, excluido_motivo = null,
    ativo = true, gestor_mestre = false, gestor_aprovado = false
  where id = p_alvo;

  return jsonb_build_object('sucesso', true, 'nome', alvo_p.nome, 'cargo', alvo_p.cargo,
    'empresa', alvo_p.empresa, 'era_mestre', coalesce(alvo_p.gestor_mestre, false));
end;
$$;

revoke all on function public.aura_restaurar_funcionario(uuid, uuid) from public;
revoke all on function public.aura_restaurar_funcionario(uuid, uuid) from anon, authenticated;
