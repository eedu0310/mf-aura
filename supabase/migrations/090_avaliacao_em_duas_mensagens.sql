-- 090: o pedido de avaliação vira DUAS mensagens, com texto próprio de cada loja.
--
-- 1ª (mensagem_padrao): agradecimento + link de avaliação do Google ({link}).
-- 2ª (mensagem_redes):  convite para as redes ({instagram}, {facebook}) e
--                       fechamento.
--
-- Os marcadores são trocados na hora do envio pelos links já cadastrados em
-- link_instagram e link_facebook desta mesma tabela: o gestor muda o link num
-- lugar só e as mensagens acompanham. Pedido do Elton em 21/10: "para não
-- ficar tudo junto", e "cada empresa tem um textinho diferente".

alter table public.config_avaliacao
  add column if not exists mensagem_redes text;

comment on column public.config_avaliacao.mensagem_redes is
  '2ª mensagem do pedido de avaliação (redes sociais). Marcadores: {cliente}, {instagram}, {facebook}. Vazia = só a 1ª mensagem é enviada.';

update public.config_avaliacao set
  mensagem_padrao = $m$Oi, {cliente}! Tudo bem? 😊

Aqui é da LF Lareiras. Queremos agradecer de coração por ter escolhido a gente para trazer mais aconchego para a sua casa. Foi um prazer acompanhar o seu projeto, do primeiro atendimento até a instalação — esperamos que você aproveite muitas noites ao pé do fogo! 🔥

Já que você gostou do nosso trabalho, podemos te pedir um favor bem rapidinho? Deixe sua avaliação da LF Lareiras no Google, leva menos de um minuto:
👉 {link}$m$,
  mensagem_redes = $m$E se quiser acompanhar nossas novidades, siga a LF Lareiras nas redes — e marque a gente quando postar a foto da sua lareira acesa, adoramos ver o resultado na casa dos clientes! 📸

Instagram: {instagram}
Facebook: {facebook}

Sua opinião faz toda a diferença: é ela que mostra para outras famílias o cuidado e a dedicação que colocamos em cada lareira. Muito obrigado! 🙏$m$,
  atualizado_em = now()
where empresa = 'LF Lareiras';

update public.config_avaliacao set
  mensagem_padrao = $m$Oi, {cliente}! Tudo bem? 😊

Aqui é da A&G Aquecimento. Muito obrigado pela confiança em nós para deixar a sua casa mais quentinha e confortável! Foi um prazer cuidar de cada detalhe do seu projeto, do orçamento à instalação.

Se você ficou satisfeito com o nosso trabalho, pode nos ajudar com uma avaliação no Google? É rapidinho, menos de um minuto:
👉 {link}$m$,
  mensagem_redes = $m$Também vamos adorar ter você com a gente nas redes sociais! Se postar uma foto do seu ambiente aquecido, marca a A&G — é muito bom ver o resultado do nosso trabalho no dia a dia de vocês. 📸

Instagram: {instagram}
Facebook: {facebook}

Cada avaliação ajuda outras pessoas a conhecerem o cuidado e a dedicação da nossa equipe. Obrigado de verdade! 🙏$m$,
  atualizado_em = now()
where empresa = 'A&G Aquecimento';

update public.config_avaliacao set
  mensagem_padrao = $m$Oi, {cliente}! Tudo bem? 😊

Aqui é da Sole Aquecimento. Queremos agradecer por ter escolhido a Sole para o seu projeto! Foi muito bom acompanhar cada etapa com você, e esperamos que o seu novo produto traga muito conforto e bons momentos para a sua família. 🔥

Se gostou do nosso atendimento, você pode nos ajudar deixando uma avaliação no Google? Leva menos de um minuto:
👉 {link}$m$,
  mensagem_redes = $m$E fica o convite: siga a Sole nas redes sociais para ver nossas novidades e inspirações. Se postar uma foto do seu produto instalado, marque a gente — vamos adorar compartilhar! 📸

Instagram: {instagram}
Facebook: {facebook}

Sua avaliação mostra para outras pessoas o carinho e a dedicação que a Sole coloca em cada cliente. Muito obrigado! 🙏$m$,
  atualizado_em = now()
where empresa = 'Sole Aquecimento';

update public.config_avaliacao set
  mensagem_padrao = $m$Olá, {cliente}! Tudo bem? 😊

Aqui é da MF International. Obrigado por confiar nos nossos produtos e na nossa equipe! Foi um prazer fazer parte do seu projeto, e esperamos que o resultado supere as suas expectativas.

Se você ficou satisfeito, pode nos ajudar com uma avaliação no Google? É bem rápido, menos de um minuto:
👉 {link}$m$,
  mensagem_redes = $m$Acompanhe também a MF nas redes sociais: lá mostramos lançamentos, projetos e bastidores da nossa fábrica. E se publicar o seu projeto, marque a gente — adoramos ver nossos produtos em uso! 📸

Instagram: {instagram}
Facebook: {facebook}

Sua opinião ajuda outras pessoas a conhecerem a qualidade e o cuidado que colocamos em cada peça. Muito obrigado! 🙏$m$,
  atualizado_em = now()
where empresa = 'MF International';
