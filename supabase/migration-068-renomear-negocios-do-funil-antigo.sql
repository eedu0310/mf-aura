-- RODAR SO DEPOIS DO DEPLOY DO CODIGO NOVO.
--
-- Renomeia os negocios que ainda estao com os nomes do funil antigo:
--   Proposta -> Follow-up      (23 negocios)
--   Fechados -> Fechamento     (8 negocios)
--
-- POR QUE DEPOIS E NAO ANTES: o codigo antigo compara o nome cru
-- (etapa = 'Fechados') para decidir se a venda entra no mes. Renomear com ele
-- ainda no ar faria os 8 negocios fechados deixarem de contar como fechados
-- na mesma hora. O codigo novo pergunta o PAPEL da etapa e entende os dois
-- nomes, entao com ele no ar a renomeacao nao muda nada -- e so limpeza.
--
-- E POR QUE E SO LIMPEZA: colunaDoNegocio() ja traduz "Proposta" para a
-- coluna "Follow-up", entao os negocios aparecem no lugar certo mesmo sem
-- rodar isto. O que isto resolve e a contagem na tela de editar o funil, que
-- conta por nome gravado, e o incomodo de ver dois nomes para a mesma coisa.
update public.oportunidades set etapa = 'Follow-up', updated_at = now()
 where etapa = 'Proposta';

update public.oportunidades set etapa = 'Fechamento', updated_at = now()
 where etapa = 'Fechados';

update public.whatsapp_ia_leads set etapa = 'Follow-up', updated_at = now()
 where etapa = 'Proposta';

update public.whatsapp_ia_leads set etapa = 'Fechamento', updated_at = now()
 where etapa = 'Fechados';

-- Conferencia: nao pode sobrar nenhum negocio num nome que nao esteja no
-- funil da loja dele.
select o.empresa, o.etapa, count(*) as negocios
from public.oportunidades o
where not exists (
  select 1 from public.etapas_funil e
  where e.empresa = o.empresa and e.nome = o.etapa
)
group by o.empresa, o.etapa
order by 1, 2;
