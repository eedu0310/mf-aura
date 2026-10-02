-- auth.uid() avaliado uma vez por consulta, nao uma vez por linha.
--
-- O exame de desempenho apontou 117 politicas chamando auth.uid() direto. Em
-- RLS isso faz o Postgres reavaliar a funcao LINHA POR LINHA: numa tabela com
-- mil linhas sao mil chamadas para responder a mesma pergunta. Envolvido em
-- subconsulta, o planejador avalia uma vez e reusa.
--
-- Nao se ganha nada hoje, com 70 relacionamentos. Ganha-se quando a base
-- crescer, e entao ninguem vai lembrar que a causa da lentidao era isto.
--
-- Desembrulha antes de embrulhar, para rodar duas vezes nao gerar
-- (select (select auth.uid())). Testado numa transacao desfeita com a
-- verificacao de separacao dentro dela - Jeferson 29, Denise 12, gestor mestre
-- tudo, igual a antes. Depois de aplicar: 155 de 155 ocorrencias embrulhadas.
do $$
declare
  r record; nq text; nc text; cmd text; n int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public'
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%'
        or coalesce(qual,'') like '%auth.jwt()%' or coalesce(with_check,'') like '%auth.jwt()%')
  loop
    nq := replace(replace(coalesce(r.qual,''), '(select auth.uid())', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    nq := replace(replace(nq, '(select auth.jwt())', 'auth.jwt()'), 'auth.jwt()', '(select auth.jwt())');
    nc := replace(replace(coalesce(r.with_check,''), '(select auth.uid())', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    nc := replace(replace(nc, '(select auth.jwt())', 'auth.jwt()'), 'auth.jwt()', '(select auth.jwt())');

    cmd := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if r.qual is not null and r.with_check is not null then
      cmd := cmd || format(' using (%s) with check (%s)', nq, nc);
    elsif r.qual is not null then
      cmd := cmd || format(' using (%s)', nq);
    else
      cmd := cmd || format(' with check (%s)', nc);
    end if;
    execute cmd;
    n := n + 1;
  end loop;
  raise notice 'politicas ajustadas: %', n;
end $$;
