-- 109 · Correções do pente fino de 25/11/2026
--
-- Auditoria só de leitura, conferida contra a produção (consultas SELECT) e
-- contra o código em src/. Cada bloco abaixo tem o número do achado.
--
-- ORDEM: 105 → 108 → 109 → 110 (os números 106 e 107 são do Instagram e do chat do site, já aplicados). Juntas, depois da aprovação do dono.
-- Esta migração USA a função administro_a_loja(text) criada pela 105 e
-- depende de vejo_a_loja_toda() já sem o cargo "Diretor". Sem a 105 ela
-- para logo no começo, sem mudar nada (bloco 0).
--
-- Pode rodar mais de uma vez: tudo é "if exists / if not exists / drop
-- policy if exists antes de create / create or replace".
--
-- Tudo numa transação só: se qualquer passo falhar, nada fica pela metade.

begin;

-- ===================================================================
-- 0. Trava: a 105 precisa estar aplicada.
-- ===================================================================
do $$
begin
  if to_regprocedure('public.administro_a_loja(text)') is null then
    raise exception 'Aplique a migração 105 antes da 109 (falta administro_a_loja).';
  end if;
  if pg_get_functiondef('public.vejo_a_loja_toda()'::regprocedure) like '%Diretor%' then
    raise exception 'Aplique a migração 105 antes da 109 (vejo_a_loja_toda ainda aceita Diretor).';
  end if;
end $$;

-- ===================================================================
-- 1. Apagar a conta de acesso não pode levar a carteira junto.
-- ===================================================================
-- Hoje vendas, oportunidades, clientes, atividades, agenda, conversas do
-- WhatsApp, metas e compromissos mensais apontam para a conta de acesso com
-- "apagar em cascata": se alguém apagasse a conta no painel do Supabase, o
-- faturamento e a carteira da pessoa sumiriam junto, sem aviso.
--
-- Passa a ser "RESTRICT": o banco RECUSA apagar a conta enquanto houver
-- carteira ou histórico ligado a ela. Nenhuma tela depende da cascata:
--   * a exclusão normal (excluir-usuario) não apaga a conta, só bloqueia o
--     login e passa a carteira adiante;
--   * a exclusão de cadastro incompleto já transfere a carteira ANTES de
--     apagar (e hoje a única conta sem cadastro não tem metas nem compromissos
--     mensais, só 2 clientes e 1 oportunidade, que a tela transfere);
--   * criar-usuario só apaga a conta recém-criada, que ainda não tem nada.
-- O que continua em cascata de propósito: coisas auxiliares que não são
-- histórico de venda (conversas com a AURA, progresso de treino, metas de
-- atividade/indicadores, relatórios gerados, supervisões).
do $$
declare
  r record;
  v_rel regclass;
begin
  for r in
    select * from (values
      ('vendas',                'vendas_owner_id_fkey',                  'owner_id'),
      ('oportunidades',         'oportunidades_owner_id_fkey',           'owner_id'),
      ('relacionamentos',       'relacionamentos_owner_id_fkey',         'owner_id'),
      ('atividades',            'atividades_owner_id_fkey',              'owner_id'),
      ('compromissos',          'compromissos_owner_id_fkey',            'owner_id'),
      ('whatsapp_ia_leads',     'whatsapp_ia_leads_owner_id_fkey',       'owner_id'),
      ('whatsapp_transcricoes', 'whatsapp_transcricoes_owner_id_fkey',   'owner_id'),
      ('metas',                 'metas_owner_id_fkey',                   'owner_id'),
      ('compromissos_mensais',  'compromissos_mensais_vendedor_id_fkey', 'vendedor_id'),
      ('indicadores_semanais',  'indicadores_semanais_vendedor_id_fkey', 'vendedor_id')
    ) as t(tabela, nome, coluna)
  loop
    v_rel := to_regclass(format('public.%I', r.tabela));
    if v_rel is null then
      raise notice 'Tabela % não existe; pulei.', r.tabela;
      continue;
    end if;
    -- Só refaz se ainda não for RESTRICT ('r'). Rodar de novo não faz nada.
    if exists (select 1 from pg_constraint c
                where c.conrelid = v_rel and c.conname = r.nome
                  and c.contype = 'f' and c.confdeltype <> 'r') then
      execute format('alter table public.%I drop constraint %I', r.tabela, r.nome);
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete restrict not valid',
        r.tabela, r.nome, r.coluna);
      execute format('alter table public.%I validate constraint %I', r.tabela, r.nome);
    end if;
  end loop;
end $$;

-- A tabela compromissos_mensais tinha DUAS chaves iguais (vendedor_id →
-- auth.users, ambas em cascata). Sobra só a de nome padrão, já em RESTRICT.
do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'public.compromissos_mensais'::regclass
                and conname = 'compromissos_mensais_vendedor_id_fkey') then
    alter table public.compromissos_mensais drop constraint if exists fk_compromissos_vendedor;
  end if;
end $$;

