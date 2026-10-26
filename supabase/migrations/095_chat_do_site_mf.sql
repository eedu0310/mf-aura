-- 095: chat ao vivo do site da MF, no lugar do widget do Bitrix.
--
-- O visitante abre a bolinha no site, preenche nome e WhatsApp e conversa
-- com a equipe da MF, que responde por dentro da AURA (Site MF → Atendimento).
-- Cada conversa também vira lead da MF (leads_recebidos) e um envio do site
-- (site_envios), para seguir o mesmo caminho dos formulários.
--
-- O visitante não tem login: ele se identifica pela conversa + um segredo
-- (token) que só o navegador dele tem. Aqui fica só o hash do segredo. Tudo
-- que ele faz passa por rotas do servidor com a chave de serviço.

create table if not exists public.site_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MF International',
  envio_id uuid references public.site_envios(id) on delete set null,
  lead_id uuid references public.leads_recebidos(id) on delete set null,
  token_hash text not null,
  nome text,
  telefone text,
  email text,
  cidade text,
  status text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  atendente_id uuid references public.profiles(id) on delete set null,
  -- Mensagens do visitante que ninguém da equipe abriu ainda.
  nao_lidas integer not null default 0,
  ultima_mensagem text,
  ultima_em timestamptz not null default now(),
  -- Última vez que o navegador do visitante perguntou por mensagens:
  -- serve para mostrar "está no site agora".
  visitante_visto_em timestamptz,
  origem_url text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists site_conversas_lista_idx on public.site_conversas (empresa, ultima_em desc);
create index if not exists site_conversas_envio_idx on public.site_conversas (envio_id);

create table if not exists public.site_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.site_conversas(id) on delete cascade,
  autor text not null check (autor in ('visitante', 'equipe', 'sistema')),
  autor_id uuid references public.profiles(id) on delete set null,
  autor_nome text,
  texto text not null check (char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists site_mensagens_conversa_idx on public.site_mensagens (conversa_id, created_at);

-- Quem da equipe está com a AURA aberta e disponível para o chat.
create table if not exists public.site_presenca (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  empresa text not null default 'MF International',
  disponivel boolean not null default true,
  visto_em timestamptz not null default now()
);

-- O que o widget mostra. Uma linha por loja (hoje só a MF).
create table if not exists public.site_chat_config (
  empresa text primary key,
  ativo boolean not null default true,
  saudacao text not null default 'Olá! Sou o seu ajudante pessoal da MF. Escreva sempre que tiver dúvidas.',
  atendente_padrao_id uuid references public.profiles(id) on delete set null,
  cor text not null default '#CD1C1B' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  -- Atalhos do widget para os materiais gratuitos:
  -- [{ "slug": "catalogo-mf", "titulo": "Quero o catálogo", "subtitulo": "...", "icone": "catalogo" }]
  atalhos jsonb not null default '[]'::jsonb check (jsonb_typeof(atalhos) = 'array'),
  whatsapp text,
  -- Horário de atendimento, por dia da semana (0 = domingo), até dois
  -- turnos por dia: { "1": [["08:00","11:45"],["13:30","18:00"]], "0": [] }
  horario jsonb not null default '{}'::jsonb,
  mensagem_fora_horario text not null default 'Agora estamos fora do horário de atendimento. Deixe a sua mensagem que a equipe responde assim que voltar.',
  updated_at timestamptz not null default now()
);

-- Formulário que não gera lead: quem já é cliente (manual) ou parceiro
-- (bloco 3D) vai para "Clientes e parceiros", não para a fila de vendas.
alter table public.site_formularios add column if not exists destino text not null default 'lead';
alter table public.site_formularios drop constraint if exists site_formularios_destino_check;
alter table public.site_formularios add constraint site_formularios_destino_check check (destino in ('lead', 'cliente'));

alter table public.site_envios add column if not exists destino text not null default 'lead';
alter table public.site_envios drop constraint if exists site_envios_destino_check;
alter table public.site_envios add constraint site_envios_destino_check check (destino in ('lead', 'cliente'));
-- Funil curto de "Clientes e parceiros".
alter table public.site_envios add column if not exists etapa text not null default 'novo';
alter table public.site_envios drop constraint if exists site_envios_etapa_check;
alter table public.site_envios add constraint site_envios_etapa_check check (etapa in ('novo', 'em_atendimento', 'resolvido'));
alter table public.site_envios add column if not exists responsavel_id uuid references public.profiles(id) on delete set null;
alter table public.site_envios add column if not exists nota text;

update public.site_formularios set destino = 'cliente' where slug in ('manuais', 'blocos-3d');

-- Mais dois materiais que captam lead novo (o link do material a equipe
-- coloca em Site MF → Formulários).
insert into public.site_formularios (empresa, nome, slug, titulo, descricao, campos, botao_texto, mensagem_sucesso, material_nome, destino)
select 'MF International', f.nome, f.slug, f.titulo, f.descricao, f.campos::jsonb, f.botao, f.sucesso, f.material, 'lead'
from (values
  ('Tecnologia tripla combustão', 'tripla-combustao', 'Entenda a tripla combustão', 'Como a lareira MF aproveita melhor a lenha e aquece mais.',
   '[{"chave":"nome","rotulo":"Nome","tipo":"texto","obrigatorio":true},{"chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","obrigatorio":true},{"chave":"email","rotulo":"E-mail","tipo":"email","obrigatorio":false},{"chave":"cidade","rotulo":"Cidade","tipo":"cidade","obrigatorio":true}]',
   'Quero entender', 'Pronto! O material está liberado abaixo e a nossa equipe vai falar com você.', 'Tripla combustão MF'),
  ('Realidade aumentada (MF Preview)', 'realidade-aumentada', 'Veja a lareira MF na sua casa', 'Com o MF Preview você vê a lareira em realidade aumentada, no seu ambiente, pelo celular.',
   '[{"chave":"nome","rotulo":"Nome","tipo":"texto","obrigatorio":true},{"chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","obrigatorio":true},{"chave":"email","rotulo":"E-mail","tipo":"email","obrigatorio":false},{"chave":"cidade","rotulo":"Cidade","tipo":"cidade","obrigatorio":true},{"chave":"perfil","rotulo":"Você é","tipo":"selecao","obrigatorio":false,"opcoes":["Cliente final","Arquiteto(a)","Construtora"]}]',
   'Quero ver na minha casa', 'Pronto! O acesso está liberado abaixo.', 'MF Preview')
) as f(nome, slug, titulo, descricao, campos, botao, sucesso, material)
on conflict (slug) do nothing;

-- Acesso: equipe da loja (e gestor mestre) lê; quem grava é o servidor.
alter table public.site_conversas enable row level security;
alter table public.site_mensagens enable row level security;
alter table public.site_presenca enable row level security;
alter table public.site_chat_config enable row level security;

drop policy if exists site_conversas_ver on public.site_conversas;
create policy site_conversas_ver on public.site_conversas
  for select to authenticated using (public.equipe_do_site(empresa));

drop policy if exists site_mensagens_ver on public.site_mensagens;
create policy site_mensagens_ver on public.site_mensagens
  for select to authenticated using (
    exists (select 1 from public.site_conversas c where c.id = conversa_id and public.equipe_do_site(c.empresa))
  );

drop policy if exists site_presenca_ver on public.site_presenca;
create policy site_presenca_ver on public.site_presenca
  for select to authenticated using (public.equipe_do_site(empresa));

drop policy if exists site_chat_config_ver on public.site_chat_config;
create policy site_chat_config_ver on public.site_chat_config
  for select to authenticated using (public.equipe_do_site(empresa));

revoke all on public.site_conversas, public.site_mensagens, public.site_presenca, public.site_chat_config from anon;

-- A AURA escuta as mensagens novas na hora (a regra de acesso acima vale).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'site_mensagens') then
    alter publication supabase_realtime add table public.site_mensagens;
  end if;
