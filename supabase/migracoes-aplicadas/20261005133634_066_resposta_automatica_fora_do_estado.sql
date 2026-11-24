-- 20261005133634 066_resposta_automatica_fora_do_estado

alter table public.config_atendimento
  add column if not exists envio_automatico boolean not null default false,
  add column if not exists texto_automatico text,
  add column if not exists auto_hora_inicio smallint,
  add column if not exists auto_hora_fim smallint;

comment on column public.config_atendimento.envio_automatico is
  'Liga o envio automatico da primeira resposta para quem esta fora dos estados atendidos presencialmente. Nasce desligado de proposito.';
comment on column public.config_atendimento.texto_automatico is
  'A MENSAGEM QUE O CLIENTE LE. Diferente de texto_remoto, que e instrucao para a IA. Aceita {nome}, {estado} e {loja}.';

alter table public.whatsapp_ia_leads
  add column if not exists auto_enviado_em timestamptz,
  add column if not exists auto_texto text;

comment on column public.whatsapp_ia_leads.auto_enviado_em is
  'Quando a AURA respondeu sozinha neste contato. Preenchido = nunca mais manda, por contato.';

update public.config_atendimento
set texto_automatico = coalesce(texto_automatico,
  'Olá{nome}! Tudo bem? Aqui é da {loja}.'
  || E'\n\nVi que você é de {estado}. A nossa loja fica no Rio Grande do Sul, mas atendemos todo o Brasil — e a distância funciona bem:'
  || E'\n\n• *Videochamada:* eu caminho pelo showroom com você e mostro as peças ao vivo, respondendo na hora.'
  || E'\n• *Fotos e vídeos* dos produtos que interessam a você, gravados para o seu caso — não catálogo genérico.'
  || E'\n• *Projeto e medição a distância,* pelas fotos e medidas do ambiente que você mandar.'
  || E'\n• *Envio para todo o Brasil,* com prazo e frete combinados antes.'
  || E'\n\nMe conta um pouco do seu projeto que eu já começo a montar as opções. Prefere a videochamada ou as fotos primeiro?')
where texto_automatico is null;
