-- 097: o que abre depois de preencher cada formulário do site da MF
-- (pedido do Elton, 26/10/2026). Antes quem entregava era o Bitrix.
--
--   catálogo            → PDF do Catálogo MF 2025 no Google Drive
--   tripla combustão    → infográfico no Google Drive (já estava)
--   realidade aumentada → MF Preview (já estava)
--   blocos 3D           → página da AURA com um botão por modelo
--   manuais             → página da AURA com um botão por modelo
--
-- Só preenche onde ainda está vazio (se a equipe já pôs outro link pelo
-- editor, fica o dela).

update public.site_formularios as f
   set material_url = v.url,
       material_nome = v.nome
  from (values
    ('catalogo-mf', 'https://drive.google.com/file/d/1-7itT7rEv2tSpMgvHIIWOyxAUfQM0ZBn/view', 'Baixar o catálogo'),
    ('blocos-3d', 'https://crm.mflaser.com.br/materiais/blocos', 'Baixar os blocos 3D'),
    ('manuais', 'https://crm.mflaser.com.br/materiais/manuais', 'Baixar os manuais')
  ) as v(slug, url, nome)
 where f.slug = v.slug
   and f.material_url is null;
