-- 097: o que cada formulário entrega depois de preenchido (26/10/2026).
--
-- Antes quem entregava era o Bitrix. Agora:
--   catálogo → PDF do Catálogo MF 2025 no Drive da MF;
--   manuais  → página da AURA com os manuais de todos os modelos;
--   blocos   → página da AURA com os blocos .SKP/.3DS de todos os modelos.
-- Só preenche onde ainda está vazio (se a equipe já pôs outro link pelo
-- editor, fica o dela).

update public.site_formularios
   set material_url = 'https://drive.google.com/file/d/1-7itT7rEv2tSpMgvHIIWOyxAUfQM0ZBn/view',
       material_nome = 'Abrir o Catálogo MF 2025'
 where slug = 'catalogo-mf' and material_url is null;

update public.site_formularios
   set material_url = 'https://crm.mflaser.com.br/materiais/manuais',
       material_nome = 'Ver os manuais'
 where slug = 'manuais' and material_url is null;

update public.site_formularios
   set material_url = 'https://crm.mflaser.com.br/materiais/blocos',
       material_nome = 'Ver os blocos 3D'
 where slug = 'blocos-3d' and material_url is null;