-- ===================================================================
-- 2. Gestor de UMA loja não mexe nas outras lojas.
-- ===================================================================
-- vejo_a_loja_toda() responde "é gestor aprovado", mas NÃO diz de qual loja.
-- Usada sozinha, deixava o gestor (não mestre) de uma loja ler e editar a
-- agenda, orçamentos, relatórios, campanhas, Instagram, avaliações e custos
-- da IA das outras três. administro_a_loja(empresa) (da 105) responde
-- "manda NESTA loja": mestre manda em todas, gestor só na dele.
-- Hoje os 4 gestores ativos são mestres, então ninguém perde acesso agora;
-- a regra fica certa para o primeiro gestor de loja que entrar.
-- O resto de cada regra (o dono vê o que é dele etc.) continua igual.

-- compromissos (agenda)
drop policy if exists "Ver compromissos conforme papel" on public.compromissos;
create policy "Ver compromissos conforme papel" on public.compromissos
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.administro_a_loja(empresa));

-- compromissos_mensais (a regra de apagar já conferia a loja e fica como está)
drop policy if exists "Vendedor vê e edita o próprio compromisso" on public.compromissos_mensais;
create policy "Vendedor vê e edita o próprio compromisso" on public.compromissos_mensais
  for select to authenticated
  using (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

drop policy if exists "Vendedor edita o próprio compromisso enquanto não aprovado" on public.compromissos_mensais;
create policy "Vendedor edita o próprio compromisso enquanto não aprovado" on public.compromissos_mensais
  for update to authenticated
  using (
    (vendedor_id = (select auth.uid()) and status = any (array['rascunho', 'ajuste_solicitado']))
    or public.administro_a_loja(empresa)
  );

-- orcamentos_anexos
drop policy if exists "Dono anexa orcamento" on public.orcamentos_anexos;
create policy "Dono anexa orcamento" on public.orcamentos_anexos
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or public.administro_a_loja(empresa));

drop policy if exists "Dono ou gestor remove orcamento" on public.orcamentos_anexos;
create policy "Dono ou gestor remove orcamento" on public.orcamentos_anexos
  for delete to authenticated
  using (owner_id = (select auth.uid()) or public.administro_a_loja(empresa));

drop policy if exists "Dono ou gestor ve os orcamentos" on public.orcamentos_anexos;
create policy "Dono ou gestor ve os orcamentos" on public.orcamentos_anexos
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.administro_a_loja(empresa));

