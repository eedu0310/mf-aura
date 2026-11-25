-- Chat do site MF: tempo de espera do assistente virtual dentro do horário.
-- Se ninguém da equipe responder o visitante em X minutos, o assistente
-- responde (pedido do Elton, 25/11). null = não entra dentro do horário.
alter table public.site_chat_config
  add column if not exists ia_esperar_minutos integer
  check (ia_esperar_minutos is null or ia_esperar_minutos between 5 and 1440);
