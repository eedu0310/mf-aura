-- Material de treinamento partido em trechos buscaveis.
--
-- O prompt da AURA injetava TODOS os materiais ativos da loja de uma vez, com
-- corte em 40 mil caracteres. Com os sete documentos carregados (mais de 400
-- mil caracteres) o corte jogaria fora justamente o que faz falta, de forma
-- imprevisivel: o manual acabaria cortado no meio de uma secao.
--
-- Com os trechos indexados, a conversa busca so o pedaco que importa - cliente
-- falou de preco, vai a secao de desconto; falou de obra, vai a de
-- construtoras. O resto do manual nao precisa viajar em toda analise.
--
-- A coluna "busca" inclui o titulo (origem) junto do texto, para quem procura
-- pelo nome da secao tambem achar. O efeito colateral e que as palavras do
-- titulo do documento ficam em todos os trechos dele - "SCMF", "Guia",
-- "Rapido", "Vendedor" aparecem em 58% a 67% deles. Quem resolve isso e a
-- funcao de busca da migration 045, que descarta palavra comum demais.
create table if not exists public.aura_material_trechos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.aura_materiais(id) on delete cascade,
  empresa text not null,
  ordem integer not null,
  origem text not null,
  texto text not null,
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(origem, '') || ' ' || coalesce(texto, ''))
  ) stored,
  criado_em timestamptz not null default now()
);

create index if not exists aura_material_trechos_busca
  on public.aura_material_trechos using gin (busca);
create index if not exists aura_material_trechos_da_loja
  on public.aura_material_trechos (empresa, material_id, ordem);

alter table public.aura_material_trechos enable row level security;

-- Sem "drop policy if exists": neste projeto o DROP e barrado pela mesma
-- politica que barra o DELETE, e a migration so passou depois de remover.
create policy "Ver trechos da propria loja" on public.aura_material_trechos
  for select using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor administra os trechos da loja" on public.aura_material_trechos
  for all using (
    pode_ver_todas_empresas()
    or (meu_cargo() = 'Gestor' and empresa = minha_empresa())
  );
