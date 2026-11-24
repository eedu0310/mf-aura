-- 20261005111740 061_gestor_so_tem_poder_depois_de_aprovado

-- "Gestor" passa a significar "gestor APROVADO e ativo".
--
-- O DEFEITO: a tela de cadastro deixa a pessoa escolher o papel, inclusive
-- Gestor. Existe o campo gestor_aprovado e existe a aba de permissoes onde o
-- gestor mestre aprova quem esta pendente. So que a aprovacao NAO BLOQUEAVA
-- NADA: o poder vinha do cargo escrito no perfil, nao da aprovacao.
--
-- Medido, promovendo um vendedor a Gestor nao aprovado numa transacao
-- desfeita: ele passava a ver 53 contatos e 48 leads em vez dos 32 e 27 dele -
-- a loja inteira - mais a configuracao da IA e as regras do ranking. Varias
-- dessas politicas nem trava de loja tinham, entao alcancavam as quatro.
--
-- Parte da culpa e minha: vejo_a_loja_toda(), que escrevi na migration 046,
-- olhava so o cargo. A funcao gestor_ativo(), que ja existia no projeto, fazia
-- a checagem certa desde o inicio - e quase nada a usava.
--
-- A CORRECAO: a pergunta "esta pessoa manda na loja?" passa a ser respondida
-- em UM lugar, e esse lugar exige aprovacao. As 52 politicas que perguntavam
-- "o cargo dela e Gestor?" passam a chamar essa funcao.
--
-- Os quatro gestores atuais ja estao aprovados, entao nada muda para eles.

create or replace function public.vejo_a_loja_toda()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.ativo is not false
       and (p.cargo = 'Diretor' or (p.cargo = 'Gestor' and p.gestor_aprovado))
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.pode_ver_todas_empresas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.ativo is not false
       and (p.cargo = 'Diretor'
            or (p.cargo = 'Gestor' and coalesce(p.gestor_mestre,false) and p.gestor_aprovado))
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- Marketing continua valendo pelo cargo (aprovacao e coisa de gestor), mas
-- o ramo de gestor dentro dela passa pela mesma porta.
create or replace function public.pode_ver_marketing()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.ativo is not false and p.cargo = 'Marketing'
    from public.profiles p where p.id = auth.uid()
  ), false) or public.vejo_a_loja_toda();
$$;

-- As politicas que confiavam no cargo escrito passam a chamar a funcao.
-- Diretor sozinho fica como esta: e papel acima de gestor, nao depende de
-- aprovacao de ninguem.
do $$
declare r record; nq text; nc text; cmd text; n int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname='public'
      and (coalesce(qual,'')||' '||coalesce(with_check,'')) like '%meu_cargo() = %'
  loop
    nq := coalesce(r.qual,''); nc := coalesce(r.with_check,'');
    nq := replace(nq, '(meu_cargo() = ANY (ARRAY[''Gestor''::text, ''Diretor''::text]))', 'vejo_a_loja_toda()');
    nc := replace(nc, '(meu_cargo() = ANY (ARRAY[''Gestor''::text, ''Diretor''::text]))', 'vejo_a_loja_toda()');
    nq := replace(nq, '(meu_cargo() = ''Gestor''::text)', 'vejo_a_loja_toda()');
    nc := replace(nc, '(meu_cargo() = ''Gestor''::text)', 'vejo_a_loja_toda()');
    cmd := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if r.qual is not null and r.with_check is not null then
      cmd := cmd || format(' using (%s) with check (%s)', nq, nc);
    elsif r.qual is not null then cmd := cmd || format(' using (%s)', nq);
    else cmd := cmd || format(' with check (%s)', nc); end if;
    execute cmd; n := n + 1;
  end loop;
  raise notice 'politicas ajustadas: %', n;
end $$;