-- pedidos_avaliacao
drop policy if exists pedidos_avaliacao_atualizar on public.pedidos_avaliacao;
create policy pedidos_avaliacao_atualizar on public.pedidos_avaliacao
  for update to authenticated
  using (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa))
  with check (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

drop policy if exists pedidos_avaliacao_ler on public.pedidos_avaliacao;
create policy pedidos_avaliacao_ler on public.pedidos_avaliacao
  for select to authenticated
  using (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

-- relatorios_periodicos
drop policy if exists "Criar relatórios conforme papel" on public.relatorios_periodicos;
create policy "Criar relatórios conforme papel" on public.relatorios_periodicos
  for insert to authenticated
  with check (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

drop policy if exists "Ver relatórios conforme papel" on public.relatorios_periodicos;
create policy "Ver relatórios conforme papel" on public.relatorios_periodicos
  for select to authenticated
  using (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

-- ia_uso / ia_falhas (o painel lê pela chave de serviço; isto vale para quem
-- tentar ler direto). Linhas sem loja (chamadas de sistema) só o mestre vê.
drop policy if exists "Gestor vê o consumo da IA" on public.ia_uso;
create policy "Gestor vê o consumo da IA" on public.ia_uso
  for select to authenticated
  using (public.administro_a_loja(empresa));

drop policy if exists ia_falhas_gestor_le on public.ia_falhas;
create policy ia_falhas_gestor_le on public.ia_falhas
  for select to authenticated
  using (public.administro_a_loja(empresa));

-- ia_config / ia_creditos não têm loja: são do grupo. Preço, depósito e o
-- bloqueio por falta de saldo valem para as quatro lojas, então só o gestor
-- mestre mexe. (A tela usa a chave de serviço; nada muda para ela.)
drop policy if exists "Gestor ajusta a configuração da IA" on public.ia_config;
create policy "Gestor ajusta a configuração da IA" on public.ia_config
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

drop policy if exists "Gestor gerencia os créditos da IA" on public.ia_creditos;
create policy "Gestor gerencia os créditos da IA" on public.ia_creditos
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

-- campanhas_marketing / postagens_marketing
drop policy if exists "Marketing gerencia campanhas da própria loja" on public.campanhas_marketing;
create policy "Marketing gerencia campanhas da própria loja" on public.campanhas_marketing
  for all to authenticated
  using ((public.meu_cargo() = 'Marketing' and empresa = public.minha_empresa()) or public.administro_a_loja(empresa))
  with check ((public.meu_cargo() = 'Marketing' and empresa = public.minha_empresa()) or public.administro_a_loja(empresa));

drop policy if exists "Ver campanhas conforme papel" on public.campanhas_marketing;
create policy "Ver campanhas conforme papel" on public.campanhas_marketing
  for select to authenticated
  using (empresa = public.minha_empresa() or public.administro_a_loja(empresa));

drop policy if exists "Marketing gerencia postagens da própria loja" on public.postagens_marketing;
create policy "Marketing gerencia postagens da própria loja" on public.postagens_marketing
  for all to authenticated
  using ((public.meu_cargo() = 'Marketing' and empresa = public.minha_empresa()) or public.administro_a_loja(empresa))
  with check ((public.meu_cargo() = 'Marketing' and empresa = public.minha_empresa()) or public.administro_a_loja(empresa));

drop policy if exists "Ver postagens conforme papel" on public.postagens_marketing;
create policy "Ver postagens conforme papel" on public.postagens_marketing
  for select to authenticated
  using (empresa = public.minha_empresa() or public.administro_a_loja(empresa));

-- Instagram (meta_conversas, meta_mensagens, meta_comentarios)
drop policy if exists meta_conversas_da_loja on public.meta_conversas;
create policy meta_conversas_da_loja on public.meta_conversas
  for all to authenticated
  using (empresa = public.minha_empresa() or public.administro_a_loja(empresa))
  with check (empresa = public.minha_empresa() or public.administro_a_loja(empresa));

drop policy if exists meta_comentarios_da_loja on public.meta_comentarios;
create policy meta_comentarios_da_loja on public.meta_comentarios
  for all to authenticated
  using (empresa = public.minha_empresa() or public.administro_a_loja(empresa))
  with check (empresa = public.minha_empresa() or public.administro_a_loja(empresa));

drop policy if exists meta_mensagens_da_loja on public.meta_mensagens;
create policy meta_mensagens_da_loja on public.meta_mensagens
  for all to authenticated
  using (exists (
    select 1 from public.meta_conversas c
     where c.id = meta_mensagens.conversa_id
       and (c.empresa = public.minha_empresa() or public.administro_a_loja(c.empresa))))
  with check (exists (
    select 1 from public.meta_conversas c
     where c.id = meta_mensagens.conversa_id
       and (c.empresa = public.minha_empresa() or public.administro_a_loja(c.empresa))));

-- config_avaliacao (links do Google/Instagram de cada loja)
drop policy if exists config_avaliacao_escrever on public.config_avaliacao;
create policy config_avaliacao_escrever on public.config_avaliacao
  for all to authenticated
  using (public.administro_a_loja(empresa))
  with check (public.administro_a_loja(empresa));

-- ranking_config / ranking_criterios / compromisso_mensal_campos não têm loja:
-- valem para o grupo inteiro. Mudar o peso do ranking muda a nota das quatro
-- lojas, então só o gestor mestre mexe. (O ranking é lido e gravado pela
-- chave de serviço, e compromisso_mensal_campos nem é usada pelo app hoje.)
drop policy if exists ranking_config_gestor on public.ranking_config;
create policy ranking_config_gestor on public.ranking_config
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

drop policy if exists ranking_criterios_gestor on public.ranking_criterios;
create policy ranking_criterios_gestor on public.ranking_criterios
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

drop policy if exists campos_extras_gestor on public.compromisso_mensal_campos;
create policy campos_extras_gestor on public.compromisso_mensal_campos
  for all to authenticated
  using (public.pode_ver_todas_empresas())
  with check (public.pode_ver_todas_empresas());

-- pos_vendas: a regra antiga de atualização deixava o gestor de uma loja
-- editar o pós-venda das outras. (A 105 já criou pos_vendas_update com a loja
-- conferida; esta fica igual a ela, só para não abrir a porta de novo.)
drop policy if exists "Atualizar pós-vendas conforme papel" on public.pos_vendas;
create policy "Atualizar pós-vendas conforme papel" on public.pos_vendas
  for update to authenticated
  using (
    public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa())
  );

-- profiles: "Ver perfis conforme papel" mostrava ao gestor (não mestre) os
-- perfis das quatro lojas. Corrigida, ela ficaria idêntica a "Gestor e
-- diretor veem todos os perfis" (mestre vê todos, os outros veem a própria
-- loja), então sai. Ninguém perde nada hoje: os gestores são todos mestres.
drop policy if exists "Ver perfis conforme papel" on public.profiles;

-- ===================================================================
-- 3. Tabelas de configuração não ficam abertas para quem não fez login.
-- ===================================================================
-- Estas regras de leitura eram "para todos, sempre verdadeiro" — inclusive a
-- chave pública, sem login. As páginas públicas (/av, /avaliar, /f, /s e o
-- site) leem pela chave de serviço ou por funções próprias, nunca direto
-- destas tabelas; então a leitura passa a exigir login.
drop policy if exists config_avaliacao_ler on public.config_avaliacao;
create policy config_avaliacao_ler on public.config_avaliacao
  for select to authenticated using (true);

drop policy if exists ranking_config_ler on public.ranking_config;
create policy ranking_config_ler on public.ranking_config
  for select to authenticated using (true);

drop policy if exists ranking_criterios_ler on public.ranking_criterios;
create policy ranking_criterios_ler on public.ranking_criterios
  for select to authenticated using (true);

drop policy if exists campos_extras_ler on public.compromisso_mensal_campos;
create policy campos_extras_ler on public.compromisso_mensal_campos
  for select to authenticated using (true);

drop policy if exists "Vendedores podem ver perguntas" on public.perguntas_qualificacao;
create policy "Vendedores podem ver perguntas" on public.perguntas_qualificacao
  for select to authenticated using (true);

-- A trava (restritiva) das perguntas continua, agora com a loja conferida.
drop policy if exists "Trava de loja nas perguntas de qualificação" on public.perguntas_qualificacao;
create policy "Trava de loja nas perguntas de qualificação" on public.perguntas_qualificacao
  as restrictive for select to authenticated
  using (empresa = public.minha_empresa() or public.administro_a_loja(empresa));

-- ===================================================================
-- 4. Regras antigas que se sobrepunham às novas.
-- ===================================================================

-- 4a. pos_vendas: "Usuários atualizam pós-vendas da empresa" deixava QUALQUER
-- pessoa da loja editar QUALQUER pós-venda da loja, inclusive a nota que o
-- cliente deu. Continua existindo (com o mesmo nome) só para o caso que o app
-- usa: o vendedor, pela AURA Coach (src/lib/aura-tools.ts), atualiza o status,
-- agendamento, observação e reclamação do pós-venda das PRÓPRIAS vendas.
-- Pós-venda e gestor continuam pelas regras da 105 (pos_vendas_update).
drop policy if exists "Usuários atualizam pós-vendas da empresa" on public.pos_vendas;
create policy "Usuários atualizam pós-vendas da empresa" on public.pos_vendas
  for update to authenticated
  using (
    vendedor_id = (select auth.uid())
    or exists (select 1 from public.vendas v
                where v.id = pos_vendas.venda_id and v.owner_id = (select auth.uid()))
  )
  with check (
    vendedor_id = (select auth.uid())
    or exists (select 1 from public.vendas v
                where v.id = pos_vendas.venda_id and v.owner_id = (select auth.uid()))
  );

-- 4b. A nota do cliente não é dada pelo próprio vendedor.
-- O banco não sabe limitar por coluna numa regra de linha, então um gatilho
-- confere: se quem está logado mudar a avaliação (avaliou_loja, nota,
-- comentário), tem de ser o pós-venda da loja ou o gestor dela. A página
-- pública /avaliar (função própria do banco) e as rotas do servidor (chave de
-- serviço) não passam por esta conferência.
-- EFEITO NO APP: a ferramenta "registrar_avaliacao_cliente" da AURA Coach,
-- quando usada por um VENDEDOR, passa a responder "Não consegui registrar a
-- avaliação: Só o pós-venda ou o gestor da loja registra a avaliação do
-- cliente." Para o pós-venda e o gestor ela continua funcionando.
create or replace function public.aura_proteger_avaliacao_pos_venda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Só confere o que vem direto de alguém logado pelo app.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.avaliou_loja is not distinct from old.avaliou_loja
     and new.nota_avaliacao is not distinct from old.nota_avaliacao
     and new.comentario_avaliacao is not distinct from old.comentario_avaliacao then
    return new;
  end if;
  if public.administro_a_loja(new.empresa)
     or (public.meu_cargo() = 'Pós-venda' and new.empresa = public.minha_empresa()) then
    return new;
  end if;
  raise exception 'Só o pós-venda ou o gestor da loja registra a avaliação do cliente.'
    using errcode = '42501';
end;
$$;
revoke all on function public.aura_proteger_avaliacao_pos_venda() from public, anon;

drop trigger if exists trg_aura_proteger_avaliacao_pos_venda on public.pos_vendas;
create trigger trg_aura_proteger_avaliacao_pos_venda
  before update of avaliou_loja, nota_avaliacao, comentario_avaliacao on public.pos_vendas
  for each row execute function public.aura_proteger_avaliacao_pos_venda();

-- 4c. O que conta ponto no ranking ("avaliação conquistada") é o pedido de
-- avaliação aberto pelo cliente ou confirmado pelo gestor. O vendedor pode
-- editar o próprio pedido (marcar que enviou o link), mas não pode se dar o
-- "aberto" nem o "confirmado". O "aberto" é gravado pelo link /av (chave de
-- serviço) e o "confirmado" pelo gestor; os dois continuam funcionando.
create or replace function public.aura_proteger_confirmacao_avaliacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.aberto_em is not distinct from old.aberto_em
     and new.confirmado_em is not distinct from old.confirmado_em
     and new.confirmado_por is not distinct from old.confirmado_por then
    return new;
  end if;
  if public.administro_a_loja(new.empresa) then
    return new;
  end if;
  raise exception 'Só o gestor da loja confirma a avaliação do cliente.'
    using errcode = '42501';
end;
$$;
revoke all on function public.aura_proteger_confirmacao_avaliacao() from public, anon;

drop trigger if exists trg_aura_proteger_confirmacao_avaliacao on public.pedidos_avaliacao;
create trigger trg_aura_proteger_confirmacao_avaliacao
  before update of aberto_em, confirmado_em, confirmado_por on public.pedidos_avaliacao
  for each row execute function public.aura_proteger_confirmacao_avaliacao();

-- 4d. Regras repetidas: mesmo comando, mesmos papéis e a mesma condição de
-- outra regra que continua. Tirar não muda quem vê o quê.
drop policy if exists "Gestor e diretor veem todas as empresas" on public.atividades;      -- = "Ver atividades conforme papel"
drop policy if exists "Gestor e diretor veem todas as empresas" on public.oportunidades;   -- = "Ver oportunidades conforme papel"
drop policy if exists "Gestor e diretor veem todas as empresas" on public.relacionamentos; -- = "Ver relacionamentos conforme papel"
drop policy if exists "Gestor e diretor veem todas as empresas" on public.vendas;          -- = "Ver vendas conforme papel"
drop policy if exists "Usuários consultam pós-vendas da empresa" on public.pos_vendas;     -- = "Ver pós-vendas conforme papel"
drop policy if exists "Marketing e gestão veem todos os leads" on public.leads_recebidos;  -- = "Ver leads conforme papel"
drop policy if exists "Vendedores veem seus leads" on public.leads_recebidos;              -- = "Ver leads conforme papel"
drop policy if exists "Vendedores veem só suas tarefas" on public.tarefas;                 -- = "Usuário vê próprias tarefas" (uid = vendedor_id)
drop policy if exists "Usuário vê seu progresso" on public.treinamento_progresso;          -- = "Ver meu progresso"
drop policy if exists "Usuário atualiza seu progresso" on public.treinamento_progresso;    -- é INSERT, = "Criar meu progresso"
drop policy if exists "Atualizar meu progresso" on public.treinamento_progresso;           -- = "Usuário edita seu progresso" (sem checagem, vale a mesma)

-- 4e. Transferências de carteira: qualquer pessoa da loja (não só o gestor)
-- lia e podia registrar transferências. As transferências de verdade são
-- gravadas por funções do banco (aura_transferir_carteira / aura_mover_carteira),
-- que não passam por estas regras; então só o gestor da loja enxerga.
drop policy if exists "Gestor consulta transferências da própria empresa" on public.transferencias_carteira;
create policy "Gestor consulta transferências da própria empresa" on public.transferencias_carteira
  for select to authenticated
  using (public.administro_a_loja(empresa));

drop policy if exists "Gestor registra transferência da própria empresa" on public.transferencias_carteira;
create policy "Gestor registra transferência da própria empresa" on public.transferencias_carteira
  for insert to authenticated
  with check (public.administro_a_loja(empresa) and criado_por = (select auth.uid()));

-- 4f. Lead criado pelo vendedor: a regra só conferia o dono, e o vendedor
-- podia criar lead em QUALQUER loja. Agora tem de ser a loja dele (a regra
-- "Criar leads na própria loja" continua cobrindo o mestre).
drop policy if exists "Vendedores criam leads" on public.leads_recebidos;
create policy "Vendedores criam leads" on public.leads_recebidos
  for insert to authenticated
  with check (vendedor_id = (select auth.uid()) and empresa = (select public.minha_empresa()));

-- ===================================================================
-- 5. Quem edita as perguntas de qualificação.
-- ===================================================================
-- A regra procurava o cargo dentro do token de login, onde ele não existe:
-- na prática ninguém conseguia editar pelo app. Passa a ser o gestor da loja.
drop policy if exists "Gestores podem gerenciar" on public.perguntas_qualificacao;
create policy "Gestores podem gerenciar" on public.perguntas_qualificacao
  for all to authenticated
  using (public.administro_a_loja(empresa))
  with check (public.administro_a_loja(empresa));

-- ===================================================================
-- 6. campanha_do_anuncio só pelo servidor.
-- ===================================================================
-- A função cria campanha de marketing em qualquer loja e com qualquer autor,
-- e passa por cima das regras (SECURITY DEFINER). Quem chama é só o
-- supervisor do WhatsApp, pela chave de serviço. Tira de quem está logado.
revoke execute on function public.campanha_do_anuncio(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.campanha_do_anuncio(text, text, text, text, uuid) to service_role;

-- ===================================================================
-- 7. Negócio que vai para "Perdidos" ganha a data da perda.
-- ===================================================================
-- O relatório semanal conta as perdas pela data_perda. O app já grava a data
-- quando o negócio é arrastado, mas a AURA (ferramentas e tarefas) e outros
-- caminhos mudavam só a etapa: 53 negócios estão perdidos sem data.
-- Caminho que mais precisa disto: a troca manual de etapa pelo WhatsApp
-- (definirEtapaManual, no supervisor) leva o card para a perda sem data.
--
-- O gatilho segue a MESMA regra do app (src/lib/perda-oportunidade.ts):
--   entrou na perda (etapa nova é de perda no funil da loja: tipo = 'perda'
--     em etapas_funil; para loja sem funil próprio, o nome padrão
--     "Perdidos") e ninguém mandou a data → grava o dia de hoje em São Paulo,
--     no mesmo formato do app (só o dia, sem hora). O motivo não é inventado:
--     só quem sabe é o vendedor;
--   saiu da perda → motivo, descrição e data voltam a vazio (negócio
--     recuperado não pode continuar contando como perdido);
--   o resto → não mexe.
create or replace function public.aura_carimbar_data_perda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo_perda boolean;
  v_velho_perda boolean := false;
begin
  if tg_op = 'UPDATE' and old.etapa is not distinct from new.etapa then
    return new;
  end if;

  v_novo_perda :=
    exists (select 1 from public.etapas_funil e
             where e.empresa = new.empresa and e.nome = new.etapa and e.tipo = 'perda')
    or (new.etapa = 'Perdidos'
        and not exists (select 1 from public.etapas_funil e where e.empresa = new.empresa));

  if tg_op = 'UPDATE' then
    v_velho_perda :=
      exists (select 1 from public.etapas_funil e
               where e.empresa = old.empresa and e.nome = old.etapa and e.tipo = 'perda')
      or (old.etapa = 'Perdidos'
          and not exists (select 1 from public.etapas_funil e where e.empresa = old.empresa));
  end if;

  if v_novo_perda and not v_velho_perda then
    if new.data_perda is null then
      new.data_perda := (now() at time zone 'America/Sao_Paulo')::date::timestamp;
    end if;
  elsif v_velho_perda and not v_novo_perda then
    new.motivo_perda := null;
    new.descricao_perda := null;
    new.data_perda := null;
  end if;
  return new;
end;
$$;
revoke all on function public.aura_carimbar_data_perda() from public, anon;

drop trigger if exists trg_aura_carimbar_data_perda on public.oportunidades;
create trigger trg_aura_carimbar_data_perda
  before insert or update of etapa on public.oportunidades
  for each row execute function public.aura_carimbar_data_perda();

-- Os 53 que já estão perdidos sem data recebem a data do updated_at (dia de
-- São Paulo). É APROXIMADA: em 35 dos 52 da Sole o updated_at é igual à
-- criação (o card nunca foi tocado depois), então para esses a data é o dia
-- em que o card nasceu, não o dia exato da perda. Melhor que vazio: sem data
-- o relatório semanal não enxerga a perda de jeito nenhum.
-- Roda ANTES do gatilho do bloco 8 existir, então o updated_at não muda.
update public.oportunidades o
   set data_perda = (o.updated_at at time zone 'America/Sao_Paulo')::date::timestamp
 where o.data_perda is null
   and (exists (select 1 from public.etapas_funil e
                 where e.empresa = o.empresa and e.nome = o.etapa and e.tipo = 'perda')
        or (o.etapa = 'Perdidos'
            and not exists (select 1 from public.etapas_funil e where e.empresa = o.empresa)));

-- ===================================================================
-- 8. updated_at sempre em dia.
-- ===================================================================
-- Em vendas, oportunidades, relacionamentos e pos_vendas o updated_at só
-- mudava quando o app lembrava de mandar. Em oportunidades é dele que sai o
-- "dias parado", e as ferramentas da AURA moviam o card sem atualizar.
-- O gatilho: se a linha mudou e ninguém mandou um updated_at novo, grava
-- agora. Se mandaram (o app, a restauração de backup), respeita o que veio.
-- Atualização que não muda nada não mexe no updated_at.
create or replace function public.aura_tocar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if to_jsonb(new) = to_jsonb(old) then
    return new;
  end if;
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.aura_tocar_updated_at() from public, anon;

drop trigger if exists trg_zz_tocar_updated_at on public.vendas;
create trigger trg_zz_tocar_updated_at
  before update on public.vendas
  for each row execute function public.aura_tocar_updated_at();

drop trigger if exists trg_zz_tocar_updated_at on public.oportunidades;
create trigger trg_zz_tocar_updated_at
  before update on public.oportunidades
  for each row execute function public.aura_tocar_updated_at();

drop trigger if exists trg_zz_tocar_updated_at on public.relacionamentos;
create trigger trg_zz_tocar_updated_at
  before update on public.relacionamentos
  for each row execute function public.aura_tocar_updated_at();

drop trigger if exists trg_zz_tocar_updated_at on public.pos_vendas;
create trigger trg_zz_tocar_updated_at
  before update on public.pos_vendas
  for each row execute function public.aura_tocar_updated_at();

-- ===================================================================
-- 9. Limpeza: índices repetidos e gatilhos que não faziam nada.
-- ===================================================================
-- Índices idênticos (mesma tabela, mesmas colunas, mesma ordem). Fica o que
-- sustenta uma regra de "único" (constraint) ou, quando nenhum sustenta, o
-- outro. Só apaga se o que fica existir.
do $$
begin
  if to_regclass('public.idx_atividades_relacionamento') is not null then
    drop index if exists public.atividades_relacionamento_idx;
  end if;
  -- metas_owner_id_mes_key é o da regra "uma meta por pessoa por mês".
  if to_regclass('public.metas_owner_id_mes_key') is not null then
    drop index if exists public.metas_owner_mes_uidx;
  end if;
  -- pos_vendas_venda_id_key é o da regra "um pós-venda por venda"; o
  -- "on conflict (venda_id)" dos gatilhos continua achando ele.
  if to_regclass('public.pos_vendas_venda_id_key') is not null then
    drop index if exists public.idx_pos_vendas_venda_unica;
  end if;
  if to_regclass('public.idx_whatsapp_mensagens_conversa_data') is not null then
    drop index if exists public.whatsapp_mensagens_conversa_idx;
  end if;
end $$;
-- (whatsapp_conversas tem dois índices parecidos, mas um ordena os vazios no
-- fim e o outro no começo: não são iguais, ficam os dois.)

-- Três gatilhos criavam o pós-venda de cada venda nova. trg_aura_criar_pos_venda
-- roda primeiro (ordem alfabética), cria o pós-venda completo, e os outros
-- dois só tentavam criar de novo e paravam no "já existe". Saem os dois
-- inúteis, e as funções deles se nada mais usar.
do $$
declare
  v_auto regprocedure := to_regprocedure('public.criar_pos_venda_automatico()');
  v_apos regprocedure := to_regprocedure('public.criar_pos_venda_apos_venda()');
begin
  if exists (select 1 from pg_trigger
              where tgrelid = 'public.vendas'::regclass
                and tgname = 'trg_aura_criar_pos_venda' and not tgisinternal) then
    drop trigger if exists trg_criar_pos_venda on public.vendas;
    drop trigger if exists trg_criar_pos_venda_apos_venda on public.vendas;

    if v_auto is not null and not exists (select 1 from pg_trigger where tgfoid = v_auto) then
      drop function public.criar_pos_venda_automatico();
    end if;
    if v_apos is not null and not exists (select 1 from pg_trigger where tgfoid = v_apos) then
      drop function public.criar_pos_venda_apos_venda();
    end if;
  end if;
end $$;

-- ===================================================================
-- 10. Vocabulário igual ao do app.
-- ===================================================================
-- 10a. A categoria "Cliente" não existe no app (o tipo só tem "Cliente
-- Final"). A 105 corrigiu o gatilho que criava contatos assim e os 8 que já
-- existiam. Agora a regra do banco também deixa de aceitar "Cliente".
-- Proteção: se o gatilho ainda gravar 'Cliente' (a 105 não pegou), NÃO mexe
-- na regra — senão todo lead respondido quebraria ao virar contato.
do $$
declare
  v_fn regprocedure := to_regprocedure('public.aura_lead_respondido_vira_pipeline()');
begin
  if v_fn is not null and pg_get_functiondef(v_fn) like '%''Cliente'',%' then
    raise notice 'aura_lead_respondido_vira_pipeline ainda grava ''Cliente''; a regra de categoria NÃO foi alterada.';
  else
    update public.relacionamentos set categoria = 'Cliente Final' where categoria = 'Cliente';
    alter table public.relacionamentos drop constraint if exists relacionamentos_categoria_check;
    alter table public.relacionamentos add constraint relacionamentos_categoria_check
      check (categoria = any (array[
        'Cliente Final', 'Arquiteto', 'Construtora', 'Obra', 'Consultor', 'Revendedor',
        'Engenheiro', 'Designer de Interiores', 'Distribuidor', 'Outro'
      ]));
  end if;
end $$;

-- 10b. Tipo de atividade: o app usa "Email" (src/lib/types.ts e
-- src/lib/tipo-atividade.ts). Uma atividade antiga ficou como "E-mail" e não
-- aparecia no filtro nem na contagem por tipo.
update public.atividades set tipo = 'Email' where tipo = 'E-mail';

-- 10c. Cinco metas (de set/out de 2026) nasceram sem loja e sem ano. O app
-- filtra metas pela loja, então elas não apareciam para o gestor. A loja vem
-- do perfil do dono da meta; o ano, da coluna mes ("2026-10" → 2026).
update public.metas m
   set empresa = p.empresa
  from public.profiles p
 where p.id = m.owner_id
   and m.empresa is null
   and p.empresa is not null;

update public.metas
   set ano = left(mes, 4)::integer
 where ano is null
   and mes ~ '^\d{4}-\d{2}$';

-- 10d. metas_atividade.categoria: a regra do banco aceita todas as categorias
-- da tela de metas (e ainda "Consultor", que o ranking usa). Já está
-- alinhada; nada a mudar.

-- ===================================================================
-- 11. Sem login, ninguém grava nada.
-- ===================================================================
-- A chave pública (anon) tinha permissão de inserir, alterar, apagar e
-- esvaziar todas as tabelas; só as regras de linha seguravam. As partes
-- públicas do app não gravam direto em tabela nenhuma: /avaliar usa as
-- funções buscar_empresa_por_token e registrar_avaliacao_publica (que
-- continuam liberadas), e /av, /f, /s e as rotas do site usam a chave de
-- serviço. A LEITURA fica como está (as regras de linha continuam valendo).
do $$
declare
  r record;
begin
  for r in
    select c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'f')
  loop
    execute format('revoke insert, update, delete, truncate on table public.%I from anon', r.relname);
  end loop;
end $$;

-- E as tabelas novas já nascem assim (para as criadas pelo usuário postgres,
-- que é quem roda as migrações). Se o usuário que aplicar não puder mudar
-- isso, só avisa e segue.
do $$
begin
  execute 'alter default privileges for role postgres in schema public revoke insert, update, delete, truncate on tables from anon';
exception when insufficient_privilege then
  raise notice 'Não consegui mudar as permissões padrão de tabelas novas para anon; aplique como postgres.';
end $$;

-- ===================================================================
-- 12. Desempenho: as regras mais usadas calculam "quem sou eu" uma vez só.
-- ===================================================================
-- Escrever (select minha_empresa()) em vez de minha_empresa() faz o banco
-- calcular a resposta uma vez por consulta, não uma vez por linha. Mesmas
-- condições de antes, só mais rápido nas telas de carteira, pipeline e
-- atividades.

-- relacionamentos
drop policy if exists "Ver relacionamentos conforme papel" on public.relacionamentos;
create policy "Ver relacionamentos conforme papel" on public.relacionamentos
  for select using (
    (select public.pode_ver_todas_empresas())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

drop policy if exists "Atualizar relacionamentos conforme papel" on public.relacionamentos;
create policy "Atualizar relacionamentos conforme papel" on public.relacionamentos
  for update using (
    owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or (select public.pode_ver_todas_empresas())
  );

drop policy if exists "Excluir relacionamentos conforme papel" on public.relacionamentos;
create policy "Excluir relacionamentos conforme papel" on public.relacionamentos
  for delete using (
    owner_id = (select auth.uid())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or (select public.pode_ver_todas_empresas())
  );

drop policy if exists "Criar relacionamento na própria loja" on public.relacionamentos;
create policy "Criar relacionamento na própria loja" on public.relacionamentos
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (empresa = (select public.minha_empresa()) or (select public.pode_ver_todas_empresas()))
  );

-- oportunidades
drop policy if exists "Ver oportunidades conforme papel" on public.oportunidades;
create policy "Ver oportunidades conforme papel" on public.oportunidades
  for select using (
    (select public.pode_ver_todas_empresas())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

drop policy if exists "Atualizar oportunidades conforme papel" on public.oportunidades;
create policy "Atualizar oportunidades conforme papel" on public.oportunidades
  for update using (
    owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or (select public.pode_ver_todas_empresas())
  );

drop policy if exists "Excluir oportunidades conforme papel" on public.oportunidades;
create policy "Excluir oportunidades conforme papel" on public.oportunidades
  for delete using (
    owner_id = (select auth.uid())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or (select public.pode_ver_todas_empresas())
  );

drop policy if exists "Criar oportunidade na própria loja" on public.oportunidades;
create policy "Criar oportunidade na própria loja" on public.oportunidades
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (empresa = (select public.minha_empresa()) or (select public.pode_ver_todas_empresas()))
  );

-- atividades
drop policy if exists "Ver atividades conforme papel" on public.atividades;
create policy "Ver atividades conforme papel" on public.atividades
  for select using (
    (select public.pode_ver_todas_empresas())
    or ((select public.vejo_a_loja_toda()) and empresa = (select public.minha_empresa()))
    or owner_id = (select auth.uid())
  );

drop policy if exists "Criar atividade na própria loja" on public.atividades;
create policy "Criar atividade na própria loja" on public.atividades
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (empresa = (select public.minha_empresa()) or (select public.pode_ver_todas_empresas()))
  );

drop policy if exists "Atualizar atividade do próprio usuário" on public.atividades;
create policy "Atualizar atividade do próprio usuário" on public.atividades
  for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and empresa = (select public.minha_empresa()));

-- profiles (as duas regras de leitura que sobram, mesmas condições)
drop policy if exists "Equipe visível para a mesma empresa" on public.profiles;
create policy "Equipe visível para a mesma empresa" on public.profiles
  for select using ((select auth.uid()) = id or empresa = (select public.minha_empresa()));

drop policy if exists "Gestor e diretor veem todos os perfis" on public.profiles;
create policy "Gestor e diretor veem todos os perfis" on public.profiles
  for select using ((select public.pode_ver_todas_empresas()) or empresa = (select public.minha_empresa()));

commit;
