-- O que a AURA nunca pode deixar de saber.
--
-- A busca por trecho resolve o tamanho do prompt, mas cria um risco novo: ha
-- regras da casa que valem em TODA conversa e que a busca nao traria, porque a
-- conversa nao fala delas. O caso mais claro e a secao 28 (LF, AEG e Sole): o
-- vendedor nao diz ao cliente que as tres operacoes sao a mesma empresa. Um
-- cliente pedindo desconto nunca usaria palavra que casasse com essa secao, e a
-- IA responderia sem saber da regra.
--
-- Entao o prompt tem duas partes: um NUCLEO fixo, pequeno, sempre presente, e
-- os trechos buscados conforme a conversa. O nucleo vai no pedaco do prompt que
-- fica em cache, porque nao muda; os buscados vao depois do ponto de corte.
--
-- O nucleo escolhido soma cerca de 2.700 caracteres por loja: os 10
-- mandamentos, o processo da venda (sem ele a IA nao sabe nomear a etapa), as
-- regras entre vendedores, o que e e o que nao e prospeccao, o que o vendedor
-- faz e nao faz, e a secao das tres operacoes.
alter table public.aura_material_trechos
  add column if not exists nucleo boolean not null default false;

update public.aura_material_trechos
   set nucleo = true
 where origem ilike any (array[
   '%OS 10 MANDAMENTOS%',
   '%O PROCESSO DA VENDA%',
   '%REGRAS ENTRE VENDEDORES%',
   '%LF, AEG E SOLE%',
   '%O QUE NÃO É PROSPECÇÃO%',
   '%O QUE O VENDEDOR SCMF NÃO FAZ%',
   '%O VENDEDOR SCMF FAZ%'
 ]);

create index if not exists aura_material_trechos_nucleo_idx
  on public.aura_material_trechos (empresa, nucleo) where nucleo;
