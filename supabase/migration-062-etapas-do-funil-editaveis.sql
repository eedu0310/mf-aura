-- As etapas do funil deixam de ser fixas no codigo.
--
-- Estavam escritas em SETE lugares: a trava da tabela oportunidades, as regras
-- que a IA usa para detectar a etapa, o prompt do supervisor, a pontuacao, a
-- cor do card, o calculo do pipeline e o tipo em TypeScript. Mudar o funil
-- exigia mexer em todos - ou seja, nao era editavel de verdade.
--
-- Agora cada loja tem a sua lista, e duas colunas carregam o SIGNIFICADO (o
-- que o codigo precisa saber) separado do NOME (o que o gestor muda):
--
--   tipo  'aberta'   negocio em andamento
--         'ganho'    fechou: e esta etapa que cria a venda
--         'perda'    encerrou sem vender
--         'posvenda' ja comprou, acompanhamento depois da venda
--
--   conta_no_pipeline  entra na conta do funil. Pedido explicito do gestor:
--                      "contabilize somente o que estiver em proposta em
--                      diante, nao posso que qualquer lead contabilize".
--                      Com a marca na etapa, renomear nao quebra a regra - que
--                      era exatamente o defeito do desenho anterior.
--
-- 'ganho' e 'perda' sao especiais porque o codigo precisa saber qual etapa
-- significa "vendeu" (para criar a venda) e qual significa "acabou". O gestor
-- renomeia as duas a vontade, mas nao pode ficar sem elas.
create table if not exists public.etapas_funil (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  nome text not null,
  ordem integer not null,
  tipo text not null default 'aberta'
    check (tipo in ('aberta', 'ganho', 'perda', 'posvenda')),
  conta_no_pipeline boolean not null default false,
  probabilidade text check (probabilidade in ('Baixa', 'Média', 'Alta')),
  cor text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, nome)
);

create index if not exists etapas_funil_da_loja on public.etapas_funil (empresa, ordem);
alter table public.etapas_funil enable row level security;

create policy "Equipe ve as etapas da loja" on public.etapas_funil
  for select using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor edita as etapas da loja" on public.etapas_funil
  for all using (
    pode_ver_todas_empresas() or (vejo_a_loja_toda() and empresa = minha_empresa())
  );

insert into public.etapas_funil (empresa, nome, ordem, tipo, conta_no_pipeline, probabilidade, cor)
select e.nome, x.nome, x.ordem, x.tipo, x.conta, x.prob, x.cor
from (values
  ('MF International'), ('LF Lareiras'), ('A&G Aquecimento'), ('Sole Aquecimento')
) as e(nome),
(values
  ('Prospecção',               1, 'aberta',   false, 'Baixa', '#8696a0'),
  ('Qualificação e Abordagem', 2, 'aberta',   false, 'Baixa', '#7fd1ff'),
  ('Apresentação',             3, 'aberta',   false, 'Média', '#53bdeb'),
  ('Follow-up',                4, 'aberta',   true,  'Média', '#ffd279'),
  ('Negociação',               5, 'aberta',   true,  'Alta',  '#ffa65c'),
  ('Fechamento',               6, 'ganho',    true,  'Alta',  '#00a884'),
  ('Pós-venda',                7, 'posvenda', false, 'Alta',  '#9ae6b4'),
  ('Perdidos',                 8, 'perda',    false, 'Baixa', '#f15c6d')
) as x(nome, ordem, tipo, conta, prob, cor)
on conflict (empresa, nome) do nothing;

-- A trava aceita os nomes novos E os antigos ao mesmo tempo, de proposito: o
-- sistema no ar ainda usa os antigos, e trocar banco e codigo em momentos
-- diferentes derrubaria o pipeline de todo mundo no intervalo. Os antigos saem
-- na migration seguinte, junto com o deploy.
alter table public.oportunidades drop constraint if exists oportunidades_etapa_check;
alter table public.oportunidades add constraint oportunidades_etapa_check
  check (etapa in (
    'Prospecção', 'Apresentação', 'Proposta', 'Negociação', 'Fechados', 'Perdidos',
    'Qualificação e Abordagem', 'Follow-up', 'Fechamento', 'Pós-venda'
  ));

-- A troca de nomes dos negocios que existem fica para a migration do deploy:
--   22 em 'Proposta'  -> 'Follow-up'   (mesma posicao no funil)
--    7 em 'Fechados'  -> 'Fechamento'
--   os outros 36 ficam como estao
