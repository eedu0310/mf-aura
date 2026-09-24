-- Migration 023 — Fechar funções expostas na API (aplicada em produção)
--
-- O advisor do Supabase apontou que funções SECURITY DEFINER estavam
-- chamáveis por /rest/v1/rpc. A mais grave: aura_transferir_carteira,
-- que qualquer vendedor logado podia chamar para puxar a carteira de um
-- colega para si. Os gatilhos continuam funcionando normalmente — eles
-- rodam pelo dono da tabela, não pelo EXECUTE de quem fez a operação.

revoke execute on function
  public.aura_avisar_dono_do_lead(),
  public.aura_criar_pos_venda(),
  public.aura_distribuir_lead_ao_entrar(),
  public.aura_impedir_venda_duplicada(),
  public.aura_lead_respondido_vira_pipeline(),
  public.aura_sync_atividade_relacionamento(),
  public.aura_atividade_move_pipeline(),
  public.aura_venda_fecha_pipeline(),
  public.criar_pos_venda_apos_venda(),
  public.criar_pos_venda_automatico(),
  public.preencher_empresa_compromisso(),
  public.tocar_ultima_mensagem_conversa()
from anon, authenticated;

-- Operações de gestão: só pela chave de serviço, atrás de rota que confere
-- o cargo (/api/gestor/transferir-carteira, webhook e cron).
revoke execute on function
  public.aura_transferir_carteira(uuid, uuid, text, boolean),
  public.distribuir_lead_novo(uuid),
  public.repassar_leads_expirados()
from anon, authenticated;

-- Helpers de permissão não respondem para quem não fez login.
revoke execute on function
  public.meu_cargo(), public.cargo_atual(), public.minha_empresa(),
  public.pode_ver_marketing(), public.pode_ver_todas_empresas()
from anon;

-- ADENDO (aplicado depois): revogar de anon/authenticated não bastava.
-- No Postgres toda função nasce com EXECUTE para PUBLIC, e esse grant
-- implícito mantinha a porta aberta. O fechamento de verdade é revogar de
-- PUBLIC e depois devolver explicitamente o que as policies de RLS usam.

revoke execute on function
  public.aura_avisar_dono_do_lead(), public.aura_criar_pos_venda(),
  public.aura_criar_pedido_avaliacao(), public.aura_distribuir_lead_ao_entrar(),
  public.aura_impedir_venda_duplicada(), public.aura_lead_respondido_vira_pipeline(),
  public.aura_sync_atividade_relacionamento(), public.aura_atividade_move_pipeline(),
  public.aura_venda_fecha_pipeline(), public.criar_pos_venda_apos_venda(),
  public.criar_pos_venda_automatico(), public.preencher_empresa_compromisso(),
  public.tocar_ultima_mensagem_conversa(),
  public.aura_transferir_carteira(uuid, uuid, text, boolean),
  public.distribuir_lead_novo(uuid), public.repassar_leads_expirados()
from public;

revoke execute on function
  public.meu_cargo(), public.cargo_atual(), public.minha_empresa(),
  public.pode_ver_marketing(), public.pode_ver_todas_empresas()
from public;

-- As policies chamam estes helpers: quem está logado precisa continuar podendo.
grant execute on function
  public.meu_cargo(), public.cargo_atual(), public.minha_empresa(),
  public.pode_ver_marketing(), public.pode_ver_todas_empresas()
to authenticated;

-- ADENDO 2: aura_avancar_oportunidade não confere dono. Aberta ao usuário
-- logado, permitia um vendedor mover o negócio de um colega pelo funil —
-- inclusive para "Fechados", que dispara a criação de venda. Nenhum código
-- do navegador a chama: quem usa é a AURA no servidor, com a chave de
-- serviço, que ignora estes grants.
revoke execute on function
  public.aura_avancar_oportunidade(uuid, uuid, text, text, boolean)
from public, anon, authenticated;
