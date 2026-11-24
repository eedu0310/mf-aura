-- 20261005131511 064c_excluir_funcionario

create or replace function public.aura_excluir_funcionario(
  p_executor uuid, p_alvo uuid, p_herdeiro uuid default null, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  exec_p public.profiles%rowtype;
  alvo_p public.profiles%rowtype;
  tem_carteira int := 0;
  outros_mestres int := 0;
  movido jsonb := null;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into alvo_p from public.profiles where id = p_alvo;

  if exec_p.id is null or exec_p.gestor_mestre is not true then
    raise exception 'Só um gestor mestre pode excluir alguém da equipe.';
  end if;
  if alvo_p.id is null then
    raise exception 'Não encontrei esta pessoa.';
  end if;
  if alvo_p.excluido_em is not null then
    raise exception '% já está excluído.', alvo_p.nome;
  end if;
  if p_alvo = p_executor then
    raise exception 'Você não pode excluir a sua própria conta.';
  end if;

  if alvo_p.gestor_mestre is true then
    select count(*) into outros_mestres from public.profiles
     where gestor_mestre = true and excluido_em is null and id <> p_alvo;
    if outros_mestres = 0 then
      raise exception 'Este é o último gestor mestre. Promova outra pessoa antes de excluir.';
    end if;
  end if;

  select count(*) into tem_carteira from public.relacionamentos where owner_id = p_alvo;
  tem_carteira := tem_carteira + (
    select count(*) from public.oportunidades
     where owner_id = p_alvo and etapa not in ('Fechados', 'Perdidos', 'Fechamento'));

  if p_herdeiro is not null then
    movido := public.aura_mover_carteira(p_executor, p_alvo, p_herdeiro,
      coalesce(nullif(btrim(p_motivo), ''), 'Exclusão de ' || alvo_p.nome), false);
  elsif tem_carteira > 0 then
    raise exception '% tem % registros na carteira. Escolha quem assume antes de excluir.',
      alvo_p.nome, tem_carteira;
  end if;

  update public.notificacoes set lida = true, lida_em = coalesce(lida_em, now())
   where vendedor_id = p_alvo and lida is not true;

  update public.profiles set
    excluido_em = now(), excluido_por = p_executor,
    excluido_motivo = nullif(btrim(p_motivo), ''),
    ativo = false, gestor_mestre = false, gestor_aprovado = false,
    permissoes = '{}'::jsonb
  where id = p_alvo;

  return jsonb_build_object('sucesso', true, 'nome', alvo_p.nome, 'carteira', movido);
end;
$$;

revoke all on function public.aura_mover_carteira(uuid, uuid, uuid, text, boolean) from public;
revoke all on function public.aura_mover_carteira(uuid, uuid, uuid, text, boolean) from anon, authenticated;
revoke all on function public.aura_excluir_funcionario(uuid, uuid, uuid, text) from public;
revoke all on function public.aura_excluir_funcionario(uuid, uuid, uuid, text) from anon, authenticated;