end $$;

comment on table public.site_conversas is 'Chat ao vivo do site da MF: uma conversa por visitante, ligada ao lead e ao envio do site.';
comment on table public.site_mensagens is 'Mensagens do chat do site (visitante, equipe ou aviso do sistema).';
comment on table public.site_presenca is 'Quem da equipe está com a AURA aberta e disponível para o chat do site.';
comment on table public.site_chat_config is 'Configuração do widget de chat do site (saudação, atendente padrão, cor, catálogo, WhatsApp).';

-- Configuração inicial da MF: o Charles como atendente padrão.
-- Horário inicial: o da fábrica/LF (seg a sex 08:00–11:45 e 13:30–18:00,
-- sáb 09:00–12:00). A equipe ajusta em Site MF → Configurar chat.
insert into public.site_chat_config (empresa, atendente_padrao_id, atalhos, whatsapp, horario)
select 'MF International',
       (select p.id from public.profiles p join auth.users u on u.id = p.id
         where lower(u.email) = 'charles@mfinternational.com.br' limit 1),
       '[{"slug":"catalogo-mf","titulo":"Quero o catálogo","subtitulo":"Todos os modelos MF com medidas e potência","icone":"catalogo"},
         {"slug":"tripla-combustao","titulo":"Tecnologia tripla combustão","subtitulo":"Entenda como a lareira MF aquece mais","icone":"chama"},
         {"slug":"realidade-aumentada","titulo":"Realidade aumentada","subtitulo":"Veja a lareira na sua casa pelo celular","icone":"celular"},
         {"slug":"blocos-3d","titulo":"Blocos 3D para arquitetos","subtitulo":"SketchUp e 3DS para o seu projeto","icone":"cubo"},
         {"slug":"manuais","titulo":"Manuais de uso","subtitulo":"Para quem já tem uma lareira MF","icone":"manual"}]'::jsonb,
       '555135361422',
       '{"1":[["08:00","11:45"],["13:30","18:00"]],"2":[["08:00","11:45"],["13:30","18:00"]],"3":[["08:00","11:45"],["13:30","18:00"]],"4":[["08:00","11:45"],["13:30","18:00"]],"5":[["08:00","11:45"],["13:30","18:00"]],"6":[["09:00","12:00"]],"0":[]}'::jsonb
on conflict (empresa) do nothing;
