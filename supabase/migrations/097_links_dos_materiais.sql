-- 097: depois de preencher o formulário, a pessoa vai para a página do
-- material na AURA, onde baixa o arquivo (pedido do Elton, 26/10/2026).
-- Antes quem entregava era o Bitrix.
--
--   catálogo            → /materiais/catalogo           (PDF do Catálogo MF 2025)
--   tripla combustão    → /materiais/tripla-combustao   (infográfico)
--   realidade aumentada → /materiais/realidade-aumentada (MF Preview)
--   blocos 3D           → /materiais/blocos             (um botão por modelo)
--   manuais             → /materiais/manuais            (um botão por modelo)
--
-- Só troca onde está vazio ou com o link que a própria AURA tinha posto
-- (se a equipe já pôs outro link pelo editor, fica o dela).

update public.site_formularios as f
   set material_url = v.url,
       material_nome = v.nome
  from (values
    ('catalogo-mf', 'https://crm.mflaser.com.br/materiais/catalogo', 'Baixar o catálogo', null),
    ('tripla-combustao', 'https://crm.mflaser.com.br/materiais/tripla-combustao', 'Baixar o infográfico', 'https://drive.google.com/file/d/1YAtFCfwHJUWl4ZoORxHRX47yCVIJfiSr/view'),
    ('realidade-aumentada', 'https://crm.mflaser.com.br/materiais/realidade-aumentada', 'Abrir o MF Preview', 'https://mfpreview.com.br/'),
    ('blocos-3d', 'https://crm.mflaser.com.br/materiais/blocos', 'Baixar os blocos 3D', null),
    ('manuais', 'https://crm.mflaser.com.br/materiais/manuais', 'Baixar os manuais', null)
  ) as v(slug, url, nome, antigo)
 where f.slug = v.slug
   and (f.material_url is null or f.material_url = v.antigo);
