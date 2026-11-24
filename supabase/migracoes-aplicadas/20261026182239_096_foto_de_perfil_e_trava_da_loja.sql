-- 20261026182239 096_foto_de_perfil_e_trava_da_loja

alter table public.profiles add column if not exists foto_url text;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

alter policy profiles_nao_se_autopromove on public.profiles
  with check (
    public.gestor_mestre()
    or (
      id = (select auth.uid())
      and not (cargo is distinct from public.meu_cargo())
      and not (gestor_mestre is distinct from public.meu_gestor_mestre())
      and not (gestor_aprovado is distinct from public.meu_gestor_aprovado())
      and (
        coalesce(public.minha_empresa(), '') = ''
        or not (empresa is distinct from public.minha_empresa())
      )
    )
  );

comment on column public.profiles.foto_url is 'Foto de perfil (pasta pública avatares). Trocada pela própria pessoa em Configurações.';

alter table public.site_mensagens add column if not exists anexo_url text;
alter table public.site_mensagens add column if not exists anexo_tipo text;
alter table public.site_mensagens add column if not exists anexo_nome text;
alter table public.site_mensagens add column if not exists anexo_tamanho integer;
alter table public.site_mensagens alter column texto set default '';
alter table public.site_mensagens drop constraint if exists site_mensagens_texto_check;
alter table public.site_mensagens add constraint site_mensagens_texto_check
  check (char_length(texto) <= 2000 and (char_length(texto) >= 1 or anexo_url is not null));

alter table public.site_mensagens drop constraint if exists site_mensagens_autor_check;
alter table public.site_mensagens add constraint site_mensagens_autor_check
  check (autor in ('visitante', 'equipe', 'sistema', 'assistente'));
alter table public.site_chat_config add column if not exists ia_ativa boolean not null default true;
alter table public.site_chat_config add column if not exists ia_sem_ninguem boolean not null default false;

insert into storage.buckets (id, name, public)
values ('site-chat', 'site-chat', true)
on conflict (id) do nothing;

alter table public.site_formularios add column if not exists imagem_fundo text;

update public.site_formularios
   set material_url = 'https://drive.google.com/file/d/1YAtFCfwHJUWl4ZoORxHRX47yCVIJfiSr/view'
 where slug = 'tripla-combustao' and material_url is null;
alter table public.site_chat_config add column if not exists logo_url text;

update public.site_formularios set imagem_fundo = v.url
from (values
  ('catalogo-mf', 'https://cdn.bitrix24.com.br/b28173705/landing/123/123cadf9605d69a3b1811ca15fa0a237/montagem_m_ltiplos_cat_logos_2_1x.jpg'),
  ('blocos-3d', 'https://cdn.bitrix24.com.br/b28173705/landing/625/6253575fa12d6cbf946cdc82ec101cf0/yy71hbcuu1_1x.jpeg'),
  ('manuais', 'https://cdn.bitrix24.com.br/b28173705/landing/efb/efbf9bc917a473458e5b7ecc1dbf4f56/manuais_mae_2x_2x_2x_1x.jpeg'),
  ('tripla-combustao', 'https://cdn.bitrix24.com.br/b28173705/landing/24b/24b348eb38a6556e637fdc51a96d0e85/prime_duo_exp_2x_2x_1x.jpg'),
  ('realidade-aumentada', 'https://cdn.bitrix24.com.br/b28173705/landing/200/2000a4170d57d910311e297d04fbd060/home_1_v2_1x.png')
) as v(slug, url)
where site_formularios.slug = v.slug and site_formularios.imagem_fundo is null;

update public.site_formularios set material_url = 'https://mfpreview.com.br/', material_nome = 'Abrir o MF Preview'
 where slug = 'realidade-aumentada' and material_url is null;
