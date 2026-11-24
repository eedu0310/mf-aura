-- 20261026192059 097_links_dos_materiais

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
