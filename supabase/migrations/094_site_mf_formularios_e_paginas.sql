-- 094: Site MF dentro da AURA — formulários, páginas de captura (LPs) e os
-- envios que viram lead.
--
-- Pedido do Elton (26/10/2026): tirar do Bitrix os formulários e as LPs da
-- MF International e fazer tudo por dentro da AURA, numa aba só para quem é
-- da MF. O que alguém preenche numa LP entra na fila de leads da MF
-- (leads_recebidos), e dali segue o caminho que todo lead já segue:
-- distribuição, resposta, pipeline. Nada novo no funil.
--
-- Acesso: só quem é da loja dona do formulário (na prática, a MF) e o gestor
-- mestre. Ninguém de fora lê estas tabelas direto: a página pública e o envio
-- passam por rotas do servidor, com a chave de serviço.

create table if not exists public.site_formularios (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MF International',
  nome text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  titulo text,
  descricao text,
  -- [{ "chave": "nome", "rotulo": "Nome", "tipo": "texto|email|telefone|cidade|selecao|caixa|area", "obrigatorio": true, "opcoes": [] }]
  campos jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  botao_texto text not null default 'Enviar',
  mensagem_sucesso text not null default 'Recebemos seus dados! Em breve a nossa equipe entra em contato.',
  material_nome text,
  material_url text,
  cor text not null default '#CD1C1B' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean not null default true,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_paginas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MF International',
  titulo text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  -- [{ "tipo": "hero|texto|beneficios|imagem|video|formulario|chamada", ... }]
  blocos jsonb not null default '[]'::jsonb check (jsonb_typeof(blocos) = 'array'),
  formulario_id uuid references public.site_formularios(id) on delete set null,
  cor text not null default '#CD1C1B' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  tema text not null default 'escuro' check (tema in ('escuro', 'claro')),
  seo_titulo text,
  seo_descricao text,
  publicada boolean not null default false,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_envios (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  formulario_id uuid references public.site_formularios(id) on delete set null,
  pagina_id uuid references public.site_paginas(id) on delete set null,
  dados jsonb not null default '{}'::jsonb,
  nome text,
  telefone text,
  email text,
  cidade text,
  perfil text,
  origem_url text,
  utm jsonb,
  lead_id uuid references public.leads_recebidos(id) on delete set null,
  -- Para onde a MF mandou este lead, quando transferiu para outra loja.
  transferido_para text,
  transferido_em timestamptz,
  transferido_por uuid references public.profiles(id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists site_envios_empresa_idx on public.site_envios (empresa, created_at desc);
create index if not exists site_envios_lead_idx on public.site_envios (lead_id);
create index if not exists site_envios_ip_idx on public.site_envios (ip_hash, created_at desc);

-- Quem pode ver e mexer --------------------------------------------------

create or replace function public.equipe_do_site(p_empresa text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.ativo is not false
       and (p.empresa = p_empresa or p.gestor_mestre = true)
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.equipe_do_site(text) from public, anon;
grant execute on function public.equipe_do_site(text) to authenticated, service_role;

alter table public.site_formularios enable row level security;
alter table public.site_paginas enable row level security;
alter table public.site_envios enable row level security;

drop policy if exists site_formularios_ver on public.site_formularios;
create policy site_formularios_ver on public.site_formularios
  for select to authenticated using (public.equipe_do_site(empresa));
drop policy if exists site_formularios_criar on public.site_formularios;
create policy site_formularios_criar on public.site_formularios
  for insert to authenticated with check (public.equipe_do_site(empresa));
drop policy if exists site_formularios_editar on public.site_formularios;
create policy site_formularios_editar on public.site_formularios
  for update to authenticated using (public.equipe_do_site(empresa)) with check (public.equipe_do_site(empresa));
drop policy if exists site_formularios_apagar on public.site_formularios;
create policy site_formularios_apagar on public.site_formularios
  for delete to authenticated using (public.equipe_do_site(empresa));

drop policy if exists site_paginas_ver on public.site_paginas;
create policy site_paginas_ver on public.site_paginas
  for select to authenticated using (public.equipe_do_site(empresa));
drop policy if exists site_paginas_criar on public.site_paginas;
create policy site_paginas_criar on public.site_paginas
  for insert to authenticated with check (public.equipe_do_site(empresa));
drop policy if exists site_paginas_editar on public.site_paginas;
create policy site_paginas_editar on public.site_paginas
  for update to authenticated using (public.equipe_do_site(empresa)) with check (public.equipe_do_site(empresa));
drop policy if exists site_paginas_apagar on public.site_paginas;
create policy site_paginas_apagar on public.site_paginas
  for delete to authenticated using (public.equipe_do_site(empresa));

-- Envios: a equipe lê; quem grava é só o servidor (chave de serviço).
drop policy if exists site_envios_ver on public.site_envios;
create policy site_envios_ver on public.site_envios
  for select to authenticated using (public.equipe_do_site(empresa));

revoke all on public.site_formularios, public.site_paginas, public.site_envios from anon;

-- Imagens das páginas: pasta pública (as LPs são públicas). Quem sobe é o
-- servidor, depois de conferir que a pessoa é da equipe.
insert into storage.buckets (id, name, public)
values ('site', 'site', true)
on conflict (id) do nothing;

comment on table public.site_formularios is 'Formulários de captura do site (LPs). Campos em JSON; o envio vira lead em leads_recebidos.';
comment on table public.site_paginas is 'Páginas de captura (LPs) montadas por blocos na AURA, servidas em /s/<slug>.';
comment on table public.site_envios is 'Cada preenchimento de formulário do site, com o lead que gerou e, se houver, a loja para onde a MF transferiu.';

-- Formulários de partida: os três materiais gratuitos do site da MF.
insert into public.site_formularios (empresa, nome, slug, titulo, descricao, campos, botao_texto, mensagem_sucesso, material_nome)
select 'MF International', f.nome, f.slug, f.titulo, f.descricao, f.campos::jsonb, f.botao, f.sucesso, f.material
from (values
  ('Catálogo MF', 'catalogo-mf', 'Receba o catálogo completo', 'Todos os modelos MF com potência, área que aquecem e medidas.',
   '[{"chave":"nome","rotulo":"Nome","tipo":"texto","obrigatorio":true},{"chave":"sobrenome","rotulo":"Sobrenome","tipo":"texto","obrigatorio":false},{"chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","obrigatorio":true},{"chave":"email","rotulo":"E-mail","tipo":"email","obrigatorio":true},{"chave":"cidade","rotulo":"Cidade","tipo":"cidade","obrigatorio":true},{"chave":"perfil","rotulo":"Você é","tipo":"selecao","obrigatorio":false,"opcoes":["Cliente final","Arquiteto(a)","Construtora","Revendedor"]}]',
   'Quero o catálogo', 'Pronto! O catálogo está liberado abaixo e a nossa equipe vai falar com você.', 'Catálogo MF 2025'),
  ('Blocos 3D para arquitetos', 'blocos-3d', 'Blocos 3D das lareiras MF', 'Modelos SKP e 3DS para usar nos seus projetos.',
   '[{"chave":"nome","rotulo":"Nome","tipo":"texto","obrigatorio":true},{"chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","obrigatorio":true},{"chave":"email","rotulo":"E-mail","tipo":"email","obrigatorio":true},{"chave":"cidade","rotulo":"Cidade","tipo":"cidade","obrigatorio":true},{"chave":"escritorio","rotulo":"Escritório","tipo":"texto","obrigatorio":false}]',
   'Baixar os blocos 3D', 'Pronto! Os blocos estão liberados abaixo.', 'Blocos 3D MF'),
  ('Manuais de uso', 'manuais', 'Manuais de uso das lareiras MF', 'Instalação, uso e garantia de cada modelo.',
   '[{"chave":"nome","rotulo":"Nome","tipo":"texto","obrigatorio":true},{"chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","obrigatorio":true},{"chave":"email","rotulo":"E-mail","tipo":"email","obrigatorio":false},{"chave":"cidade","rotulo":"Cidade","tipo":"cidade","obrigatorio":true},{"chave":"perfil","rotulo":"Você é","tipo":"selecao","obrigatorio":false,"opcoes":["Cliente final","Revendedor","Instalador"]}]',
   'Ver os manuais', 'Pronto! Os manuais estão liberados abaixo.', 'Manuais MF')
) as f(nome, slug, titulo, descricao, campos, botao, sucesso, material)
on conflict (slug) do nothing;
