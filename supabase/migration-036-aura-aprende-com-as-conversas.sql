-- ============================================================================
-- 036 — A AURA aprende com as conversas do dia a dia
--
-- Os materiais (aura_materiais) são o conhecimento que o gestor SOBE: manual,
-- playbook, tabela de produtos. Esta tabela é o complemento: o conhecimento que
-- sai das conversas reais trocadas no WhatsApp e no Instagram, todo dia.
--
-- Importante: o modelo de IA não muda com o uso — os pesos dele são fixos. O que
-- aprende é o SISTEMA: todo dia um processo lê as conversas, tira daí a objeção
-- que o cliente levantou e a resposta que destravou a venda, guarda aqui, e
-- passa a injetar isso nos prompts. Na prática a AURA vai ficando melhor no
-- nosso negócio, mas por acúmulo de conhecimento nosso, não por treino do modelo.
--
-- Nada entra em uso sozinho: o que o processo extrai nasce como 'sugerido' e só
-- passa a valer depois que o gestor aprova. Mesma regra que já vale para lead e
-- venda — a IA propõe, a pessoa decide. Aqui isso é ainda mais necessário: se a
-- IA reforçar sozinha um preço errado que apareceu numa conversa, ela passa a
-- repetir esse preço errado para todos os clientes.
-- ============================================================================

create table if not exists public.aura_aprendizado (
  id             uuid primary key default gen_random_uuid(),
  empresa        text not null,
  canal          text not null default 'whatsapp'
                   check (canal in ('whatsapp', 'instagram', 'manual')),
  tipo           text not null
                   check (tipo in ('objecao', 'pergunta', 'abordagem')),

  -- o que o cliente disse/perguntou, e a resposta que funcionou
  gatilho        text not null,
  resposta       text not null,

  -- chave normalizada do gatilho: serve para o processo diário INCREMENTAR
  -- um padrão que já existe em vez de inserir a mesma coisa toda noite
  chave          text not null,

  vezes_visto    integer not null default 1,
  vezes_fechou   integer not null default 0,

  status         text not null default 'sugerido'
                   check (status in ('sugerido', 'aprovado', 'recusado')),
  revisado_por   uuid references public.profiles(id) on delete set null,
  revisado_em    timestamptz,

  fonte          text,           -- referência da conversa, para auditoria
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Dedupe: um padrão por loja/canal/tipo.
create unique index if not exists aura_aprendizado_chave_unica
  on public.aura_aprendizado (empresa, canal, tipo, chave);

-- Leitura dos aprovados na hora de montar o prompt: os que mais fecharam vêm
-- primeiro, porque o texto do prompt é cortado por tamanho.
create index if not exists aura_aprendizado_para_prompt
  on public.aura_aprendizado (empresa, status, vezes_fechou desc, vezes_visto desc);

alter table public.aura_aprendizado enable row level security;

-- Mesmo desenho de aura_materiais: a loja vê o seu, o gestor administra o seu.
drop policy if exists "Ver aprendizado da própria loja" on public.aura_aprendizado;
create policy "Ver aprendizado da própria loja"
  on public.aura_aprendizado for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "Gestor revisa o aprendizado da loja" on public.aura_aprendizado;
create policy "Gestor revisa o aprendizado da loja"
  on public.aura_aprendizado for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

-- atualizado_em sempre honesto, sem depender de quem escreve.
create or replace function public.aura_aprendizado_toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists aura_aprendizado_atualizado_em on public.aura_aprendizado;
create trigger aura_aprendizado_atualizado_em
  before update on public.aura_aprendizado
  for each row execute function public.aura_aprendizado_toca_atualizado_em();
