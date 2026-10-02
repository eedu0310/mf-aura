-- Mesmo defeito da 046, agora na tabela que se chama literalmente
-- "leads_recebidos" - a dos leads que entram por WhatsApp, Instagram e campanha.
--
-- Das quatro politicas de leitura, duas tinham "empresa = minha_empresa()"
-- solto, sem olhar cargo nem dono. Somadas com OU, bastava ser da loja: todo
-- mundo da Sole via os 39 leads da Sole (27 do Jeferson, 12 da Denise).
--
-- A de EXCLUSAO tinha o mesmo furo, o que e pior do que ver: um vendedor podia
-- apagar o lead de outro.
--
-- Leitura do marketing continua ampla de proposito: e ela que responde qual
-- campanha gerou qual lead. Escrita do marketing fica limitada a propria loja.
--
-- ATENCAO: a primeira versao desta migration usava pode_ver_marketing() na
-- leitura, que e "cargo in ('Marketing','Gestor','Diretor')" - sem loja. Isso
-- liberava todas as lojas para QUALQUER gestor, mestre ou nao. Corrigido na
-- 050; o que vale e o texto abaixo.
do $$
declare
  leitura text := $r$
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or meu_cargo() = 'Marketing'
    or vendedor_id = auth.uid()
    or sdr_id = auth.uid()
  $r$;
  escrita text := $r$
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or (meu_cargo() = 'Marketing' and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  $r$;
  exclusao text := $r$
    vendedor_id = auth.uid()
    or sdr_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  $r$;
  p record;
begin
  for p in
    select * from (values
      ('Marketing e gestão veem todos os leads',    'leitura'),
      ('Trava de loja nos leads',                   'leitura'),
      ('Ver leads conforme papel',                  'leitura'),
      ('Vendedores veem seus leads',                'leitura'),
      ('Atualizar leads conforme papel',            'escrita'),
      ('Marketing e gestão atualizam todos os leads','escrita'),
      ('Vendedores atualizam seus leads',           'escrita'),
      ('Excluir leads da própria empresa',          'exclusao')
    ) as t(politica, tipo)
  loop
    execute format('alter policy %I on public.leads_recebidos using (%s)', p.politica,
      case p.tipo when 'leitura' then leitura when 'escrita' then escrita else exclusao end);
  end loop;
end $$;
