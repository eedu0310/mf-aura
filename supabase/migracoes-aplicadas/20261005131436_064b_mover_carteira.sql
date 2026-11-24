-- 20261005131436 064b_mover_carteira

create or replace function public.aura_mover_carteira(
  p_executor uuid, p_origem uuid, p_destino uuid,
  p_motivo text default null, p_desativar_origem boolean default false
) returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  exec_p public.profiles%rowtype;
  org_p  public.profiles%rowtype;
  dst_p  public.profiles%rowtype;
  n_rel int := 0; n_opo int := 0; n_tar int := 0; n_com int := 0;
  n_wa  int := 0; n_lead int := 0; n_pos int := 0;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into org_p  from public.profiles where id = p_origem;
  select * into dst_p  from public.profiles where id = p_destino;

  if exec_p.id is null or exec_p.cargo <> 'Gestor' or exec_p.gestor_aprovado is not true then
    raise exception 'Só um gestor aprovado pode transferir carteira.';
  end if;
  if org_p.id is null or dst_p.id is null then
    raise exception 'Não encontrei quem entrega ou quem recebe a carteira.';
  end if;
  if p_origem = p_destino then
    raise exception 'Escolha duas pessoas diferentes.';
  end if;
  if dst_p.ativo is not true or dst_p.excluido_em is not null then
    raise exception 'Quem recebe a carteira precisa estar ativo no sistema.';
  end if;
  if exec_p.gestor_mestre is not true
     and (exec_p.empresa <> org_p.empresa or exec_p.empresa <> dst_p.empresa) then
    raise exception 'O gestor só transfere carteira dentro da própria loja.';
  end if;
  if org_p.empresa <> dst_p.empresa then
    raise exception 'A carteira não atravessa lojas: quem recebe precisa ser da mesma loja de quem entrega.';
  end if;

  update public.relacionamentos set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_rel = row_count;

  update public.oportunidades set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa
     and etapa not in ('Fechados', 'Perdidos', 'Fechamento');
  get diagnostics n_opo = row_count;

  update public.tarefas set vendedor_id = p_destino, updated_at = now()
   where vendedor_id = p_origem and concluida is not true;
  get diagnostics n_tar = row_count;

  update public.compromissos set owner_id = p_destino, atualizado_em = now()
   where owner_id = p_origem and concluido is not true;
  get diagnostics n_com = row_count;

  update public.whatsapp_ia_leads set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_wa = row_count;

  update public.leads_recebidos set vendedor_id = p_destino, updated_at = now()
   where vendedor_id = p_origem and respondido_em is null and descartado_em is null;
  get diagnostics n_lead = row_count;

  update public.pos_vendas set responsavel_id = p_destino, updated_at = now()
   where responsavel_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_pos = row_count;

  if p_desativar_origem then
    update public.profiles set ativo = false where id = p_origem;
  end if;

  insert into public.transferencias_carteira (
    empresa, usuario_origem_id, usuario_destino_id, criado_por, motivo,
    relacionamentos_transferidos, oportunidades_transferidas, desativou_origem
  ) values (
    org_p.empresa, p_origem, p_destino, p_executor,
    coalesce(nullif(btrim(p_motivo), ''), 'Transferência pelo painel do gestor'),
    n_rel, n_opo, p_desativar_origem
  );

  return jsonb_build_object('sucesso', true,
    'relacionamentos', n_rel, 'oportunidades', n_opo, 'tarefas', n_tar,
    'compromissos', n_com, 'conversas', n_wa, 'leads_pendentes', n_lead,
    'pos_vendas', n_pos, 'desativou_origem', p_desativar_origem);
end;
$$;
