-- Poder dizer que um lead nao e lead.
--
-- O QUE EU ENCONTREI: dos seis leads sem carteira, CINCO eram a propria equipe
-- entrando como lead do Charles - "Elton Eduardo", "Alexandre", "Jeferson Sole
-- - Bento Goncalves", "Alexsander Reis - Vendedor LF Lareiras". O dono da
-- empresa e o gestor geral figurando como lead a ser trabalhado. E o Charles
-- aparecendo como lead de si mesmo.
--
-- E nao havia como arrumar: status so aceita quatro valores e nenhum significa
-- "descartado"; classificacao esta nula nos 71 registros. Esses nomes contam
-- como lead na meta, no funil e no relatorio do gestor, e a unica forma de
-- limpar seria apagar o registro, perdendo o historico.
--
-- Mesmo vocabulario do WhatsApp (migration 047), de proposito: um contato e a
-- mesma coisa venha da conversa ou da campanha, e duas palavras diferentes
-- para a mesma ideia viram duas regras divergentes com o tempo.
alter table public.leads_recebidos
  add column if not exists natureza text,
  add column if not exists motivo_natureza text,
  add column if not exists descartado_em timestamptz,
  add column if not exists descartado_por uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_recebidos_natureza_valida') then
    alter table public.leads_recebidos
      add constraint leads_recebidos_natureza_valida
      check (natureza is null or natureza in ('lead', 'nao_lead', 'cliente'));
  end if;
end $$;

create index if not exists leads_recebidos_natureza_idx
  on public.leads_recebidos (empresa, natureza);

-- LIMPEZA DE UMA VEZ, nao regra permanente.
--
-- Marca quem bate com um perfil ATIVO pelo primeiro nome. ATENCAO: o criterio
-- e frouxo e eu mesmo tive de desfazer um caso - "Rafael Teixeira" casou com o
-- "Rafael" do marketing, mas e sobrenome diferente, ou seja, cliente de
-- verdade. Marcar cliente como nao-lead faz o vendedor PERDER venda, que e pior
-- do que o problema que isto resolve. Quem rodar isto num banco novo deve
-- revisar o resultado nome por nome antes de confiar.
update public.leads_recebidos l
   set natureza = 'nao_lead',
       motivo_natureza = 'Colega de equipe',
       descartado_em = now()
 where l.natureza is null
   and exists (
     select 1 from public.profiles p
     where p.ativo is not false
       and length(split_part(p.nome, ' ', 1)) >= 5
       and l.nome ilike split_part(p.nome, ' ', 1) || '%'
   );
