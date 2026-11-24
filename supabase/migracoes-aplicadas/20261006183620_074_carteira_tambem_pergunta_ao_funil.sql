-- 20261006183620 074_carteira_tambem_pergunta_ao_funil

-- 074 — A carteira também pergunta ao funil
--
-- Último lugar onde ainda havia nome de etapa escrito à mão. Depois de 072,
-- varri o banco atrás de 'Fechados' e sobraram quatro funções. Duas são
-- legítimas e ficam como estão:
--
--   aura_chave_da_etapa      é o próprio tradutor; precisa conhecer o nome
--                            antigo para traduzi-lo
--   aura_transferir_carteira é a função velha e quebrada (usa auth.uid() com
--                            o cliente de serviço, onde isso é NULL — nunca
--                            funcionou). Nada no código a chama mais; foi
--                            substituída por aura_mover_carteira. Fica para
--                            não quebrar uma referência que eu não enxergue.
--
-- As outras duas são reais, e as duas carregavam a mesma lista remendada:
-- `etapa not in ('Fechados', 'Perdidos', 'Fechamento')` — os nomes antigos E
-- o novo, colados um no outro para sobreviver à migração 068.
--
-- POR QUE ISSO IMPORTA: a lista só está certa porque as quatro lojas, hoje,
-- usam os nomes padrão. No dia em que um gestor renomear a etapa de ganho
-- para "Vendido!" — que é exatamente o que a aba Etapas do Funil oferece —
-- essas duas funções param de reconhecer o negócio fechado:
--
--   aura_mover_carteira       passaria a transferir negócios JÁ FECHADOS
--                             junto com a carteira, mexendo em venda feita
--   aura_excluir_funcionario  contaria negócio fechado como carteira viva e
--                             exigiria herdeiro para quem não tem mais nada
--                             em aberto
--
-- Agora as duas perguntam ao funil da loja, como todo o resto do sistema.

create or replace function public.aura_mover_carteira(
  p_executor uuid,
  p_origem uuid,
  p_destino uuid,
  p_motivo text default null,
  p_desativar_origem boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  -- Só o que ainda está em aberto, segundo o funil DESTA loja. Negócio já
  -- ganho ou perdido fica com quem o fechou: é o histórico dele.
  update public.oportunidades set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa
     and coalesce(public.aura_chave_da_etapa(empresa, etapa), '') not in ('fechamento', 'perda');
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

create or replace function public.aura_excluir_funcionario(
  p_executor uuid,
  p_alvo uuid,
  p_herdeiro uuid default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  -- "Carteira viva" é o que ainda está em aberto no funil DESTA loja. Contar
  -- negócio já fechado aqui faria o sistema exigir herdeiro de quem não tem
  -- mais nada para herdar.
  tem_carteira := tem_carteira + (
    select count(*) from public.oportunidades
     where owner_id = p_alvo
       and coalesce(public.aura_chave_da_etapa(empresa, etapa), '') not in ('fechamento', 'perda'));

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
