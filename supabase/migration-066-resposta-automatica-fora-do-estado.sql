-- A primeira resposta para quem esta longe, enviada pela AURA.
--
-- O PEDIDO: lead de outro estado recebe sozinho a oferta de atendimento a
-- distancia, sem esperar o vendedor abrir a conversa. Um lead de Sao Paulo que
-- escreve as 22h e respondido as 22h, e nao na manha seguinte.
--
-- NASCE DESLIGADO, loja por loja. Mandar mensagem em nome do vendedor e coisa
-- seria: quem liga e o gestor, na aba Atendimento por distancia.
--
-- texto_automatico E DIFERENTE de texto_remoto. O texto_remoto e instrucao
-- para a IA ("ofereca videochamada..."); o texto_automatico e a MENSAGEM QUE O
-- CLIENTE LE, escrita como o vendedor falaria, porque sai no nome dele.
alter table public.config_atendimento
  add column if not exists envio_automatico boolean not null default false,
  add column if not exists texto_automatico text,
  add column if not exists auto_hora_inicio smallint,
  add column if not exists auto_hora_fim smallint;

comment on column public.config_atendimento.envio_automatico is
  'Liga o envio automatico da primeira resposta para quem esta fora dos estados atendidos presencialmente. Nasce desligado de proposito.';
comment on column public.config_atendimento.texto_automatico is
  'A MENSAGEM QUE O CLIENTE LE. Diferente de texto_remoto, que e instrucao para a IA. Aceita {nome}, {estado}, {uf} e {loja}.';

-- A marca de "ja respondi este contato" vive no banco, nao na memoria do
-- processo: reiniciar o servidor nao pode fazer o cliente receber a mesma
-- mensagem de novo. E ela e reservada ANTES do envio, com a condicao de ainda
-- estar vazia -- e isso que impede duas analises simultaneas da mesma conversa
-- de mandarem a mensagem duas vezes.
alter table public.whatsapp_ia_leads
  add column if not exists auto_enviado_em timestamptz,
  add column if not exists auto_texto text;

comment on column public.whatsapp_ia_leads.auto_enviado_em is
  'Quando a AURA respondeu sozinha neste contato. Preenchido = nunca mais manda, por contato.';

-- Ponto de partida para o gestor ajustar. {estado} ja vem com a preposicao
-- certa ("do Parana", "de Sao Paulo", "da Bahia"): mensagem automatica com
-- portugues torto entrega na primeira linha que ninguem escreveu aquilo.
update public.config_atendimento
set texto_automatico =
  'Olá{nome}! Tudo bem? Aqui é da {loja}.'
  || E'\n\nVi que você é {estado}. A nossa loja fica no Rio Grande do Sul, mas atendemos todo o Brasil — e a distância funciona bem:'
  || E'\n\n• *Videochamada:* eu caminho pelo showroom com você e mostro as peças ao vivo, respondendo na hora.'
  || E'\n• *Fotos e vídeos* dos produtos que interessam a você, gravados para o seu caso — não catálogo genérico.'
  || E'\n• *Projeto e medição a distância,* pelas fotos e medidas do ambiente que você mandar.'
  || E'\n• *Envio para todo o Brasil,* com prazo e frete combinados antes.'
  || E'\n\nMe conta um pouco do seu projeto que eu já começo a montar as opções. Prefere a videochamada ou as fotos primeiro?'
where texto_automatico is null or texto_automatico = '';
