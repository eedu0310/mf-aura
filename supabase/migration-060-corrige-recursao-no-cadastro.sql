-- Recursao infinita ao salvar o cadastro. NINGUEM conseguia criar conta.
--
-- SINTOMA: "Não consegui salvar seu cadastro. (infinite recursion detected in
-- policy for relation profiles)" na tela de boas-vindas, ao escolher loja e
-- papel.
--
-- CAUSA: a politica restritiva profiles_nao_se_autopromove, criada em 28/09
-- (migration gestores_mestres_e_permissoes), precisa comparar o valor NOVO com
-- o valor ATUAL de cargo, gestor_mestre e gestor_aprovado - e fazia isso com
-- tres subconsultas "select ... from profiles" escritas dentro da propria
-- regra de profiles. Avaliar a regra exigia ler a tabela; ler a tabela exigia
-- avaliar a regra. O Postgres detecta e aborta.
--
-- ALCANCE, medido: quatro contas de login reais ficaram sem perfil, criadas
-- entre 02/10 e 05/10 - anderson@mfinternational, tassoniaeg, cristianlflareiras
-- e floriculturapetalasdosul. Gente que tentou entrar e nao conseguiu. E a
-- tela usa upsert, cujo ramo ON CONFLICT DO UPDATE e avaliado mesmo quando a
-- pessoa AINDA NAO TEM perfil: portanto nenhum autocadastro funcionava desde
-- 28/09. As contas da equipe criadas no periodo entraram pelo painel do gestor,
-- que usa a chave de servico e passa por fora da RLS - foi isso que mascarou.
--
-- NAO FOI A MIGRATION 058 (que reescreveu auth.uid() em subconsulta):
-- reproduzi o erro com o texto anterior ao meu, identico.
--
-- CORRECAO: ler o valor atual por funcao SECURITY DEFINER, que roda com os
-- direitos do dono da tabela e por isso nao reentra na politica. E o mesmo
-- padrao que meu_cargo() e minha_empresa() ja usavam no resto do sistema - a
-- politica simplesmente nao seguiu o padrao da casa.

create or replace function public.meu_gestor_mestre()
returns boolean language sql stable security definer set search_path = public as $$
  select p.gestor_mestre from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.meu_gestor_aprovado()
returns boolean language sql stable security definer set search_path = public as $$
  select p.gestor_aprovado from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.meu_gestor_mestre()   from public, anon;
revoke all on function public.meu_gestor_aprovado() from public, anon;
grant execute on function public.meu_gestor_mestre()   to authenticated, service_role;
grant execute on function public.meu_gestor_aprovado() to authenticated, service_role;

-- Mesma regra de antes, sem ler a propria tabela: voce mexe no seu perfil,
-- mas nao muda o seu cargo nem se promove.
alter policy profiles_nao_se_autopromove on public.profiles
  using (
    gestor_mestre() or id = (select auth.uid())
  )
  with check (
    gestor_mestre()
    or (
      id = (select auth.uid())
      and cargo           is not distinct from meu_cargo()
      and gestor_mestre   is not distinct from meu_gestor_mestre()
      and gestor_aprovado is not distinct from meu_gestor_aprovado()
    )
  );

-- BRECHA VIZINHA, fechada de passagem: a regra de criacao exigia apenas que o
-- perfil fosse o seu. Nao impedia nascer com gestor_mestre = true. A tela so
-- manda nome, loja e cargo, mas a API fica aberta a quem tiver conta: bastava
-- um pedido direto com gestor_mestre: true para o sujeito criar a si mesmo com
-- poder sobre as quatro lojas. O painel do gestor cria usuario pela chave de
-- servico, que ignora RLS, entao isto nao atrapalha quem cadastra a equipe.
alter policy "Usuário pode criar o próprio perfil" on public.profiles
  with check (
    (select auth.uid()) = id
    and gestor_mestre = false
    and gestor_aprovado = false
  );

-- VERIFICADO, personificando contas reais com a RLS valendo:
--   cadastro proprio (upsert da tela) .................. passa
--   vendedor tentando virar gestor mestre .............. recusado
--   vendedor tentando trocar o proprio cargo ........... recusado
--   gestor mestre promovendo outra pessoa .............. passa
--   o mesmo cadastro com a politica antiga ............. recursao (prova)
