-- 064 - Excluir funcionario de verdade, com a carteira indo para alguem antes.
-- Aplicado em 05/10/2026 em quatro partes (064, 064b, 064c, 064d).
--
-- COMO ESTAVA: no painel do gestor havia dois botoes, um de "reativar" e uma
-- lixeira. Os dois chamavam a MESMA funcao: desativar. A lixeira perguntava
-- "Desativar Fulano?" e nao excluia nada. Nunca houve exclusao no sistema.
--
-- POR QUE A LINHA DA PESSOA NAO E APAGADA: profiles.id aponta para o cadastro
-- de acesso com ON DELETE CASCADE, e dele descem em cascata vendas,
-- relacionamentos, oportunidades, metas e atividades. Apagar a conta de um
-- vendedor apagaria as VENDAS dele junto -- o faturamento de um mes passado
-- mudaria de valor depois de alguem sair da empresa. E antes disso a exclusao
-- nem terminaria: tarefas, notificacoes, leads_recebidos e as campanhas de
-- marketing apontam para a conta com NO ACTION, e o banco recusaria.
--
-- O QUE "EXCLUIR" FAZ, ENTAO: a pessoa sai de todas as listas, perde o acesso
-- para sempre (banimento longo no Auth, feito pela rota) e a carteira vai para
-- quem o gestor escolher. A linha fica com a data da exclusao. E o unico jeito
-- de a exclusao nao reescrever o passado.

-- ---------- 064 ----------
alter table public.profiles
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid,
  add column if not exists excluido_motivo text;

comment on column public.profiles.excluido_em is
  'Preenchido = pessoa excluida: fora de todas as listas e sem acesso. O historico de vendas dela continua valendo.';

-- ---------- 064b: mover a carteira INTEIRA ----------
--
-- A funcao antiga movia relacionamentos e oportunidades e deixava para tras as
-- TAREFAS e os COMPROMISSOS -- quem recebia a carteira herdava os contatos sem
-- herdar as visitas marcadas. Tambem ficavam atras as conversas de WhatsApp e
-- os leads sem resposta.
--
-- E ela NUNCA funcionou: o executor era descoberto com auth.uid(), mas a rota
-- do painel chama pelo servidor, onde auth.uid() e nulo. Toda tentativa caia em
-- "Apenas Gestor ou Diretor pode transferir carteira", e transferencias_carteira
-- tinha zero linhas desde que o sistema existe. Agora quem executa vem como
-- parametro, conferido na rota e conferido de novo aqui.
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
  -- Gestor de uma loja nao mexe na carteira de outra. Gestor mestre, sim: ele
  -- responde pelo grupo e e quem resolve quando uma loja fica sem ninguem.
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

  -- Negocio fechado ou perdido fica com quem fechou: e historico, e mexer nele
  -- mudaria o resultado de quem nao trabalhou aquela venda. Os tres nomes
  -- cobrem o funil antigo e o renomeado.
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

  -- Lead ja respondido fica onde esta: conta como lead atendido por quem
  -- atendeu. So o que ninguem respondeu ainda passa adiante.
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

-- ---------- 064c: excluir, exigindo herdeiro ----------
--
-- A carteira e condicao, nao opcao: se o gestor pudesse excluir sem escolher
-- herdeiro, os contatos ficariam com dono inexistente -- invisiveis para todo
-- vendedor, porque cada um so ve a propria carteira. Seriam clientes perdidos
-- sem ninguem perceber. Quem nao tem nada na mao sai sem herdeiro.
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

  -- Sem isto o sistema poderia ficar sem ninguem capaz de aprovar gestor,
  -- excluir alguem ou transferir carteira entre lojas -- e nao haveria como
  -- voltar atras de dentro do painel.
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

  -- Aviso pessoal de quem saiu nao serve a mais ninguem.
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

-- Nenhuma das duas e chamavel pelo navegador: so pelo servidor, que confere
-- o cargo antes. Sem isto um vendedor logado chamaria a API do Supabase na
-- mao e puxaria a carteira de um colega para si.
revoke all on function public.aura_mover_carteira(uuid, uuid, uuid, text, boolean) from public;
revoke all on function public.aura_mover_carteira(uuid, uuid, uuid, text, boolean) from anon, authenticated;
revoke all on function public.aura_excluir_funcionario(uuid, uuid, uuid, text) from public;
revoke all on function public.aura_excluir_funcionario(uuid, uuid, uuid, text) from anon, authenticated;

-- A busca no manual tambem era chamavel por quem estava logado, passando o
-- nome de QUALQUER loja: dava para ler o material das outras.
revoke all on function public.aura_buscar_trechos(text, text, integer) from public;
revoke all on function public.aura_buscar_trechos(text, text, integer) from anon, authenticated;

-- ---------- 064d: distribuicao ignora quem foi excluido ----------
-- Toda pessoa excluida fica inativa, e a distribuicao ja exigia ativo. Estas
-- tres linhas sao o cinto de seguranca para o caso de alguem reativar a conta
-- direto no banco.
-- (corpo completo de distribuir_lead_novo aplicado na migracao 064d;
--  a unica diferenca em relacao a versao anterior e "and p.excluido_em is null"
--  nas tres consultas que escolhem SDR, Vendedor Interno e Vendedor.)
