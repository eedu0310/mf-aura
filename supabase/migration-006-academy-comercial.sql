-- Academy comercial: módulos iniciais inspirados no mapa comercial do Grupo MF.
create table if not exists public.treinamentos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  descricao text,
  categoria text,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.treinamento_progresso (
  owner_id uuid not null references auth.users(id) on delete cascade,
  treinamento_id uuid not null references public.treinamentos(id) on delete cascade,
  concluido boolean not null default false,
  concluido_em timestamptz,
  primary key (owner_id, treinamento_id)
);

create table if not exists public.perguntas_frequentes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  pergunta text not null,
  resposta text not null,
  link text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.treinamentos enable row level security;
alter table public.treinamento_progresso enable row level security;
alter table public.perguntas_frequentes enable row level security;

drop policy if exists "Vendedor vê treinamentos da empresa" on public.treinamentos;
create policy "Vendedor vê treinamentos da empresa" on public.treinamentos for select
using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));

drop policy if exists "Usuário vê seu progresso" on public.treinamento_progresso;
create policy "Usuário vê seu progresso" on public.treinamento_progresso for select using (owner_id = auth.uid());
drop policy if exists "Usuário atualiza seu progresso" on public.treinamento_progresso;
create policy "Usuário atualiza seu progresso" on public.treinamento_progresso for insert with check (owner_id = auth.uid());
create policy "Usuário edita seu progresso" on public.treinamento_progresso for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Vendedor vê FAQ da empresa" on public.perguntas_frequentes;
create policy "Vendedor vê FAQ da empresa" on public.perguntas_frequentes for select
using (empresa = (select p.empresa from public.profiles p where p.id = auth.uid()));

insert into public.treinamentos (empresa, titulo, descricao, categoria)
select empresas.empresa, modulo.titulo, modulo.descricao, modulo.categoria
from (values
  ('SDR e pré-vendas', 'Qualificação antes de passar ao vendedor', 'SDR e Qualificação'),
  ('Vendedor: SPIN e gatilhos', 'Do rapport ao fechamento consultivo', 'Processo Comercial'),
  ('Produto e diferenciais', 'Argumentos técnicos que sustentam o valor', 'Produto'),
  ('Perfis de cliente', 'Cliente final, arquitetos, construtoras e obras', 'Perfis de Cliente'),
  ('Venda consultiva', 'Perguntas SPIN e BANT para entender o projeto', 'Processo Comercial'),
  ('Cadências de follow-up', 'Ritmo de contato de 0 a 90 dias', 'Follow-up'),
  ('Contorno de objeções', 'Preço, comparação, prazo, decisão e segurança', 'Objeções'),
  ('Checklist comportamental', 'Postura, registro no CRM e padrão premium', 'Execução'),
  ('Funil comercial completo', 'Da prospecção ao fechamento e pós-venda', 'Funil Comercial'),
  ('Checklists técnicos', 'Medidas, fotos, planta, instalação e próximos passos', 'Produto')
) as modulo(titulo, descricao, categoria)
cross join (values ('MF International'), ('LF Lareiras'), ('A&G Aquecimento'), ('Sole Aquecimento')) as empresas(empresa)
where not exists (
  select 1 from public.treinamentos t where t.empresa = empresas.empresa and t.titulo = modulo.titulo
);

insert into public.perguntas_frequentes (empresa, pergunta, resposta, ordem)
select empresas.empresa, faq.pergunta, faq.resposta, faq.ordem
from (values
  ('O que registrar depois de um atendimento?', 'Registre canal, cliente, tipo de contato, o que foi conversado, próximo passo e data combinada.', 1),
  ('Como tratar achei caro?', 'Investigue a comparação e explique valor, consumo, durabilidade, segurança e adequação ao projeto. Termine com um próximo passo.', 2),
  ('Quando fazer follow-up?', 'Defina a data antes de encerrar o contato. Use cadência conforme a temperatura do lead e registre todas as tentativas.', 3),
  ('O que diferencia visita de prospecção?', 'Visita pode ser normal, revisita, prospecção ou pós-venda. Prospecção deve indicar o perfil: cliente final, cliente novo, arquiteto, construtor ou obra.', 4)
) as faq(pergunta, resposta, ordem)
cross join (values ('MF International'), ('LF Lareiras'), ('A&G Aquecimento'), ('Sole Aquecimento')) as empresas(empresa)
where not exists (
  select 1 from public.perguntas_frequentes f where f.empresa = empresas.empresa and f.pergunta = faq.pergunta
);
