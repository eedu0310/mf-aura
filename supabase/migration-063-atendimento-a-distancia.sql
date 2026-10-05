-- O que oferecer a quem esta longe do showroom.
--
-- O PROBLEMA: a AURA sugere o texto que o vendedor manda, e sugeria "venha
-- conhecer nosso showroom" para cliente de Sao Paulo. Medido na base real:
-- cerca de 20% dos contatos estao fora do Rio Grande do Sul. Convite
-- impossivel nao e so inutil - e a mensagem que mostra ao cliente que do outro
-- lado ninguem leu o que ele escreveu.
--
-- COMO O SISTEMA SABE DE ONDE E: pelo DDD do telefone. O campo "estado" da
-- carteira esta vazio nos 132 contatos e "cidade" em 18; o telefone esta em
-- 129 deles. Esperar que alguem preencha o estado e esperar o que nao acontece
-- ha meses - o DDD ja esta la, de graca, em 97% dos contatos.
--
-- O QUE E EDITAVEL: tudo o que a AURA oferece, nos dois casos. O gestor escreve
-- e e esse texto que entra no prompt, sem deploy. Nao ha roteiro escondido no
-- codigo - foi pedido explicito que fosse personalizavel.
create table if not exists public.config_atendimento (
  empresa text primary key,
  estados_presenciais text[] not null default array['RS'],
  texto_presencial text,
  texto_remoto text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id) on delete set null
);

alter table public.config_atendimento enable row level security;

create policy "Equipe ve a config de atendimento" on public.config_atendimento
  for select using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor edita a config de atendimento" on public.config_atendimento
  for all using (
    pode_ver_todas_empresas() or (vejo_a_loja_toda() and empresa = minha_empresa())
  );

-- Ponto de partida, para o gestor ajustar. Deixei o texto CONCRETO de
-- proposito: "ofereca atendimento personalizado" nao ajuda ninguem, e a IA
-- inventaria o que oferecer - que e justamente o que nao pode acontecer.
insert into public.config_atendimento (empresa, estados_presenciais, texto_presencial, texto_remoto)
select e.nome, array['RS'],
  'Convide para conhecer o showroom pessoalmente, com hora marcada. '
  || 'Ofereça visita técnica para medição no local quando o projeto já tiver espaço definido.',
  'Este cliente está longe para visitar o showroom. Em vez de convidar para vir, ofereça:'
  || E'\n- uma videochamada em que o vendedor caminha pelo showroom mostrando as peças ao vivo e responde na hora;'
  || E'\n- fotos e vídeos dos produtos que interessam a ele, gravados para o caso dele e não catálogo genérico;'
  || E'\n- projeto e medição a distância, pelas fotos e medidas do ambiente que ele enviar;'
  || E'\n- indicação de instalador na região dele, quando houver;'
  || E'\n- envio para todo o Brasil, com o prazo e o frete combinados antes.'
  || E'\nNunca diga que ele pode passar na loja nem marque visita presencial.'
from (values
  ('MF International'), ('LF Lareiras'), ('A&G Aquecimento'), ('Sole Aquecimento')
) as e(nome)
on conflict (empresa) do nothing;
