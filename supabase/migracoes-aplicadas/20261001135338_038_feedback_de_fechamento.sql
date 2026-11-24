-- 20261001135338 038_feedback_de_fechamento

-- Feedback que a AURA escreve quando o vendedor marca Fechado ou Perdido.
-- Guardado, e nao so mostrado na hora, por tres motivos: o vendedor relê, o
-- gestor acompanha a jornada da pessoa ao longo do mes, e o relatorio semanal
-- e montado a partir daqui sem gastar IA de novo.
create table if not exists public.aura_feedback_fechamento (
  id                uuid primary key default gen_random_uuid(),
  empresa           text not null,
  vendedor_id       uuid not null references public.profiles(id) on delete cascade,
  oportunidade_id   uuid references public.oportunidades(id) on delete set null,
  relacionamento_id uuid references public.relacionamentos(id) on delete set null,
  cliente           text,

  resultado         text not null check (resultado in ('fechado', 'perdido')),
  valor             numeric,
  origem_lead       public.origem_lead,

  -- o texto corrido que o vendedor lê
  resumo            text not null,
  -- separados para o gestor conseguir somar padroes no mes
  acertos           text[] not null default '{}',
  erros             text[] not null default '{}',
  -- aderencia ao funil: etapas que o negocio nunca visitou antes de fechar
  -- ou perder. E assim que se ve quem pula a apresentacao e vai direto a preco.
  etapas_puladas    text[] not null default '{}',
  -- onde doeu, em uma palavra: abordagem, comunicacao, preco, prazo, produto,
  -- follow-up, concorrencia. Serve para agrupar a falha recorrente da pessoa.
  ponto_fraco       text,
  motivo_informado  text,

  criado_em         timestamptz not null default now()
);

create index if not exists feedback_fechamento_do_vendedor
  on public.aura_feedback_fechamento (vendedor_id, criado_em desc);
create index if not exists feedback_fechamento_da_loja
  on public.aura_feedback_fechamento (empresa, criado_em desc);

alter table public.aura_feedback_fechamento enable row level security;

-- O vendedor lê o proprio feedback; o gestor lê o da loja dele.
drop policy if exists "Ver o proprio feedback de fechamento" on public.aura_feedback_fechamento;
create policy "Ver o proprio feedback de fechamento"
  on public.aura_feedback_fechamento for select to authenticated
  using (
    vendedor_id = auth.uid()
    or pode_ver_todas_empresas()
    or (meu_cargo() = 'Gestor' and empresa = minha_empresa())
  );

-- Quem escreve e o servidor (service role). Nenhum cliente insere feedback a
-- mao: isto e laudo da AURA, nao campo editavel.
drop policy if exists "Gestor administra o feedback da loja" on public.aura_feedback_fechamento;
create policy "Gestor administra o feedback da loja"
  on public.aura_feedback_fechamento for delete to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));
