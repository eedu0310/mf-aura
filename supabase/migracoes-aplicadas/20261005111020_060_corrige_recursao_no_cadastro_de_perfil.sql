-- 20261005111020 060_corrige_recursao_no_cadastro_de_perfil

-- Recursao infinita ao salvar o cadastro.
--
-- SINTOMA: "Não consegui salvar seu cadastro. (infinite recursion detected in
-- policy for relation profiles)" na tela de boas-vindas, ao escolher loja e
-- papel. Ninguem conseguia criar conta pelo proprio cadastro.
--
-- CAUSA: a politica restritiva profiles_nao_se_autopromove, criada em 28/09
-- (migration gestores_mestres_e_permissoes), precisa comparar o valor NOVO com
-- o valor ATUAL de cargo, gestor_mestre e gestor_aprovado - e fazia isso com
-- tres subconsultas "select ... from profiles" escritas dentro da propria
-- regra de profiles. Avaliar a regra exigia ler a tabela, ler a tabela exigia
-- avaliar a regra, e o Postgres aborta.
--
-- So aparecia agora porque este caminho e raro: a tela de cadastro usa upsert,
-- e e o ramo de ATUALIZACAO que dispara a regra. As contas novas da equipe
-- foram criadas pelo painel do gestor, que usa a chave de servico e passa por
-- fora da RLS. Confirmei que nao foi a minha reescrita da migration 058:
-- com o texto anterior ao meu, o erro acontece igual.
--
-- CORRECAO: ler o valor atual por funcao SECURITY DEFINER, que roda com os
-- direitos do dono da tabela e por isso nao reentra na politica. E o mesmo
-- padrao que meu_cargo() e minha_empresa() ja usavam no resto do sistema - a
-- politica so nao seguiu o padrao da casa.

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

-- Mesma regra de antes, sem ler a propria tabela:
-- voce mexe no seu perfil, mas nao muda o seu cargo nem se promove.
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
-- poder sobre as quatro lojas.
--
-- O painel do gestor cria usuario pela chave de servico, que ignora RLS, entao
-- isto nao atrapalha quem cadastra a equipe.
alter policy "Usuário pode criar o próprio perfil" on public.profiles
  with check (
    (select auth.uid()) = id
    and gestor_mestre = false
    and gestor_aprovado = false
  );
