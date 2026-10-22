-- 092: base de conhecimento do Grupo MF dentro da IA da AURA (22/10/2026).
--
-- Vem da skill "Grupo MF" do Elton, com a correção dele: condução de ar
-- quente para outros ambientes só na lareira EMBUTIDA (projeto da loja);
-- expostas e suspensas não fazem. Garantia e duração da carga de lenha são
-- por modelo.
--
-- Por loja:
--   * "Base Grupo MF (produto e loja)": regras de produto e comunicação + identidade da loja.
--     São seções de NÚCLEO (SECOES_NUCLEO em src/lib/aura/trechos.ts): vão em
--     toda análise, porque nenhum cliente escreve a palavra que faria a busca
--     trazê-las ("vitalícia", "condução").
--   * 4 materiais pesquisáveis (ficha técnica, instalação/uso/garantia,
--     objeções/follow-up, portfólio de parceiros): entram por busca, só
--     quando a conversa toca no assunto.
--
-- Trechos gerados com o próprio partirEmTrechos do repositório, então são os
-- mesmos que o painel de materiais geraria num reenvio. Idempotente: não
-- duplica material com o mesmo título na mesma loja, e não regrava trechos
-- de material que já tem trechos. O gestor pode desligar ou trocar qualquer
-- um deles na tela de materiais da AURA.

-- Base Grupo MF (produto e loja)
with lojas(empresa) as (values ($k$LF Lareiras$k$), ($k$A&G Aquecimento$k$), ($k$Sole Aquecimento$k$), ($k$MF International$k$)),
r(texto) as (values ($k$# REGRAS DE PRODUTO E COMUNICAÇÃO

Valem em toda conversa e em toda mensagem sugerida ao vendedor (base do Grupo MF, confirmada pelo dono em 22/10/2026).

- Garantia: "até 5 anos, conforme o modelo". Estrutura 5 anos: Prime, Wide, Vision, Vitro, Altezza, Efficienza, MF 1200, MF 1400, Evo Fire. 2 anos: Adatto, Duo, Delicatta, Forza, Orbit, 360, Ottanta, MF 350, Fogo Pro, Fire Pro. 1 ano: MF 150 e MF 250. Mão de obra, vidro, vedação, pintura e refratários: 1 ano. Na dúvida, "conforme o certificado do modelo". NUNCA garantia vitalícia de lareira; a única vitalícia é o cabo do piso aquecido (controlador 2 anos).

- Tripla combustão: Adatto, Prime, Wide, Duo, Vision, Vitro, Altezza, Efficienza, Forza, Delicatta, MF 150/250/350. Dupla: Evo Fire, MF 1200, MF 1400, Fogo Pro, Fire Pro. Suspensas (360, Ottanta) e Orbit NÃO têm tripla.

- Calor para outros ambientes: só a lareira EMBUTIDA, com o projeto de condução de ar quente que a loja faz na instalação (grelhas e canalização do nicho; o aparelho não é ligado a dutos). EXPOSTAS e SUSPENSAS não fazem condução: a exposta aquece o ambiente onde está (o ventilador distribui melhor); 360 e Ottanta giram 360° e direcionam calor e vista do fogo; a Orbit é semi-suspensa e central.

- Carga de lenha: muda por modelo (de 1 h na Orbit a 6 h na Prime, Wide e Evo Fire). Cite o número da ficha técnica do modelo, nunca um genérico.

- Economia sempre com "até": 3 a 5 m³ de lenha por inverno contra 10 a 16 m³ de lareira comum; até 80% menos lenha; até R$ 4.000 por temporada.

- Modelo certo: pela faixa de m³ (área x pé-direito) da ficha, com folga. Mais vendida: Adatto 90 exposta.

Nunca: falar mal da concorrência; passar ao cliente condições internas (PIX 3%, boleto 35% + 10x, venda programada, descontos de gerência); sugerir instalação junto a madeira/MDF, gesso comum ou TV sem cornija; destacar Kratki (só saldo) ou dar preço de Seccare (consultar a loja); dizer "da China".

WhatsApp: mensagens curtas, sem abreviação, terminando com pergunta ou próximo passo; valor antes do preço; "tu" gaúcho ("tu quer", "te mando"), nunca "queres/tens"; nada de "Fico no aguardo" ou "Qualquer coisa te chamo" sem pergunta junto.

## Argumentos e prova social

Tempo de mercado: MF e LF "desde 1977" (49 anos em 2026); A&G "desde 2016". Prova social liberada: zero reclamações no Reclame Aqui; mais de 1.500 lareiras a pronta entrega; clientes Murilo Rosa e Alejandro Claveaux; instalações em Gramado, Torres, Xangri-Lá, Porto Alegre, Bento Gonçalves, SP e RJ. Diferencial central da MF: pioneira na tripla combustão, engenharia canadense, vermiculita importada. Compare com a concorrência por tecnologia, materiais, consumo e garantia, sem falar mal.$k$)),
m(empresa, texto) as (values
($k$LF Lareiras$k$, (select texto from r) || E'\n\n' || $k$# IDENTIDADE DA LOJA — LF Lareiras

Loja e showroom junto à fábrica MF, desde 1977 (49 anos), com instalação própria e entrega para todo o Brasil.
Endereço: ERS-122, km 8, nº 8250, Conceição, São Sebastião do Caí/RS.
Contato: (51) 3536-1701 (fixo e WhatsApp) · comercial@lflareiras.com.br · lflareiras.com.br · Instagram @lflareiras.
Horário (verão): segunda a sexta 08:00–11:45 e 13:30–18:00; sábado 09:00–12:00.
Tom: caloroso, tradição, consultivo. Bordão: "Conforto não é luxo. É qualidade de vida."
Vende lareiras MF (marca do produto: "Lareiras MF"), pellet, fogões, linha gourmet, piso aquecido e marcas parceiras.$k$),
($k$A&G Aquecimento$k$, (select texto from r) || E'\n\n' || $k$# IDENTIDADE DA LOJA — A&G Aquecimento

Loja de aquecimento desde 2016, com equipe de instalação própria e duas lojas em Garibaldi/RS.
Endereços: Av. Rio Branco, 495, Centro; e Av. Garibaldina, 1441, loja 05 (Boulevard Convention, loja conceito).
Contato: WhatsApp (54) 99327-2098 · fixo (54) 3462-5843 · aegaquecimento.com.br · Instagram @aegaquecimento.
Tom: sofisticado, minimalista. Bordão: "Onde a excelência e o calor se unem."
Vende lareiras MF (marca do produto: "Lareiras MF"), pellet (Foco), fogões, linha gourmet, piso aquecido, toalheiros e marcas parceiras.$k$),
($k$Sole Aquecimento$k$, (select texto from r) || E'\n\n' || $k$# IDENTIDADE DA LOJA — Sole Ferro e Fogo

Loja de alto padrão em Bento Gonçalves/RS (nasceu como Sole Aquecimento Solar).
Endereço: R. Fiorelo Bertuol, 739, Progresso, Bento Gonçalves/RS.
Contato: WhatsApp (54) 99180-5838 · (54) 3452-0333 · contato.soleaquecimento@gmail.com · Instagram @soleferroefogo.
Horário: segunda a sexta 08:00–11:30 e 13:30–18:00; sábado 08:00–11:30.
Tom: aconchego e design, "aquecer é criar experiências". Bordão: "Calor · Design · Tradição."
Vende lareiras a lenha e pellet, fogões, churrasqueiras, aquecimento solar, piscina, piso aquecido e toalheiros.$k$),
($k$MF International$k$, (select texto from r) || E'\n\n' || $k$# IDENTIDADE DA LOJA — MF International

Fábrica de lareiras de alto rendimento desde 1977, pioneira na tripla combustão no Brasil, engenharia canadense. Também fabrica fornos, braseiros e tubulações prediais (chaminés para construtoras: rígido, helicoidal e flexível, 80 a 1500 mm).
Endereço: ERS-122, km 08, Conceição, São Sebastião do Caí/RS.
Contato: WhatsApp (51) 3536-1422 · mfinternational.com.br · Instagram @mfinternational.
Tom: técnico-premium, engenharia, tradição. Bordões: "Pioneiros na tripla combustão" · "Engenharia canadense".
Atende revendas, arquitetos e construtoras: blocos 3D (SKP/3DS), MF Preview (realidade aumentada) e orientação técnica gratuita no projeto.$k$)),
novos as (
  insert into public.aura_materiais (empresa, titulo, descricao, arquivo_nome, tipo, bytes, texto, ativo, criado_por)
  select l.empresa, $k$Base Grupo MF (produto e loja)$k$, $k$Regras de produto que a IA não pode errar (garantia, combustão, calor em outros ambientes, carga de lenha) e a identidade da loja. Vai em toda análise.$k$, 'base-grupo-mf.md', 'text/markdown', octet_length(m.texto), m.texto, true, 'a12e4445-d296-44d7-8c8e-b9fc09dfdf0a'
  from m join lojas l on m.empresa is null or m.empresa = l.empresa
  where not exists (select 1 from public.aura_materiais x where x.empresa = l.empresa and x.titulo = $k$Base Grupo MF (produto e loja)$k$)
  returning id, empresa
)
insert into public.aura_material_trechos (material_id, empresa, ordem, origem, texto, nucleo)
select n.id, n.empresa, t.ordem, t.origem, t.texto, t.nucleo
from novos n
join (values
(null::text, 1, $k$Base Grupo MF (produto e loja) — REGRAS DE PRODUTO E COMUNICAÇÃO$k$, $k$Valem em toda conversa e em toda mensagem sugerida ao vendedor (base do Grupo MF, confirmada pelo dono em 22/10/2026).

- Garantia: "até 5 anos, conforme o modelo". Estrutura 5 anos: Prime, Wide, Vision, Vitro, Altezza, Efficienza, MF 1200, MF 1400, Evo Fire. 2 anos: Adatto, Duo, Delicatta, Forza, Orbit, 360, Ottanta, MF 350, Fogo Pro, Fire Pro. 1 ano: MF 150 e MF 250. Mão de obra, vidro, vedação, pintura e refratários: 1 ano. Na dúvida, "conforme o certificado do modelo". NUNCA garantia vitalícia de lareira; a única vitalícia é o cabo do piso aquecido (controlador 2 anos).

- Tripla combustão: Adatto, Prime, Wide, Duo, Vision, Vitro, Altezza, Efficienza, Forza, Delicatta, MF 150/250/350. Dupla: Evo Fire, MF 1200, MF 1400, Fogo Pro, Fire Pro. Suspensas (360, Ottanta) e Orbit NÃO têm tripla.

- Calor para outros ambientes: só a lareira EMBUTIDA, com o projeto de condução de ar quente que a loja faz na instalação (grelhas e canalização do nicho; o aparelho não é ligado a dutos). EXPOSTAS e SUSPENSAS não fazem condução: a exposta aquece o ambiente onde está (o ventilador distribui melhor); 360 e Ottanta giram 360° e direcionam calor e vista do fogo; a Orbit é semi-suspensa e central.$k$, true),
(null::text, 2, $k$Base Grupo MF (produto e loja) — REGRAS DE PRODUTO E COMUNICAÇÃO$k$, $k$- Carga de lenha: muda por modelo (de 1 h na Orbit a 6 h na Prime, Wide e Evo Fire). Cite o número da ficha técnica do modelo, nunca um genérico.

- Economia sempre com "até": 3 a 5 m³ de lenha por inverno contra 10 a 16 m³ de lareira comum; até 80% menos lenha; até R$ 4.000 por temporada.

- Modelo certo: pela faixa de m³ (área x pé-direito) da ficha, com folga. Mais vendida: Adatto 90 exposta.

Nunca: falar mal da concorrência; passar ao cliente condições internas (PIX 3%, boleto 35% + 10x, venda programada, descontos de gerência); sugerir instalação junto a madeira/MDF, gesso comum ou TV sem cornija; destacar Kratki (só saldo) ou dar preço de Seccare (consultar a loja); dizer "da China".

WhatsApp: mensagens curtas, sem abreviação, terminando com pergunta ou próximo passo; valor antes do preço; "tu" gaúcho ("tu quer", "te mando"), nunca "queres/tens"; nada de "Fico no aguardo" ou "Qualquer coisa te chamo" sem pergunta junto.$k$, true),
(null::text, 3, $k$Base Grupo MF (produto e loja) — Argumentos e prova social$k$, $k$Tempo de mercado: MF e LF "desde 1977" (49 anos em 2026); A&G "desde 2016". Prova social liberada: zero reclamações no Reclame Aqui; mais de 1.500 lareiras a pronta entrega; clientes Murilo Rosa e Alejandro Claveaux; instalações em Gramado, Torres, Xangri-Lá, Porto Alegre, Bento Gonçalves, SP e RJ. Diferencial central da MF: pioneira na tripla combustão, engenharia canadense, vermiculita importada. Compare com a concorrência por tecnologia, materiais, consumo e garantia, sem falar mal.$k$, false),
($k$LF Lareiras$k$, 4, $k$Base Grupo MF (produto e loja) — IDENTIDADE DA LOJA — LF Lareiras$k$, $k$Loja e showroom junto à fábrica MF, desde 1977 (49 anos), com instalação própria e entrega para todo o Brasil.
Endereço: ERS-122, km 8, nº 8250, Conceição, São Sebastião do Caí/RS.
Contato: (51) 3536-1701 (fixo e WhatsApp) · comercial@lflareiras.com.br · lflareiras.com.br · Instagram @lflareiras.
Horário (verão): segunda a sexta 08:00–11:45 e 13:30–18:00; sábado 09:00–12:00.
Tom: caloroso, tradição, consultivo. Bordão: "Conforto não é luxo. É qualidade de vida."
Vende lareiras MF (marca do produto: "Lareiras MF"), pellet, fogões, linha gourmet, piso aquecido e marcas parceiras.$k$, true),
($k$A&G Aquecimento$k$, 4, $k$Base Grupo MF (produto e loja) — IDENTIDADE DA LOJA — A&G Aquecimento$k$, $k$Loja de aquecimento desde 2016, com equipe de instalação própria e duas lojas em Garibaldi/RS.
Endereços: Av. Rio Branco, 495, Centro; e Av. Garibaldina, 1441, loja 05 (Boulevard Convention, loja conceito).
Contato: WhatsApp (54) 99327-2098 · fixo (54) 3462-5843 · aegaquecimento.com.br · Instagram @aegaquecimento.
Tom: sofisticado, minimalista. Bordão: "Onde a excelência e o calor se unem."
Vende lareiras MF (marca do produto: "Lareiras MF"), pellet (Foco), fogões, linha gourmet, piso aquecido, toalheiros e marcas parceiras.$k$, true),
($k$Sole Aquecimento$k$, 4, $k$Base Grupo MF (produto e loja) — IDENTIDADE DA LOJA — Sole Ferro e Fogo$k$, $k$Loja de alto padrão em Bento Gonçalves/RS (nasceu como Sole Aquecimento Solar).
Endereço: R. Fiorelo Bertuol, 739, Progresso, Bento Gonçalves/RS.
Contato: WhatsApp (54) 99180-5838 · (54) 3452-0333 · contato.soleaquecimento@gmail.com · Instagram @soleferroefogo.
Horário: segunda a sexta 08:00–11:30 e 13:30–18:00; sábado 08:00–11:30.
Tom: aconchego e design, "aquecer é criar experiências". Bordão: "Calor · Design · Tradição."
Vende lareiras a lenha e pellet, fogões, churrasqueiras, aquecimento solar, piscina, piso aquecido e toalheiros.$k$, true),
($k$MF International$k$, 4, $k$Base Grupo MF (produto e loja) — IDENTIDADE DA LOJA — MF International$k$, $k$Fábrica de lareiras de alto rendimento desde 1977, pioneira na tripla combustão no Brasil, engenharia canadense. Também fabrica fornos, braseiros e tubulações prediais (chaminés para construtoras: rígido, helicoidal e flexível, 80 a 1500 mm).
Endereço: ERS-122, km 08, Conceição, São Sebastião do Caí/RS.
Contato: WhatsApp (51) 3536-1422 · mfinternational.com.br · Instagram @mfinternational.
Tom: técnico-premium, engenharia, tradição. Bordões: "Pioneiros na tripla combustão" · "Engenharia canadense".
Atende revendas, arquitetos e construtoras: blocos 3D (SKP/3DS), MF Preview (realidade aumentada) e orientação técnica gratuita no projeto.$k$, true)
) t(empresa, ordem, origem, texto, nucleo) on t.empresa is null or t.empresa = n.empresa;

-- Ficha técnica das lareiras MF 2025 (texto do material remontado dos trechos: cada seção é um trecho)
with lojas(empresa) as (values ($k$LF Lareiras$k$), ($k$A&G Aquecimento$k$), ($k$Sole Aquecimento$k$), ($k$MF International$k$)),
t(ordem, origem, texto) as (values
(1, $k$Ficha técnica MF 2025$k$, $k$Fonte: Catálogo MF 2025 e manuais 2025. Escolha o modelo pela faixa de m³ (área x pé-direito), com folga. Garantia: ver as regras (selo do catálogo = anos de garantia da estrutura; confirmar no certificado).$k$),
(2, $k$EvoFire Pro$k$, $k$Tipo: embutida. dupla combustão. Potência 35 kW. Aquece 80–350 m² / 208–910 m³. Medidas (AxLxP): 150x141x62 (D 63). Vidro (vitrine): 46x102. Lenha até 90 cm. Peso 340 kg. Carga de lenha dura até 6 h. Cano ø18 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Versão automatizada (abre porta por Alexa, controle remoto, app) e manual; porta guilhotina; vidro 102 cm; ventiladores; vermiculita importada; câmara 0,26 m³.$k$),
(3, $k$Vision$k$, $k$Tipo: embutida. tripla combustão. Potência 16 kW. Aquece 55–160 m² / 143–416 m³. Medidas (AxLxP): 75x63x41 (D 56). Vidro (vitrine): frontal 32x62, lateral 32x19. Lenha até 40 cm. Peso 87 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: 3 faces envidraçadas, visão panorâmica; motores italianos.$k$),
(4, $k$Vitro$k$, $k$Tipo: embutida. tripla combustão. Potência 20 kW. Aquece 65–200 m² / 169–520 m³. Medidas (AxLxP): 79x74x48 (D 64). Vidro (vitrine): 36x67. Lenha até 55 cm. Peso 129 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Vidro frontal + lateral (direito ou esquerdo).$k$),
(5, $k$Prime Duo (embutida)$k$, $k$Tipo: embutida. tripla combustão. Potência 30 kW. Aquece 80–300 m² / 208–780 m³. Medidas (AxLxP): 55x100x49; com moldura 75x120x49. Vidro (vitrine): 29x84. Lenha até 70 cm. Peso 141 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Duas portas independentes (2 ambientes); vidro serigrafado; inox ou preto.$k$),
(6, $k$Wide Duo (embutida)$k$, $k$Tipo: embutida. tripla combustão. Potência 30 kW. Aquece 80–300 m² / 208–780 m³. Medidas (AxLxP): 55x100x49; com moldura 75x120x49. Vidro (vitrine): 32x84. Lenha até 70 cm. Peso 141 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Portas independentes; puxador escondido.$k$),
(7, $k$Duo / Duo Pro (E/D/4 lados)$k$, $k$Tipo: embutida. tripla combustão. Potência 18 kW. Aquece 65–180 m² / 169–468 m³. Medidas (AxLxP): 48x90x43; com moldura 68x110x43. Vidro (vitrine): 26x72. Lenha até 65 cm. Peso 111 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Dupla face; versão com ventilador.$k$),
(8, $k$Prime 100$k$, $k$Tipo: embutida. tripla combustão. Potência 25 kW. Aquece 80–250 m² / 208–650 m³. Medidas (AxLxP): 55x100x47; com moldura 65x120x47. Vidro (vitrine): 29x84. Lenha até 80 cm. Peso 152 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Inox ou preto; vidro serigrafado.$k$),
(9, $k$Prime 80$k$, $k$Tipo: embutida. tripla combustão. Potência 20 kW. Aquece 65–200 m² / 169–520 m³. Medidas (AxLxP): 55x80x47; com moldura 65x100x47. Vidro (vitrine): 29x64. Lenha até 60 cm. Peso 140 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Três entradas de ar.$k$),
(10, $k$Wide 120$k$, $k$Tipo: embutida. tripla combustão. Potência 25 kW. Aquece 80–250 m² / 208–650 m³. Medidas (AxLxP): 55x100x47; com moldura 75x120x47. Vidro (vitrine): 32x84. Lenha até 80 cm. Peso 154 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Projetos de grandes dimensões.$k$),
(11, $k$Altezza (embutida)$k$, $k$Tipo: embutida. tripla combustão. Potência 20 kW. Aquece 65–200 m² / 169–520 m³. Medidas (AxLxP): 75x55x50; com moldura 95x75x51. Vidro (vitrine): 45x39 (vertical). Lenha até 37 cm. Peso 112 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Visão vertical; puxador oculto.$k$),
(12, $k$Adatto 110 (Pro/E/D)$k$, $k$Tipo: embutida. tripla combustão. Potência 22 kW. Aquece 65–220 m² / 169–572 m³. Medidas (AxLxP): 48x110x45; com moldura 68x130x45. Vidro (vitrine): 25x92. Lenha até 85 cm. Peso 140 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Linha mais vendida; versão com ventilador.$k$),
(13, $k$Adatto 90 (Pro/E/D)$k$, $k$Tipo: embutida. tripla combustão. Potência 18 kW. Aquece 65–180 m² / 169–468 m³. Medidas (AxLxP): 48x90x45; com moldura 68x110x45. Vidro (vitrine): 25x72. Lenha até 65 cm. Peso 125 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s).$k$),
(14, $k$Adatto 70 (Pro/E/D)$k$, $k$Tipo: embutida. tripla combustão. Potência 14 kW. Aquece 45–140 m² / 117–364 m³. Medidas (AxLxP): 48x70x45; com moldura 68x90x45. Vidro (vitrine): 25x52. Lenha até 45 cm. Peso 93 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Vidro autolimpante; compacta.$k$),
(15, $k$Adatto 55 (Pro/E/D)$k$, $k$Tipo: embutida. tripla combustão. Potência 12 kW. Aquece 35–120 m² / 91–312 m³. Medidas (AxLxP): 48x55x45; com moldura 68x75x45. Vidro (vitrine): 25x37. Lenha até 30 cm. Peso 82 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Minimalista.$k$),
(16, $k$MF 1400 (embutida)$k$, $k$Tipo: embutida. dupla combustão. Potência 22 kW. Aquece 70–185 m² / 182–481 m³. Medidas (AxLxP): 57x70x42; com moldura 65x96x45. Vidro (vitrine): 23x46. Lenha até 55 cm. Peso 145 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Chapas 6,35 e 4,75 mm; porta ferro fundido; ventilador.$k$),
(17, $k$MF 1200 (embutida)$k$, $k$Tipo: embutida. dupla combustão. Potência 14,7 kW. Aquece 45–140 m² / 117–364 m³. Medidas (AxLxP): 57x59x42; com moldura 65x84x45. Vidro (vitrine): 35x21. Lenha até 45 cm. Peso 117 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Porta aço carbono reforçada.$k$),
(18, $k$MF 360 (suspensa)$k$, $k$Tipo: exposta/suspensa. combustão simples (sem tripla). Potência 8 kW. Aquece 25–80 m² / 65–208 m³. Medidas (AxLxP): 58 x ø100. Vidro (vitrine): 18x94. Lenha até 50 cm. Peso 62 kg. Carga de lenha dura até 2 h. Cano ø20 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Gira 360°; peça escultural.$k$),
(19, $k$MF Orbit (semi-suspensa) — lançamento$k$, $k$Tipo: exposta/suspensa. combustão simples (sem tripla). Potência 5 kW. Aquece 25–50 m² / 65–130 m³. Medidas (AxLxP): 80x50x40 (D 100). Vidro (vitrine): 40x100. Lenha até 45 cm. Peso 155 kg. Carga de lenha dura até 1 h. Cano ø20 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Base sólida + coifa suspensa; tijolos refratários.$k$),
(20, $k$MF Ottanta (suspensa)$k$, $k$Tipo: exposta/suspensa. combustão simples (sem tripla). Potência 8 kW. Aquece 25–80 m² / 65–208 m³. Medidas (AxLxP): 58 x 80. Vidro (vitrine): 23x67. Lenha até 40 cm. Peso 61 kg. Carga de lenha dura até 2 h. Cano ø20 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: 80 cm; giratória 360°.$k$),
(21, $k$Prime Duo (exposta)$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 30 kW. Aquece 80–300 m² / 208–780 m³. Medidas (AxLxP): 92x100x49. Vidro (vitrine): 29x84. Lenha até 70 cm. Peso 141 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Duas portas.$k$),
(22, $k$Wide Duo (exposta)$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 30 kW. Aquece 80–300 m² / 208–780 m³. Medidas (AxLxP): 92x100x49. Vidro (vitrine): 32x84. Lenha até 70 cm. Peso 141 kg. Carga de lenha dura até 6 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s).$k$),
(23, $k$Duo / Duo Pro (2, 3 ou 4 portas)$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 18 kW. Aquece 65–180 m² / 169–468 m³. Medidas (AxLxP): 83x90x43. Vidro (vitrine): 26x72. Lenha até 65 cm. Peso 111 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Instalação central; modular.$k$),
(24, $k$Efficienza$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 20 kW. Aquece 65–200 m² / 169–520 m³. Medidas (AxLxP): 105x65x54. Vidro (vitrine): 49x40. Lenha até 30 cm. Peso 144 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: 2 ventiladores italianos; pedestal p/ lenha; ambientes amplos/comerciais.$k$),
(25, $k$MF 1400 (exposta)$k$, $k$Tipo: exposta/suspensa. dupla combustão. Potência 22 kW. Aquece 70–185 m² / 182–481 m³. Medidas (AxLxP): 74x71x50. Vidro (vitrine): 23x46. Lenha até 50 cm. Peso 146 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Porta ferro fundido; design europeu.$k$),
(26, $k$MF 1200 (exposta)$k$, $k$Tipo: exposta/suspensa. dupla combustão. Potência 14,6 kW. Aquece 45–140 m² / 117–364 m³. Medidas (AxLxP): 74x57x47. Vidro (vitrine): 35x21. Lenha até 40 cm. Peso 121 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 5 ano(s). Destaques: Base para lenha.$k$),
(27, $k$Forza Dicanto$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 18 kW. Aquece 45–180 m² / 117–468 m³. Medidas (AxLxP): 80x67x59. Vidro (vitrine): 29x47. Lenha até 40 cm. Peso 105 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: De canto; pedestal.$k$),
(28, $k$Adatto 110 exposta$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 22 kW. Aquece 65–220 m² / 169–572 m³. Medidas (AxLxP): 83x110x45. Vidro (vitrine): 25x92. Lenha até 85 cm. Peso 140 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Visão de fogo ampla.$k$),
(29, $k$Adatto 90 exposta$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 18 kW. Aquece 65–180 m² / 169–468 m³. Medidas (AxLxP): 83x90x45. Vidro (vitrine): 25x72. Lenha até 65 cm. Peso 125 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: MODELO MAIS VENDIDO; melhor custo-benefício.$k$),
(30, $k$Adatto 70 exposta$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 14 kW. Aquece 45–140 m² / 117–364 m³. Medidas (AxLxP): 83x70x45. Vidro (vitrine): 25x52. Lenha até 45 cm. Peso 93 kg. Carga de lenha dura até 4 h. Cano ø18 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Pedestal opcional; vidro autolimpante.$k$),
(31, $k$Adatto 55 exposta$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 12 kW. Aquece 35–120 m² / 91–312 m³. Medidas (AxLxP): 83x55x45. Vidro (vitrine): 25x37. Lenha até 30 cm. Peso 82 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Compacta; pedestal opcional.$k$),
(32, $k$MF 350$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 12 kW. Aquece 35–120 m² / 91–312 m³. Medidas (AxLxP): 71x38x55. Vidro (vitrine): 20x22. Lenha até 30 cm. Peso 73 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Gaveta de cinzas.$k$),
(33, $k$Fogo Pro$k$, $k$Tipo: exposta/suspensa. dupla combustão. Potência 14 kW. Aquece 50–140 m² / 130–364 m³. Medidas (AxLxP): 83x46x60. Vidro (vitrine): 24x27. Lenha até 40 cm. Peso 81 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Espaço p/ lenha.$k$),
(34, $k$Fire Pro$k$, $k$Tipo: exposta/suspensa. dupla combustão. Potência 10 kW. Aquece 30–100 m² / 78–260 m³. Medidas (AxLxP): 65x47x54. Vidro (vitrine): 24x27. Lenha até 34 cm. Peso 70 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Compacta.$k$),
(35, $k$Delicatta Dicanto$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 13 kW. Aquece 35–130 m² / 91–338 m³. Medidas (AxLxP): 70x50x46. Vidro (vitrine): 25x31. Lenha até 32 cm. Peso 49 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Triangular, de canto.$k$),
(36, $k$Delicatta$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 8 kW. Aquece 25–80 m² / 65–208 m³. Medidas (AxLxP): 66x39x50. Vidro (vitrine): 24x20. Lenha até 30 cm. Peso 47 kg. Carga de lenha dura até 4 h. Cano ø15 cm. Selo de garantia do catálogo: 2 ano(s). Destaques: Compacta.$k$),
(37, $k$MF 250$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 6 kW. Aquece 25–60 m² / 65–156 m³. Medidas (AxLxP): 62x39x44. Vidro (vitrine): 19x18. Lenha até 25 cm. Peso 37 kg. Carga de lenha dura até 3 h. Cano ø10 cm. Selo de garantia do catálogo: 1 ano(s). Destaques: Simples.$k$),
(38, $k$MF 150$k$, $k$Tipo: exposta/suspensa. tripla combustão. Potência 5 kW. Aquece 35–50 m² / 91–130 m³. Medidas (AxLxP): 60x32x47. Vidro (vitrine): —. Lenha até 30 cm. Peso 37 kg. Carga de lenha dura até 3 h. Cano ø15 cm. Selo de garantia do catálogo: 1 ano(s). Destaques: Menor e mais acessível.$k$),
(39, $k$Linha gourmet e jardim MF$k$, $k$- Forno de Pizza a lenha P: 33x56x55 cm; G: 37x62x75 cm. Pizza em 3–5 min; pedra refratária; estrutura interna e tampa inox 304; termômetro; queimador aço carbono; cores vermelho, azul, branco, preto, cinza. Cano ø10 (P) / ø15 (G).
- Braseiros (Linha Jardim): Quadfire 28x53x78 cm; Octafire 33x58x58 cm; Hexafire 29x51x51 cm; Spiral Fire; Firebox 64x51x51 cm (braseiro + kit ecológico).
- Kits parrilla tubular: 55x60, 70x60, 90x60, 120x60 cm. Grelhas em aço ou inox, removíveis.$k$),
(40, $k$Variações da Adatto$k$, $k$Adatto "Pro" = 3 faces (3 lados de vidro); "E" / "D" = vidro lateral esquerdo / direito. Linha mais vendida; Adatto 90 exposta é a de melhor custo-benefício.$k$),
(41, $k$Suspensas e semi-suspensa$k$, $k$MF 360 e MF Ottanta são suspensas e giram 360°: o cliente direciona o calor e a vista do fogo para outros ambientes. Não têm tripla combustão. MF Orbit é semi-suspensa: base fixa no piso e sistema superior tipo coifa, lareira central de fogo à vista.$k$)),
m(texto) as (select $k$# Ficha técnica MF 2025$k$ || E'\n\n' || string_agg(case when ordem = 1 then texto else '## ' || origem || E'\n' || texto end, E'\n\n' order by ordem) from t),
novos as (
  insert into public.aura_materiais (empresa, titulo, descricao, arquivo_nome, tipo, bytes, texto, ativo, criado_por)
  select l.empresa, $k$Ficha técnica das lareiras MF 2025$k$, $k$Potência, área/volume, medidas, lenha, autonomia de queima, cano e selo de garantia de cada modelo MF.$k$, 'base-grupo-mf.md', 'text/markdown', octet_length(m.texto), m.texto, true, 'a12e4445-d296-44d7-8c8e-b9fc09dfdf0a'
  from m cross join lojas l
  where not exists (select 1 from public.aura_materiais x where x.empresa = l.empresa and x.titulo = $k$Ficha técnica das lareiras MF 2025$k$)
  returning id, empresa
)
insert into public.aura_material_trechos (material_id, empresa, ordem, origem, texto, nucleo)
select n.id, n.empresa, t.ordem, $k$Ficha técnica das lareiras MF 2025 — $k$ || t.origem, t.texto, false
from novos n cross join t;

-- Instalação, uso, limpeza e garantia MF
-- Os trechos são recortes do próprio texto do material (início, tamanho em
-- caracteres); só o trecho que junta seções curtas vai por extenso.
with lojas(empresa) as (values ($k$LF Lareiras$k$), ($k$A&G Aquecimento$k$), ($k$Sole Aquecimento$k$), ($k$MF International$k$)),
m(texto) as (values ($k$# Instalação, uso, limpeza e garantia MF

## 1. Procedimento de instalação (documento interno, 2026)

**Quem faz:** a equipe técnica própria do grupo, chamada no documento de "Uso interno – Equipe técnica LF | AEG | MF". As mesmas regras valem para lareiras, churrasqueiras e sistemas de chaminé. Os manuais também exigem que a instalação seja feita por "técnico autorizado e qualificado". Sem isso, a garantia não cobre problemas de instalação.

**Prazos:** o documento **não informa** prazo de entrega, nem duração da instalação ou do agendamento.

**Pré-requisitos da obra (vindos do procedimento, das boas práticas e dos manuais):**
- Projeto técnico aprovado, com as medidas conferidas.
- Acesso ao telhado. Antes, é preciso mapear o que pode atrapalhar: placas solares, antenas, calhas e estruturas metálicas.
- Laje, vigas e tubulações hidráulicas e elétricas verificadas antes de qualquer furo.
- Para embutidas: nicho de **alvenaria ou gesso rosa antichamas**, nunca de material combustível. O nicho precisa ter folga de **5 a 7 cm** em volta da lareira para a manta e para o técnico trabalhar. Também precisa de **ponto de luz** quando o modelo tem ventilador.
- A fiação de TV não pode passar dentro do nicho. Ela deve ir em eletroduto de alta temperatura, embutida na parede e protegida por manta cerâmica.
- Nicho novo deve ter **grelhas superiores e inferiores** obrigatórias para o ar quente sair.

**As 7 etapas:**
1. **Chegada e preparação:** a equipe se apresenta, confirma o local com o cliente conforme o projeto e avalia o caminho dos materiais. Depois isola a área e protege pisos e móveis (com cuidado redobrado em conversões), verifica o telhado e usa EPIs. *Nenhuma atividade começa sem proteção do ambiente e EPI.*
2. **Validação técnica (antes de qualquer furo):** revisar o projeto, validar a posição final, achar o ponto central da chaminé, marcar o furo-guia e verificar a estrutura. *Nunca furar sem validação estrutural.*
3. **Execução interna:** abrir forro, gesso ou laje e montar a tubulação interna. Todos os canos vão **invertidos**, para a fuligem não voltar. Instalar arandela ou chapa de bloqueio quando o modelo pedir. Aplicar **manta cerâmica em forros sensíveis** (PVC, madeira). Fixar os tubos sem folga e isolar totalmente a lareira e a tubulação nas embutidas. Por fim, ligar o ventilador ao ponto elétrico.
4. **Execução externa (telhado):** abrir a cobertura de acordo com o tipo de telha e fazer algeroz se necessário. Ligar a tubulação dupla ao para-chuva e instalar o **terminal canhão**. Pintar a tubulação externa quando preciso, vedar com silicone e reposicionar as telhas. *Toda saída externa deve ficar vedada.*
5. **Finalização:** conferir o material e registrar extras ou itens personalizados. Fazer limpeza completa, recolher os resíduos e conferir as ferramentas.
6. **Entrega ao cliente:** explicar o funcionamento, o primeiro uso, a regulagem de oxigênio e a **cura da tinta**.
7. **Pós-instalação:** tirar fotos e mandar ao marketing, reportar o status e as pendências e se despedir.

Há um checklist destacável com assinatura do técnico e do cliente. O **checkpoint final obrigatório** confirma: padrão técnico, tubulação vedada, vedação externa validada, funcionamento testado e explicado, ambiente limpo e cliente ciente do uso correto.

---

## 2. Boas práticas – lareiras EMBUTIDAS

- **Chaminé de inox até o topo.** NUNCA colocar só alguns metros de cano dentro de uma chaminé de alvenaria; a tubulação da lareira segue até o cume.
- **Chapa de bloqueio OBRIGATÓRIA** logo acima da lareira, ou logo após as grelhas. Ela deve ser fixada e siliconada em todas as laterais e em volta do tubo, sem frestas.
  - Para que serve: evita perda de calor e entrada de ar frio pela chaminé.
  - Como se instala (manual): pregar a chapa nas juntas da argamassa, vedar com silicone de alta temperatura e lacrar o espaço entre o tubo e a chapa com cimento para fornos.
  - Erro típico: colocar a chapa 2 m acima da lareira. Isso cria um bolsão de ar.
- **Manta cerâmica ou lã de rocha OBRIGATÓRIA** em volta da lareira, porque os tijolos absorvem muito calor.
- **Nunca tapar a entrada de oxigênio** que fica atrás do equipamento.
- **Eletrônicos (TV) acima da lareira:** fazer uma prateleira ou desvio de material não combustível que desvie o ar quente.
- Nicho e acabamento nunca de material combustível: nada de MDF, madeira, papel de parede ou fiação.
- **Afastamento mínimo de 30 cm** para materiais combustíveis próximos ou na frente do equipamento.
- **Cornija combustível** (Adatto/Prime): profundidade máxima de 305 mm e distância mínima de **343 mm** do topo do equipamento.
- **Prime:** distância mínima de **100 cm** do topo da lareira ao teto. Só pode haver material não combustível embaixo da lareira. O piso de alvenaria da lareira deve ficar pelo menos 203 mm acima do piso combustível; se ficar abaixo disso, o protetor precisa de RSI ≥ 0,35.
- **Abertura mínima na alvenaria (Prime):**

| Modelo | J | K | L | Proteção do piso à frente |
|---|---|---|---|---|
| Prime 100 | 610 mm | 1100 mm | 545 mm | 980 mm |
| Prime 80 | 610 mm | 900 mm | 545 mm | 780 mm |

- **Espaços livres a combustíveis (Adatto, duto em uma parede):**
  - Valores comuns a todos: A, B e C = 406 mm; D = 509 mm; K = 1.220 mm; L = 213 cm.
  - E e F variam: Adatto 55 = 605/650 mm; Adatto 70 = 665/690 mm; Adatto 90 = 765/760 mm; Adatto 110 = 865/835 mm.
  - Protetor de piso à frente da porta: 480 mm (55), 630 mm (70), 830 mm (90) e 1030 mm (110). Laterais e traseira: 203 mm.
  - O manual ressalva que os espaçamentos variam conforme o material do nicho. Confirmar com o fabricante do gesso antichamas, da manta ou da pedra.

## 3. Boas práticas – lareiras EXPOSTAS

- **Proteção do piso** quando o piso for combustível.
  - Material: aço com no mínimo 0,38 mm ou lajota cerâmica rejuntada.
  - Não é necessária sobre concreto.
- **Afastamento mínimo de 30 cm** de materiais combustíveis.
- No teto, usar acabamento tipo **"caixinha" com manta cerâmica** em volta do cano, para afastá-lo e isolá-lo de forro e madeira.
- **360° e Ottanta** (versão rotativa): proteção de piso de **40 cm (16") em todos os lados**. Ambas são suspensas: o suporte vai na laje e o tubo é fixado com 12 parafusos do kit. **Trocar os parafusos a cada 3 anos.**
- **Delicata**
  - Espaços livres: A, B e C = 406 mm; D = 450 mm; E = 508 mm; F = 525 mm.
  - Delicata di Canto: D = 440 mm; E = 560 mm; F = 465 mm.
  - Protetor de piso: 320 mm na frente da porta e 203 mm nos demais lados.
- **MF 1400:** espaços livres A, B e C = 406 mm; D = 483 mm; E = 686 mm; F = 717 mm. Protetor de piso de 457 mm na frente.

## 4. Chaminé (vale para embutidas e expostas)

- **Exaustão vertical** é a ideal, porque melhora a tiragem e a saída de fumaça.
  - Se não der para ser reta, **evitar curvas de 90° e usar curvas de 45°**. O modelo recomendado usa 2 curvas de 45°.
  - Os manuais da 360° e da Ottanta avisam que *curvas de 45° ou 90° podem causar retorno de fumaça*.
  - Muitas curvas acumulam sujeira e aumentam o risco de "fogo de chaminé".
- **Tubulação:** inox **simples por dentro** e inox **dupla por fora**.
- **Altura:** a chaminé precisa **passar do cume do telhado** ou ficar a **3 m de qualquer ponto alto próximo**. Nas ilustrações, a direção do vento aparece como critério de "recomendável" ou "não recomendável".
- **Terminal:** chapéu com tela ou terminal canhão, que pode ser adaptado à alvenaria. Deixar sempre **acesso para limpeza interna e externa**.
- **Diâmetro (manter igual até o topo):**

| Modelo | Diâmetro do duto | Observações |
|---|---|---|
| Adatto 55 | 150 mm | No item "chaminés adequadas", o manual pede 180 mm para a linha Adatto |
| Adatto 70, 90 e 110 | 180 mm | Mínimo de 125 mm só com aval de profissional. Abaixo de 180 mm, só se a chaminé de alvenaria passar de 6 m (ou for reta e passar de 7,6 m) |
| Prime 80 e 100 | 150 mm | Recomenda revestimento rígido ou flexível de inox 150 mm na alvenaria, mais 305 mm de revestimento rígido acima do topo até o para-chuva |
| Delicata | 150 mm | Tiragem mínima de 10 Pa |
| MF 1400 | 150 mm | Aceita de 125 a 180 mm com aval profissional. Tiragem de 10 Pa |
| 360° e Ottanta | 200/203 mm | Tiragem mínima de 20 Pa |

- **Chaminé de alvenaria:** precisa de revestimento de argila ou inox. Se a seção for maior que a do duto redondo, colocar revestimento de inox no diâmetro do modelo. Se atravessar parede combustível, usar **virola de isolamento**.
- **Não conectar** a lareira a uma chaminé que já atende outro aparelho.
- **Limpeza da chaminé:** no mínimo **uma vez por ano**. No começo do uso, verificar o creosoto todo mês. Inspecionar sempre antes de voltar a usar depois de um longo período parada.

## 5. Entrada de ar e ventilação

- O ar de combustão ideal vem do próprio cômodo, que já está pré-aquecido. Casas novas costumam ter vazamento natural suficiente.
- O problema aparece quando um exaustor forte (coifa) cria pressão negativa dentro da casa.
- **Entrada de ar externa:** o vento pode afetar o funcionamento. Se houver fumaça com vento forte, desconectar o duto externo. Verificar fuligem nele uma vez por ano.
- **Embutidas:** não tapar a entrada de oxigênio de trás. O nicho deve ter **grelhas superiores e inferiores** para o ar quente sair.
- **Calor para outros ambientes / ventilador**
  - Lareira EMBUTIDA: pode levar calor para outros ambientes com o projeto de condução de ar quente feito pela loja (grelhas e canalização do nicho, dimensionadas pela equipe técnica). O aparelho em si não é ligado a sistema de distribuição de ar: Adatto e MF 1400 dizem *"NÃO CONECTE ESTA LAREIRA A DUTOS OU SISTEMAS DE DISTRIBUIÇÃO DE AR."*
  - Lareira EXPOSTA e SUSPENSA: não fazem condução. A exposta aquece o ambiente onde está; a 360 e a Ottanta giram 360° para direcionar o calor.
  - Na lareira, a distribuição de calor no ambiente é feita pelo **ventilador opcional**. Ele tem sensor térmico e liga e desliga sozinho, com interruptor. Funciona em 220 V com plugue de 3 pinos; para 110 V é preciso adaptador.
  - O cabo do ventilador não pode encostar na lareira nem passar por baixo dela.
  - A Prime tem "circuito de ar integrado para recuperação de calor (cárter externo ao corpo)".

## 6. Tripla combustão, explicada de forma simples

**Texto da peça de marketing:** *"Com uma terceira entrada de ar, a TRIPLA COMBUSTÃO gera uma redução máxima da emissão de gases tóxicos com um grande aumento no desempenho durante a queima!"* e *"uma queima mais eficiente da lenha e uma fumaça com muito menos emissão de monóxido de carbono e hidrocarbonetos"*.

Atenção: uma peça antiga colocava as SUSPENSAS na lista de tripla combustão. Está errado (confirmado pelo dono): 360, Ottanta e Orbit têm combustão simples. A lista certa está nas regras e na ficha técnica.

**Explicação detalhada, a partir dos manuais Adatto, Prime e Delicata:**

**Quais modelos têm:**
- **Tripla combustão:** Adatto, Prime, Wide, Duo, Vision, Vitro, Altezza, Efficienza, Forza, Delicatta, MF 150/250/350.
- **Dupla combustão:** Evo Fire, MF 1200, MF 1400, Fogo Pro, Fire Pro.
- **Combustão simples:** 360°, Ottanta (com registro/dumper) e Orbit.

**Como funciona.** Uma lareira comum queima a lenha e manda pela chaminé uma fumaça que ainda carrega gases e partículas não queimados. Os manuais dizem que *"a fumaça contém cerca de metade da energia do combustível"*. A tripla combustão aproveita essa energia em três fases:
1. **Combustão primária:** o ar entra por baixo, pela grelha e pelo cinzeiro (controle C1), e acende a lenha.
2. **Combustão secundária:** um ar pré-aquecido entra por cima e queima os gases que saem da lenha.
3. **Pós-combustão (terceira fase):** o registro de ar secundário é mantido aberto, e assim *"o carbono não queimado pode sofrer uma pós-combustão, aumentando o rendimento e garantindo a limpeza do vidro"*. A chapa guarda-fogo (templador) prende os gases na zona quente para que queimem por completo.

**Resultado para o cliente:**
- Mais calor com menos lenha e queima mais longa (a duração da carga muda por modelo: ver a ficha técnica).
- **Até 90% menos fumaça** que uma lareira convencional antiga.
- Vidro mais limpo e menos creosoto na chaminé.
- Condição: a lenha precisa ter **umidade de 15 a 20%**.

**Cuidados:**
- Deixar **5 a 10 cm de folga** entre a lenha e a chapa guarda-fogo, porque é por ali que entra o ar secundário. Nunca empilhar lenha acima dos tijolos refratários.
- **Não usar a Adatto sem o templador**, porque gera temperaturas perigosas e **anula a garantia**.

## 7. Piso aquecido elétrico (A&G Aquecimento / LF Lareiras)

**Como funciona**
- São cabos calefatores embutidos no contrapiso. O piso passa a irradiar calor (**irradiação térmica**).
- O calor é uniforme, sem corrente de ar e sem concentração em um ponto.

**Potência**
- **150 W/m²**, com espaçamento padronizado.
- Concorrentes costumam usar 120 W/m², 100 W/m² ou menos. O resultado é aquecimento insuficiente, mais tempo ligado e mais consumo. É um argumento de venda contra orçamentos mais baratos.

**Cabo**
- Liga de **cromo-níquel puro**, com dupla camada de isolamento.
- Grau de proteção **IP24 e IP68**, por isso pode ir em áreas molhadas (banheiro, perto do box).
- Cada cabo é **fabricado sob medida** para o ambiente, o que dispensa emendas na obra.
- Concorrentes usam cobre-níquel ou ferro-cromo-alumínio, que duram menos.

**Consumo**
- O cálculo térmico estima o consumo mensal em kWh e o custo, sempre em dois cenários de 30 dias:
  - contínuo: 24 h/dia;
  - moderado: 8 h/dia.
- A ideia é já prever o consumo no projeto, inclusive para dimensionar painel solar. Com fotovoltaico bem dimensionado, o custo de operação cai a zero.
- **Não há valores numéricos de consumo no documento.**

**Vantagens**
- Calor uniforme.
- Não gera corrente de ar, não levanta poeira e não queima oxigênio.
- Sem sensação de ar pesado.
- Silencioso e invisível.
- Sem manutenção.
- Valoriza o imóvel.

**Aplicações**
- Ambientes residenciais, inclusive banheiros e áreas molhadas.
- Pisos de porcelanato, cerâmica, laminado e vinílico.

**Controladores**
- **Analógico:** botão giratório, indicado para áreas molhadas.
- **Digital:** LCD touch com **Wi-Fi**, controlado pelo app **SmartLife**, com agenda de horários.
- Mostra a temperatura do ambiente, a desejada e a do cabo.
- **Digital instalado em área molhada perde a garantia do controlador.**
- Acima de cerca de **16 A** é obrigatório usar **contatora**.

**Garantia:** **cabos vitalícia** e **controladores 2 anos**.

**O que é da empresa:**
- Orçamento técnico.
- Dimensionamento elétrico.
- Memorial descritivo elétrico.
- Cálculo térmico.
- Instalação dos cabos com equipe própria.
- Acompanhamento da obra.
- Entrega da infraestrutura: conduíte e caixa do controlador.

**O que é da obra:**
- Instalar a infraestrutura fornecida.
- Deixar **circuito e disjuntor individuais por ambiente**.
- Fazer a proteção mecânica.
- Em ambientes com mais de 25 m², fechar as caixas 4x4 com tampa cega.

**Rebaixo e proteção mecânica**
- O conjunto de cabos e réguas tem **0,8 cm** de espessura.
- Proteção mecânica por tipo de piso:
  - porcelanato ou cerâmica: **~1 cm** (ou só até nivelar os cabos);
  - laminado ou vinílico: **2 a 3 cm**, com média de **2,5 cm**.
- Material da proteção: **traço 1:3** de cimento e areia, ou argamassa **ACIII**.
- O contrapiso típico tem cerca de 5 cm, por isso é preciso prever o rebaixo antes.
- O conduíte fica abaixo da regularização.
- Na espera do controlador vai um rebaixo extra para a emenda: arco de **30x30 cm com 5 a 6 mm** de profundidade.

**Impermeabilização**
- Membrana líquida (pintura): o cabo pode ir por baixo, com réguas pregadas.
- **Manta asfáltica ou sintética:** o cabo vai obrigatoriamente **por cima** da manta, com réguas coladas e sem pregar.

**Sequência após a venda:**
1. Entrega da infraestrutura e do memorial.
2. Rebaixo do contrapiso.
3. Vistoria dos pré-requisitos: rebaixo, circuitos, infraestrutura e impermeabilização.
4. Instalação dos cabos.
5. Proteção mecânica feita **imediatamente**.
6. Revestimentos prontos e rede energizada.
7. Instalação dos controladores e testes.

## 8. Uso correto (manuais)

### Primeira acendida e cura da tinta
- A tinta é importada, mas **precisa de cura**.
- Fazer **1 ou 2 fogos brandos** e depois fogos cada vez mais intensos, até o cheiro sumir.
- A cura solta uma fumaça **não tóxica, mas desagradável**, que pode disparar detector de fumaça. Fazer em dia ameno, com portas e janelas abertas.
- Depois da cura, fazer **fogos fortes com lenha seca** para aquecer a estrutura.
- Se a cura for malfeita, a tinta descasca e enferruja, e **a cobertura da garantia se perde**.
- **Retirar o adesivo do vidro** antes de acender (modelos com vidro).

### Acender e operar
- A meta é chegar rápido a um fogo bem quente, que solta menos fumaça e forma menos creosoto.
- Acender direto na base da câmara, sem grelha extra.
- **Controles de ar (Adatto/Prime):**
  - **C1 (ar primário):** todo aberto ao acender, depois reduzir. Deixá-lo totalmente aberto o tempo todo desgasta o equipamento.
  - **C2 (ar secundário):** sempre todo aberto ao queimar lenha, para a pós-combustão e o vidro limpo.
  - Na Delicata a numeração é invertida: C1 é o secundário (acima da porta) e C2 o primário (abaixo).
- Para abrir a porta com fogo aceso: abrir os controles de ar por alguns minutos, destravar e abrir devagar.
- **Dumper da 360° e da Ottanta:** 4 posições (vertical = aberto; 30°, 60° e 90°). Fechado, tampa 75% da seção. Deixar todo aberto ao acender e reduzir depois. Se sair fumaça, reabrir.

### Carregar lenha e manter o fogo
- Colocar pelo menos **3 toros** por carga.
- Queimar em ciclos: deixar a carga virar brasa e o ambiente esfriar um pouco antes da próxima.
- **Antes de recarregar:** tirar a cinza e juntar a brasa na frente (Adatto) ou no centro.
- **Comprimento dos toros:**
  - Adatto: 300/450/650/800 mm.
  - Prime: 600/800 mm.
  - Delicata: 300/320 mm.
  - 1400: 502 mm.
  - 360°: 500 mm.
  - Ottanta: 400 mm.
- **Fogo pequeno:** toros de **75 a 100 mm** de diâmetro, arrumados cruzados.
- **Fogo de alto calor:** toros maiores atrás. Na Adatto, a lenha vai no sentido frente-trás.
- **Superaquecimento:** se alguma parte ficar incandescente, reduzir o ar. Nunca carregar até encostar na chapa.
- **Incêndio na chaminé:** fechar todo o ar e chamar os bombeiros.

### Lenha
- **Recomendada:** lenha natural, seca e envelhecida, com 15 a 20% de umidade. Lenha úmida ou ruim suja o vidro e acumula creosoto (vídeo da MF: "Teste de lenha úmida x seca").
- **PROIBIDO:**
  - **briquete/lenha ecológica**, porque superaquece e danifica o equipamento;
  - **nó de pinho**, porque a resina entope a chaminé e causa fogo na chaminé;
  - madeira tratada, pintada ou com química;
  - compensado ou aglomerado;
  - resíduos de obra;
  - lixo;
  - carvão ou carvão vegetal;
  - papel colorido ou cartolina;
  - dormentes;
  - toros industrializados com cera;
  - líquidos inflamáveis para acender (gasolina, querosene, álcool etc.).
- Nunca guardar lenha dentro do pedestal, embaixo da gaveta de cinzas.

### Cinzas
- Retirar **a cada 2 ou 3 dias** de uso contínuo, de preferência pela manhã, com a lareira fria.
- Guardar em recipiente metálico fechado, fora de casa e longe de material combustível. A brasa pode ficar quente por dias.

## 9. Manutenção e limpeza

- **Vidro**
  - Uma poeira branca depois de cerca de 1 semana é normal; limpar com papel ou pano úmido **com a lareira fria**.
  - Manchas castanhas indicam lenha úmida ou fogo fraco. Usar produto próprio para vidro de lareira, **nunca abrasivo**.
  - Riscos marrons saindo da borda indicam que é hora de **trocar a vedação do vidro**.
  - Não bater a porta e não usar a lareira com o vidro quebrado.
  - O vidro é **cerâmico de 5 mm**.
- **Vedação da porta:** endurece em cerca de **1 ano**.
  - Teste: fechar a porta sobre uma tira de papel; se o papel deslizar, trocar.
  - Troca: silicone de alta temperatura (gota de 6 mm) e **24 h sem usar**.
- **Pintura:** limpar com pano úmido, sempre fria. Para retocar, lixar com lixa d'água fina e aplicar 2 camadas leves de tinta de alta temperatura em spray, a original.
  - A tinta interna sai com o fogo, e a **ferrugem interna é normal**. Lenha úmida ou ácida acelera a corrosão.
- **Tijolos refratários:** inspecionar todo ano e trocar os quebrados. Usar só **peças originais**.
- **Chaminé:** limpar no mínimo **1 vez por ano**. Recomenda-se contratar um profissional e usar haste de fibra de vidro com escova.
  - Na Adatto, retirar o templador para limpar e recolocá-lo depois.
- **360° e Ottanta:** trocar os parafusos de fixação do tubo **a cada 3 anos**.

## 10. Garantia (manuais 2025)

**Regras gerais (todos os modelos)**
- Intransferível, só para o comprador original.
- Uso residencial normal.
- Exige nota fiscal com data, modelo e número de série (placa na traseira).
- A instalação deve ser feita por técnico qualificado.
- Componentes marcados com * exigem fotos.
- Antes de enviar peça à fábrica, pedir um **Número de Autorização** ao revendedor.
- O fabricante escolhe entre reparar, substituir ou reembolsar pelo preço de atacado.

**O que ANULA ou NÃO cobre a garantia:**
- Instalação imprópria ou em desacordo com o manual.
- Imperícia, uso indevido ou negligência.
- Falta de manutenção.
- **Superaquecimento**, que inclui briquete e lenha em excesso.
- Acidente no transporte e quedas de energia.
- **Correntes de ar descendentes ou problemas de exaustão/chaminé.**
- Arranhões, corrosão, distorção ou descoloração.
- Peças não originais.
- **Qualquer modificação**, como **instalar serpentina**.
- **Cura da tinta malfeita**, que causa descascamento e corrosão.
- Usar a **Adatto sem o templador**.
- **Piso elétrico:** controlador digital instalado em área molhada.

**Prazos por modelo (peças / mão de obra):**

| Modelo (data mínima de compra) | Câmara de combustão (soldas) e galvanização | Corpo / aço da fornalha / acabamentos | Aço-carbono, prendedores do vidro, puxador | Ventiladores, sensores, fiação | Vidro (quebra térmica), tinta, vedações, tijolos, manta |
|---|---|---|---|---|---|
| **PRIME** (≥ 01/06/2021) | **5 anos** / 1 ano | 5 anos | 5 anos | 1 ano | 1 ano |
| **MF 1400** (≥ 01/10/2011) | **5 anos** / 1 ano | inox: 5 anos | 3 anos | 2 anos | 1 ano |
| **ADATTO** (≥ 17/05/2021) | **2 anos** / 1 ano | bordas, proteções, gaveta: 2 anos | 1 ano | 1 ano | 1 ano |
| **DELICATA** (≥ 25/02/2022) | **2 anos** / 1 ano | inox, bordas, pés: 2 anos | 1 ano | 1 ano | 1 ano |
| **360°** (≥ 15/04/2023) | **2 anos** / 1 ano | — | aço-carbono, grade, cinzeiro, registro, acabamentos: 1 ano | — | — |
| **OTTANTA** (≥ 01/07/2024) | **2 anos** / 1 ano | — | idem 360°: 1 ano | — | — |
| **Piso elétrico** | cabos: **vitalícia** | — | — | controladores: **2 anos** | — |

**Esquema 5/2/1, confirmado:**
- **5 anos** na estrutura: Prime e MF 1400.
- **2 anos** na estrutura: Adatto, Delicata, 360° e Ottanta.
- **1 ano** de mão de obra para todos.
- **1 ano** para vidro, tinta, vedações, refratários e componentes elétricos. Exceção: na 1400, componentes elétricos têm 2 anos e aço-carbono 3 anos.

O texto padrão de todos os manuais fala em "garantia vitalícia" ("O limite de uma única substituição aplica-se a todas as peças beneficiadas por esta garantia vitalícia"), mas as tabelas trazem prazos finitos. Tratar como resíduo de tradução. **Não prometer garantia vitalícia de lareira.**

## 11. Erros comuns (citados nos documentos)

1. Tubo de inox curto dentro de chaminé de alvenaria, em vez de ir até o topo.
2. Chapa de bloqueio ausente ou alta demais (exemplo: 2 m), criando bolsão de ar.
3. Nicho sem manta ou lã: os tijolos absorvem o calor.
4. Nicho ou acabamento combustível (MDF, madeira, papel de parede) ou fiação de TV dentro do nicho.
5. Nicho novo sem grelhas de saída de ar quente, o que danifica o revestimento.
6. TV ou eletrônico acima da lareira sem prateleira defletora.
7. Tapar a entrada de oxigênio atrás do equipamento.
8. Curvas de 90°, excesso de curvas ou chaminé abaixo do cume, causando retorno de fumaça e entupimento.
9. Diâmetro da chaminé diferente do especificado.
10. Pular a cura da tinta ou começar já com fogo forte, causando descascamento e perda de garantia.
11. Usar briquete, nó de pinho, lenha úmida ou resíduos de obra.
12. Encher a fornalha até a chapa ou deixar o ar primário sempre aberto, causando superaquecimento.
13. Não limpar a chaminé anualmente, com risco de fogo na chaminé.
14. Limpar o vidro quente ou com abrasivo.
15. Usar a Adatto sem o templador.
16. Instalar serpentina ou modificar o equipamento.
17. Piso elétrico: não prever o rebaixo, usar potência baixa ou instalar controlador digital em área molhada.$k$)),
t(ordem, origem, inicio, tamanho, literal) as (values
(1, $k$1. Procedimento de instalação (documento interno, 2026)$k$, 103, 447, null::text),
(2, $k$1. Procedimento de instalação (documento interno, 2026)$k$, 552, 1189, null::text),
(3, $k$1. Procedimento de instalação (documento interno, 2026)$k$, 1742, 1198, null::text),
(4, $k$1. Procedimento de instalação (documento interno, 2026)$k$, 2941, 367, null::text),
(5, $k$2. Boas práticas – lareiras EMBUTIDAS$k$, 3352, 1158, null::text),
(6, $k$2. Boas práticas – lareiras EMBUTIDAS$k$, 4511, 1161, null::text),
(7, $k$3. Boas práticas – lareiras EXPOSTAS$k$, 5715, 918, null::text),
(8, $k$4. Chaminé (vale para embutidas e expostas)$k$, 6683, 847, null::text),
(9, $k$4. Chaminé (vale para embutidas e expostas)$k$, 7532, 1175, null::text),
(10, $k$5. Entrada de ar e ventilação$k$, 8743, 1058, null::text),
(11, $k$5. Entrada de ar e ventilação$k$, 9804, 403, null::text),
(12, $k$6. Tripla combustão, explicada de forma simples$k$, 10261, 879, null::text),
(13, $k$6. Tripla combustão, explicada de forma simples$k$, 11142, 1095, null::text),
(14, $k$6. Tripla combustão, explicada de forma simples$k$, 12239, 278, null::text),
(15, $k$7. Piso aquecido elétrico (A&G Aquecimento / LF Lareiras)$k$, 12581, 1143, null::text),
(16, $k$7. Piso aquecido elétrico (A&G Aquecimento / LF Lareiras)$k$, 13726, 1026, null::text),
(17, $k$7. Piso aquecido elétrico (A&G Aquecimento / LF Lareiras)$k$, 14754, 1027, null::text),
(18, $k$7. Piso aquecido elétrico (A&G Aquecimento / LF Lareiras)$k$, 15783, 342, null::text),
(19, $k$Primeira acendida e cura da tinta$k$, 16194, 536, null::text),
(20, $k$Acender e operar$k$, 16753, 814, null::text),
(21, $k$Carregar lenha e manter o fogo$k$, 17604, 749, null::text),
(22, $k$Lenha$k$, 18365, 717, null::text),
(23, $k$Cinzas$k$, 19095, 220, null::text),
(24, $k$9. Manutenção e limpeza$k$, 19345, 1162, null::text),
(25, $k$9. Manutenção e limpeza$k$, 20510, 146, null::text),
(26, $k$10. Garantia (manuais 2025)$k$, 20690, 1141, null::text),
(27, $k$10. Garantia (manuais 2025)$k$, 21833, 965, null::text),
(28, $k$10. Garantia (manuais 2025)$k$, 22800, 617, null::text),
(29, $k$11. Erros comuns (citados nos documentos)$k$, 23465, 1128, null::text),
(30, $k$11. Erros comuns (citados nos documentos)$k$, 24594, 109, null::text)),
novos as (
  insert into public.aura_materiais (empresa, titulo, descricao, arquivo_nome, tipo, bytes, texto, ativo, criado_por)
  select l.empresa, $k$Instalação, uso, limpeza e garantia MF$k$, $k$Instalação, chaminé, entrada de ar, tripla combustão explicada, piso aquecido, uso, limpeza, garantia e erros comuns.$k$, 'base-grupo-mf.md', 'text/markdown', octet_length(m.texto), m.texto, true, 'a12e4445-d296-44d7-8c8e-b9fc09dfdf0a'
  from m cross join lojas l
  where not exists (select 1 from public.aura_materiais x where x.empresa = l.empresa and x.titulo = $k$Instalação, uso, limpeza e garantia MF$k$)
  returning id, empresa
)
insert into public.aura_material_trechos (material_id, empresa, ordem, origem, texto, nucleo)
select n.id, n.empresa, t.ordem, $k$Instalação, uso, limpeza e garantia MF — $k$ || t.origem, coalesce(t.literal, substr(m.texto, t.inicio, t.tamanho)), false
from novos n cross join t cross join m;

-- Objeções, follow-up e scripts de WhatsApp
-- Os trechos são recortes do próprio texto do material (início, tamanho em
-- caracteres); só o trecho que junta seções curtas vai por extenso.
with lojas(empresa) as (values ($k$LF Lareiras$k$), ($k$A&G Aquecimento$k$), ($k$Sole Aquecimento$k$), ($k$MF International$k$)),
m(texto) as (values ($k$# Objeções, follow-up e scripts de WhatsApp

Fonte: Manual de Vendas LF/AEG 2026. Use com cliente final. Condições comerciais citadas aqui são internas.

## Script WhatsApp: lead quente, morno e frio
Objetivo: "responder rápido, gerar conexão, qualificar, passar valor antes do preço, avançar para visita/proposta e evitar perda por falta de condução."
**Quente** (já decidiu; veio da fábrica, do site, do Instagram ou da loja; quer agilidade):
- "Olá, tudo bem? Vi que você tem interesse na lareira MF. Sou da equipe técnica e posso te ajudar a escolher o modelo ideal para o seu ambiente. Você consegue me dizer onde ela será instalada?"
- "Ótimo falar com você! Já posso te ajudar com o modelo MF ideal — me conta o tamanho do ambiente e se vocês priorizam calor, estética ou economia?"
- "Olá! Para te indicar o modelo certo da MF, pode me dizer o tamanho do ambiente e o estilo que desejam?"
- Diagnóstico: fechado ou integrado? laje ou térreo? metragem? uso frequente ou fins de semana?
- Valor: "Perfeito, baseado no que você me descreveu, o modelo MF resolve bem porque entrega calor real com baixo consumo de lenha. Em média, nossos clientes usam entre 3 e 5 m³ por inverno — lareiras comuns chegam a gastar até 16 m³. Só nisso, você já tem uma economia de até R$ 4.000 por temporada."
- **Avanço obrigatório (uso interno):** visita técnica, proposta, modelos específicos, grupo com arquiteto ou retorno com data. Frases: "Para te orientar da forma certa, prefiro alinhar isso em uma visita técnica rápida. Pode ser?" · "Com essas informações, consigo te indicar o modelo exato — posso te enviar a proposta?" · "Posso te mandar 2 opções ideais para esse ambiente?" · "Faz sentido marcarmos uma conversa rápida para fechar isso com segurança?" ("o cliente não percebe como bloco").
- Investimento: "Te passo o valor certinho: esse modelo fica em torno de R$ ____, já com tecnologia de tripla combustão e estrutura reforçada."
- CTAs: "Posso preparar a proposta no seu nome?" · "Quer que eu reserve esse modelo para garantir o valor?" · "Agendamos uma visita técnica para dimensionar tudo e evitar retrabalho?"

**Morno** (curioso, sem urgência; precisa de conexão emocional e racional):
- "Oi, tudo bem? Vi que você está avaliando lareiras MF. Antes de te indicar um modelo, posso te perguntar o que vocês imaginam para esse ambiente?"
- Perguntas: algo presente ou discreto? calor, estética ou economia? casa principal ou de inverno?
- Autoridade: "A MF acaba sendo a escolha da maioria dos clientes que buscam eficiência e estética. Inclusive, Murilo Rosa e Alejandro Claveaux instalaram MF justamente por essa performance superior."
- Microcompromisso: "Fez sentido essa diferença de performance?" / "Esse estilo combina com o que vocês imaginam?"
- CTA suave: "Quer que eu te mande 2 ou 3 opções alinhadas ao seu projeto?" / "Posso te enviar fotos de ambientes parecidos com o seu?"

**Frio** (só quer preço ou informação superficial; objetivo: aquecer):
- "Olá! Para te ajudar, posso te perguntar o que motivou vocês a pensar numa lareira agora? Estética, calor ou praticidade?"
- "A maioria dos clientes nos procura porque quer transformar o ambiente em algo realmente aconchegante para o inverno. A lareira MF acaba virando o ponto central da casa."
- "A diferença da MF é que ela aquece de verdade, consome pouca lenha e tem tecnologia de tripla combustão — isso evita manutenção e reduz custo de uso."
- Perguntas: tamanho do ambiente? casa térrea ou sobrado?
- CTA de engajamento: "Posso te enviar alguns modelos para você visualizar o conceito?" / "Quer ver fotos de ambientes parecidos com o que vocês querem criar?"

**Mensagens prontas para WhatsApp:**
- Apresentação: "Olá! Sou da equipe técnica LF/AEG. Vou te ajudar a escolher o modelo ideal da lareira para o seu ambiente. Pode me dizer onde vocês pretendem instalar?"
- Valor: "A MF tem tecnologia de tripla combustão, que entrega muito mais calor usando 3 a 5 m³ de lenha por inverno — outras lareiras chegam a 16 m³. Só nisso, você já tem uma economia de até R$ 4.000 por temporada"
- Emocional: **"A ideia é criar um ambiente aconchegante, eficiente e bonito — aquele lugar da casa onde a família realmente se reúne no inverno."**
- Prova social: "Inclusive celebridades como Murilo Rosa e Alejandro Claveaux escolheram MF para suas casas por causa da eficiência e do visual premium."
- Ancoragem: "Antes do valor, é importante saber que a MF tem performance muito superior às lareiras comuns. O investimento acaba se pagando nos primeiros invernos."
- Fechamento: "Quer que eu prepare sua proposta com o modelo ideal? Assim você já garante o valor e alinhamos a instalação."


## Contorno de objeções (versão master, 10 objeções)
Para cada objeção: causa real, técnica e frases para visita e WhatsApp. **Nota para o vendedor (repetida em todas):** "Para avançarmos com segurança, o próximo passo é alinhar tecnicamente o seu projeto e definir o modelo ideal."

### Objeção 1: "Está caro."
 Causa: não entendeu o valor, compara com algo inferior, tem medo de errar, está inseguro sobre o retorno. Técnica: ancoragem + comparação inteligente + segurança emocional.
   - Visita: "Entendo totalmente. Mas quando comparamos o custo total — não só o preço — a MF acaba sendo mais econômica, porque consome de 3 a 5 m³ de lenha por inverno. Modelos comuns chegam a 16 m³. Em poucos invernos a diferença paga o investimento."
   - WhatsApp: "Faz sentido você achar alto à primeira vista. Mas a MF foi criada para gastar até 80% menos lenha. No longo prazo, ela sai mais barata que a maioria."
   - Gatilho premium: "É um investimento que você sente no conforto diário — e no bolso, pelo baixo consumo."
### Objeção 2: "Achei outra mais barata."
 Causa: "comparando banana com maçã". Técnica: comparação objetiva, educando o cliente sem desmerecer o concorrente.
   - Visita: "Claro, existem modelos mais baratos. A diferença é que eles trabalham com combustão simples em comparação aos modelos MF. A MF usa tripla combustão — muito mais calor, muito menos lenha e durabilidade muito superiores."
   - WhatsApp: "Se comparar só preço, parece igual. Mas quando compara tecnologia, materiais e economia, a MF não tem equivalente na categoria."
   - Status: "Não é à toa que arquitetos e celebridades escolhem MF — eles buscam desempenho, não apenas preço."
### Objeção 3: "Preciso pensar."
 Causa: insegurança, entendimento incompleto, medo, falta de urgência. Técnica: microcompromisso + pergunta consultiva + redução de risco.
   - Visita: "Claro! Para eu te ajudar da melhor forma: o que você gostaria de revisar antes de decidir?"
   - WhatsApp: "Perfeito. Se quiser, posso montar uma segunda opção para comparar. Facilita bastante na hora de decidir."
   - Emocional: "O mais importante é que a lareira entregue o ambiente que vocês imaginaram."
### Objeção 4: "Vou falar com a esposa/marido."
 Técnica: apoiar a decisão conjunta.
   - Visita: "Perfeito! Posso montar uma apresentação rápida para vocês verem juntos, com fotos dos modelos que conversamos."
   - WhatsApp: "Posso preparar um resumo visual para mostrar a ele/ela. Facilita muito."
   - Consultiva: "Qual dos dois pontos você acha que mais chamaria atenção dele/dela: estética, economia ou durabilidade?"
### Objeção 5: "Está fora do meu orçamento."
 Técnica: flexibilizar sem perder valor e oferecer alternativas.
   - Visita: "Vamos fazer o seguinte: posso montar uma opção com menor investimento sem perder a performance MF. Quer ver?"
   - WhatsApp: "Tenho modelos em faixas diferentes. Posso te enviar alternativas? Assim você compara e decide com tranquilidade."
   - Emocional: "O importante é que vocês tenham o ambiente que imaginaram."
### Objeção 6: "Não tenho certeza se funciona bem."
 Causa: medo de fumaça, experiência ruim, não entende a tecnologia. Técnica: prova social técnica + educação simples.
   - Visita: "Entendo perfeitamente. As lareiras comuns realmente fumaceiam. Mas a MF foi projetada para vedação total e tripla combustão — é outro nível de desempenho."
   - WhatsApp: "Essa dúvida é super comum. A tecnologia MF reduz muito a fumaça e aumenta o calor. Posso te mostrar vídeos reais do funcionamento."
   - Autoridade: "É por isso que arquitetos nos especificam em projetos de alto padrão."
### Objeção 7: "Meu vizinho falou que lareira dá trabalho."
 Técnica: reenquadrar e explicar a diferença de tecnologia.
   - Visita: "Isso acontece com lareiras de alvenaria ou de combustão simples — elas realmente pedem muita lenha e pouca entrega térmica. A MF trabalha com tripla combustão. É outra categoria."
   - WhatsApp: "A experiência depende totalmente da tecnologia. Posso te explicar de forma simples por que a MF é diferente?"
### Objeção 8: "Vou esperar mais um pouco."
 Técnica: urgência leve + benefício temporal.
   - Visita: "Claro! Só um ponto importante: o tempo de instalação costuma aumentar quando chega o frio. Se você quiser garantir instalação tranquila, posso reservar o modelo agora."
   - WhatsApp: "Quando começar a esfriarem os dias, a agenda lota rápido. Quer que eu deixe reservado sem compromisso?"
### Objeção 9: "Ainda estou vendo outras opções."
 Técnica: comparativo consultivo.
   - Visita: "Perfeito, comparar é ótimo. Só recomendo comparar estes pontos: consumo de lenha, espessura do aço, tecnologia e garantia. É aí que a diferença aparece."
   - WhatsApp: "Se quiser, posso te mandar uma tabela comparativa rápida. Ajuda bastante na decisão."
### Objeção 10: A mais difícil: "Vou pensar e qualquer coisa eu te chamo."
 Técnica: pergunta técnica + microcompromisso + próximo passo claro.
    - Visita: "Claro! Para eu te ajudar melhor, qual ponto você gostaria de revisar antes de decidir?" ("O cliente sempre revela a objeção real.")
    - WhatsApp: "Perfeito, faço assim com todos. Posso te enviar duas alternativas para facilitar a comparação?"
    - Fechamento leve: "Posso deixar o modelo reservado para quando decidir? Isso garante valor e disponibilidade."

## Follow-up completo, reaquecimento e cliente sumido
**Regra de ouro: "Nenhum follow-up existe sem objetivo claro de avanço."**
- **Imediato (0 a 72h após a proposta):**
  - 0h: "Enviei sua proposta por e-mail/Whatsapp. Conseguiu abrir direitinho?"
  - 1h: "Só passando para confirmar se conseguiu visualizar o PDF. Quer que eu envie também aqui pelo WhatsApp novamente?"
  - 24h: "Conseguiu ver a proposta com calma? Ficou alguma dúvida sobre o modelo ou sobre o consumo de lenha?"
  - 48h: "Só reforçando: o modelo MF que sugeri tem tripla combustão e consome até 80% menos lenha que modelos comuns. Isso faz muita diferença ao longo dos anos."
  - 72h: "Se quiser, posso reservar o modelo para garantir o valor e a disponibilidade da instalação. Posso fazer isso para você?"
- **Médio prazo (3 a 14 dias):**
  - D5: "Separei aqui duas fotos de ambientes parecidos com o seu usando MF. Pode ajudar na visualização."
  - D7: "Encontrou algum ponto da proposta que gostaria de ajustar? Posso te enviar opções alternativas de modelos ou acabamentos."
  - D10: "Outro ponto importante: A estrutura em aço de 4,75–6,35 mm garante durabilidade muito superior às lareiras comuns. É um investimento de longo prazo."
  - D14: "A instalação da lareira ainda está nos seus planos? Se sim, posso ajustar o orçamento ou revisar o modelo recomendado."
- **Longo prazo (15 a 90 dias):**
  - D21: "Oi! Só passando para saber se a lareira continua nos seus planos. Se quiser, posso revisar o orçamento ou fazer novas sugestões."
  - D30: "Muitas pessoas têm dúvidas sobre lareiras, então preparei um comparativo rápido MF x alvenaria. Pode te ajudar na decisão." (anexar o comparativo)
  - D45: "Com a chegada do frio, a procura por lareiras aumenta bastante. Posso te atualizar os prazos e disponibilidades?"
  - D60: "Você prefere que eu: • Atualize a proposta • Sugira outro modelo • Ou coloque a oportunidade como arquivada por enquanto?" (gatilho de perda)
  - D90: "Como estou revisando minha carteira, mantemos sua proposta ativa ou prefere retomar mais adiante?"
- **Reaquecimento de oportunidades antigas:**
  1. "Olá! Tudo bem? Aqui é [NOME] da LF/AEG. Estava revisando meu histórico e encontrei sua proposta sobre a lareira. Gostaria de saber se o projeto continua ativo."
  2. "Se quiser, posso atualizar os valores, revisar o modelo ou montar uma nova proposta alinhada ao seu momento atual."
  3. "A tecnologia de tripla combustão da MF evoluiu bastante — maior eficiência, menor consumo e novos acabamentos. Posso te mostrar as novidades?"
- **Cliente sumido:**
  1. "Oi! Faz alguns dias que não nos falamos. Só queria saber se ficou alguma dúvida sobre a lareira ou sobre o orçamento."
  2. "Posso ajustar algo na proposta ou te apresentar outros modelos mais adequados?"
  3. "Se quiser, confirmo com a loja os prazos de entrega desta semana e reservo o modelo sem compromisso. Pode ser?"
  4. "Você prefere seguir com o modelo recomendado ou deixamos essa oportunidade em pausa por enquanto?"
- **Ligações:**
  1. "Quero garantir que você entendeu bem todos os pontos da proposta. Tem algo que gostaria que eu revisasse?"
  2. "Quero te mostrar duas opções novas que podem se encaixar melhor no que você me disse."
  3. "Estamos organizando a agenda da equipe técnica para os próximos dias. Quer que eu te encaixe para validar o ponto da lareira?"
- **Regras de ouro do seguimento:** 1. Follow-up não é insistência, é profissionalismo. 2. Cliente some quando não entende valor. 3. Perguntas abertas são chaves para reativar conversas. 4. Prova social acelera decisões. 5. Fechamento suave é mais eficaz que pressão.$k$)),
t(ordem, origem, inicio, tamanho, literal) as (values
(1, $k$Objeções, follow-up e scripts de WhatsApp$k$, 46, 107, null::text),
(2, $k$Script WhatsApp: lead quente, morno e frio$k$, 201, 1094, null::text),
(3, $k$Script WhatsApp: lead quente, morno e frio$k$, 1296, 822, null::text),
(4, $k$Script WhatsApp: lead quente, morno e frio$k$, 2120, 775, null::text),
(5, $k$Script WhatsApp: lead quente, morno e frio$k$, 2897, 740, null::text),
(6, $k$Script WhatsApp: lead quente, morno e frio$k$, 3639, 1017, null::text),
(7, $k$Contorno de objeções (versão master, 10 objeções)$k$, 4712, 229, null::text),
(8, $k$Objeção 1: "Está caro."$k$, 4972, 704, null::text),
(9, $k$Objeção 2: "Achei outra mais barata."$k$, 5720, 607, null::text),
(10, $k$Objeção 3: "Preciso pensar."$k$, 6362, 459, null::text),
(11, $k$Objeção 4: "Vou falar com a esposa/marido."$k$, 6871, 373, null::text),
(12, $k$Objeção 5: "Está fora do meu orçamento."$k$, 7291, 394, null::text),
(13, $k$Objeção 6: "Não tenho certeza se funciona bem."$k$, 7739, 523, null::text),
(14, $k$Objeção 7: "Meu vizinho falou que lareira dá trabalho."$k$, 8324, 378, null::text),
(15, $k$Objeção 8: "Vou esperar mais um pouco."$k$, 8748, 347, null::text),
(16, $k$Objeção 9: "Ainda estou vendo outras opções."$k$, 9147, 302, null::text),
(17, $k$Objeção 10: A mais difícil: "Vou pensar e qualquer coisa eu te chamo."$k$, 9526, 443, null::text),
(18, $k$Follow-up completo, reaquecimento e cliente sumido$k$, 10025, 1156, null::text),
(19, $k$Follow-up completo, reaquecimento e cliente sumido$k$, 11184, 1178, null::text),
(20, $k$Follow-up completo, reaquecimento e cliente sumido$k$, 12365, 957, null::text),
(21, $k$Follow-up completo, reaquecimento e cliente sumido$k$, 13323, 267, null::text)),
novos as (
  insert into public.aura_materiais (empresa, titulo, descricao, arquivo_nome, tipo, bytes, texto, ativo, criado_por)
  select l.empresa, $k$Objeções, follow-up e scripts de WhatsApp$k$, $k$Scripts por temperatura do lead, as 10 objeções com resposta, follow-up e cliente sumido.$k$, 'base-grupo-mf.md', 'text/markdown', octet_length(m.texto), m.texto, true, 'a12e4445-d296-44d7-8c8e-b9fc09dfdf0a'
  from m cross join lojas l
  where not exists (select 1 from public.aura_materiais x where x.empresa = l.empresa and x.titulo = $k$Objeções, follow-up e scripts de WhatsApp$k$)
  returning id, empresa
)
insert into public.aura_material_trechos (material_id, empresa, ordem, origem, texto, nucleo)
select n.id, n.empresa, t.ordem, $k$Objeções, follow-up e scripts de WhatsApp — $k$ || t.origem, coalesce(t.literal, substr(m.texto, t.inicio, t.tamanho)), false
from novos n cross join t cross join m;

-- Portfólio e marcas parceiras
with lojas(empresa) as (values ($k$LF Lareiras$k$), ($k$A&G Aquecimento$k$), ($k$Sole Aquecimento$k$), ($k$MF International$k$)),
m(empresa, texto) as (values
(null::text, $k$# Portfólio e marcas parceiras

Além das lareiras MF, as lojas vendem marcas parceiras. Use este quadro para indicar a solução certa; preços e disponibilidade, sempre confirmar com a loja.

## Qual indicar para cada necessidade
- Toalheiro de design, dourado, cobre ou com Wi-Fi: Aquece (linha Conceito + módulo Smart).
- Toalheiro de bom custo, branco ou inox: Aquece Cativa ou Seccare (Seccare sem tabela de preço: consultar a loja).
- Churrasqueira a carvão ou lenha de alto padrão, embutida no planejado: Scheer (i9, Cooktop, TRE/DUE).
- Churrasco em apartamento sem fumaça, grill a gás estilo americano: Titan Prime (Prime Touch, Home Pro, Infinity).
- Fogão a lenha nacional moderno: Guindani Vetro.
- Fogão a lenha importado premium: La Nordica Rosa 4.0 / Sovrana.
- Aquecimento automático sem lenha: pellet Foco (estufas e inserts).
- Completar cozinha ou área gourmet (adega, beer center, cooktop, coifa, cuba, misturador): De Bacco.
- Insert a lenha europeu: Kratki — só saldo de estoque, não oferecer em campanha; citar apenas se o cliente perguntar.

## Aquece — toalheiros elétricos
Marca nacional, design minimalista. Linha Conceito (premium, inox 304: Unic, Evolution, Flat, Luxo, Belle, Essencial e outros, inclusive de chão); linha Cativa (entrada, aço carbono branco); Aquece Prime sob medida; módulo Smart Wi-Fi que programa horários pelo app (só nas versões com cabo oculto).

## Seccare — toalheiros elétricos
Toalheiros nacionais (linhas Inovazione, Elegance, Tradizione articulados com giro de 180°, Campeggio, sapateiros secadores de calçado). Inox 304, branco ou preto fosco; 127 V ou 220 V. Sem tabela de preço válida: oriente consultar o valor com a loja.

## Scheer — churrasqueiras e parrillas
Empresa familiar de Caxias do Sul desde 1976, exporta para mais de 90 países. Sistema Cooktop: churrasqueira embutida na bancada ou no móvel planejado, sem alvenaria, com refratários e isolamento incluídos. Linha i9: visual limpo, sem barras laterais, espeto rotativo de 3 velocidades.

## Titan Prime — grills e churrasqueiras elétricas e a gás
Fabricante nacional, linha premium com selo INMETRO. Grills e churrasqueiras elétricas e a gás e rangetops, para varanda de apartamento e área gourmet sem fumaça de lenha.

## Guindani — fogões a lenha e linha gourmet
Fabricante de Bento Gonçalves desde 1947. Fogão Vetro ecológico com tripla combustão, chapa vitrocerâmica alemã Schott Ceran, fornalha e forno maiores, porta de vidro. Fogões a lenha nº 0, 1, 2 e 00 esmaltados ou inox.

## La Nordica — fogões a lenha italianos
Fogões certificados pela norma europeia EN 12815. Rosa 4.0 (Liberty, Pietra, Maiolica): 8,4 kW, aquece até 240 m³, rendimento de 87%, forno grande; Rosa Reverse: 8,1 kW. Cano de 150 mm.

## Foco — estufas e inserts a pellet (AMG, Itália)
Aquecimento automático, sem lenha, design italiano. Exemplos: Mini 5.S (4,4 kW, 135 m³, profundidade reduzida), Petite 6 (6,2 kW, 145 m³), Basic Steel 8/10/12 (até 220 m³, autonomia de até 18 h com o reservatório). Rendimento perto de 90%.

## De Bacco — eletrodomésticos de embutir
Cozinha de alto padrão (Grupo GhelPlus): refrigeradores, adegas, beer center, cooktops, coifas, cubas e misturadores para completar o projeto gourmet.

## Piso aquecido elétrico
Vendido e instalado por LF, A&G e Sole. Garantia: cabo vitalícia, controlador (termostato) 2 anos. A obra deve deixar prontos os pontos do termostato e do sensor (caixas e eletrodutos até o piso).$k$)),
novos as (
  insert into public.aura_materiais (empresa, titulo, descricao, arquivo_nome, tipo, bytes, texto, ativo, criado_por)
  select l.empresa, $k$Portfólio e marcas parceiras$k$, $k$Qual marca indicar para cada necessidade: Aquece, Seccare, Scheer, Titan, Guindani, La Nordica, Foco pellet, De Bacco, piso aquecido.$k$, 'base-grupo-mf.md', 'text/markdown', octet_length(m.texto), m.texto, true, 'a12e4445-d296-44d7-8c8e-b9fc09dfdf0a'
  from m join lojas l on m.empresa is null or m.empresa = l.empresa
  where not exists (select 1 from public.aura_materiais x where x.empresa = l.empresa and x.titulo = $k$Portfólio e marcas parceiras$k$)
  returning id, empresa
)
insert into public.aura_material_trechos (material_id, empresa, ordem, origem, texto, nucleo)
select n.id, n.empresa, t.ordem, t.origem, t.texto, t.nucleo
from novos n
join (values
(null::text, 1, $k$Portfólio e marcas parceiras — Portfólio e marcas parceiras$k$, $k$Além das lareiras MF, as lojas vendem marcas parceiras. Use este quadro para indicar a solução certa; preços e disponibilidade, sempre confirmar com a loja.$k$, false),
(null::text, 2, $k$Portfólio e marcas parceiras — Qual indicar para cada necessidade$k$, $k$- Toalheiro de design, dourado, cobre ou com Wi-Fi: Aquece (linha Conceito + módulo Smart).
- Toalheiro de bom custo, branco ou inox: Aquece Cativa ou Seccare (Seccare sem tabela de preço: consultar a loja).
- Churrasqueira a carvão ou lenha de alto padrão, embutida no planejado: Scheer (i9, Cooktop, TRE/DUE).
- Churrasco em apartamento sem fumaça, grill a gás estilo americano: Titan Prime (Prime Touch, Home Pro, Infinity).
- Fogão a lenha nacional moderno: Guindani Vetro.
- Fogão a lenha importado premium: La Nordica Rosa 4.0 / Sovrana.
- Aquecimento automático sem lenha: pellet Foco (estufas e inserts).
- Completar cozinha ou área gourmet (adega, beer center, cooktop, coifa, cuba, misturador): De Bacco.
- Insert a lenha europeu: Kratki — só saldo de estoque, não oferecer em campanha; citar apenas se o cliente perguntar.$k$, false),
(null::text, 3, $k$Portfólio e marcas parceiras — Aquece — toalheiros elétricos$k$, $k$Marca nacional, design minimalista. Linha Conceito (premium, inox 304: Unic, Evolution, Flat, Luxo, Belle, Essencial e outros, inclusive de chão); linha Cativa (entrada, aço carbono branco); Aquece Prime sob medida; módulo Smart Wi-Fi que programa horários pelo app (só nas versões com cabo oculto).$k$, false),
(null::text, 4, $k$Portfólio e marcas parceiras — Seccare — toalheiros elétricos$k$, $k$Toalheiros nacionais (linhas Inovazione, Elegance, Tradizione articulados com giro de 180°, Campeggio, sapateiros secadores de calçado). Inox 304, branco ou preto fosco; 127 V ou 220 V. Sem tabela de preço válida: oriente consultar o valor com a loja.$k$, false),
(null::text, 5, $k$Portfólio e marcas parceiras — Scheer — churrasqueiras e parrillas$k$, $k$Empresa familiar de Caxias do Sul desde 1976, exporta para mais de 90 países. Sistema Cooktop: churrasqueira embutida na bancada ou no móvel planejado, sem alvenaria, com refratários e isolamento incluídos. Linha i9: visual limpo, sem barras laterais, espeto rotativo de 3 velocidades.$k$, false),
(null::text, 6, $k$Portfólio e marcas parceiras — Titan Prime — grills e churrasqueiras elétricas e a gás$k$, $k$Fabricante nacional, linha premium com selo INMETRO. Grills e churrasqueiras elétricas e a gás e rangetops, para varanda de apartamento e área gourmet sem fumaça de lenha.

Guindani — fogões a lenha e linha gourmet
Fabricante de Bento Gonçalves desde 1947. Fogão Vetro ecológico com tripla combustão, chapa vitrocerâmica alemã Schott Ceran, fornalha e forno maiores, porta de vidro. Fogões a lenha nº 0, 1, 2 e 00 esmaltados ou inox.

La Nordica — fogões a lenha italianos
Fogões certificados pela norma europeia EN 12815. Rosa 4.0 (Liberty, Pietra, Maiolica): 8,4 kW, aquece até 240 m³, rendimento de 87%, forno grande; Rosa Reverse: 8,1 kW. Cano de 150 mm.

Foco — estufas e inserts a pellet (AMG, Itália)
Aquecimento automático, sem lenha, design italiano. Exemplos: Mini 5.S (4,4 kW, 135 m³, profundidade reduzida), Petite 6 (6,2 kW, 145 m³), Basic Steel 8/10/12 (até 220 m³, autonomia de até 18 h com o reservatório). Rendimento perto de 90%.

De Bacco — eletrodomésticos de embutir
Cozinha de alto padrão (Grupo GhelPlus): refrigeradores, adegas, beer center, cooktops, coifas, cubas e misturadores para completar o projeto gourmet.$k$, false),
(null::text, 7, $k$Portfólio e marcas parceiras — Piso aquecido elétrico$k$, $k$Vendido e instalado por LF, A&G e Sole. Garantia: cabo vitalícia, controlador (termostato) 2 anos. A obra deve deixar prontos os pontos do termostato e do sensor (caixas e eletrodutos até o piso).$k$, false)
) t(empresa, ordem, origem, texto, nucleo) on t.empresa is null or t.empresa = n.empresa;

-- FAQ das quatro lojas: respostas que estavam genéricas ou erradas. A de
-- "aquece mais de um ambiente" dizia que "alguns modelos" faziam condução,
-- sem dizer que é só a embutida; a da carga de lenha dava "2 a 6 h" para
-- todos; PRO/DE falava em "abertura lateral" quando E/D é o lado do vidro.
with novas(pergunta, resposta) as (values
($k$Quanto tempo dura uma carga de lenha?$k$, $k$Depende do modelo (e da lenha seca e da regulagem do ar). Pela ficha MF 2025: Orbit até 1 h; MF 360 e Ottanta até 2 h; MF 150 e MF 250 até 3 h; Adatto, Duo, Vision, Vitro, Altezza, Efficienza, Forza, Delicatta, MF 350, MF 1200, MF 1400, Fogo Pro e Fire Pro até 4 h; Prime, Prime Duo, Wide, Wide Duo e Evo Fire até 6 h. Diga sempre o número do modelo que o cliente está olhando.$k$),
($k$A lareira aquece mais de um ambiente?$k$, $k$Só a lareira EMBUTIDA, com o projeto de condução de ar quente que a loja faz na instalação (grelhas e canalização do nicho, dimensionadas pela equipe técnica; o aparelho em si não é ligado a dutos). Lareiras EXPOSTAS e SUSPENSAS não fazem condução: a exposta aquece o ambiente onde está (a versão com ventilador distribui melhor) e as suspensas MF 360 e Ottanta giram 360°, então o cliente direciona o calor e a vista do fogo para outro ambiente. Modelos dupla face (Duo, Prime Duo, Wide Duo) mostram o fogo para dois ambientes.$k$),
($k$Qual a diferença entre os modelos Adatto, Duo, Prime Duo, Wide Duo e Efficienza?$k$, $k$Adatto (55/70/90/110): a linha mais vendida, embutida ou exposta, tripla combustão, 12 a 22 kW, 35 a 220 m², carga até 4 h, garantia de 2 anos; a Adatto 90 exposta é a de melhor custo-benefício. Duo / Duo Pro: dupla face (fogo visto dos dois lados), 18 kW, 65 a 180 m², até 4 h, 2 anos; na versão exposta, 2, 3 ou 4 portas para instalação central. Prime Duo: 30 kW, 80 a 300 m², duas portas independentes (dois ambientes), até 6 h, 5 anos. Wide Duo: mesma potência e área da Prime Duo, vidro maior (32x84), puxador escondido, até 6 h, 5 anos. Efficienza: exposta, 20 kW, 65 a 200 m², 2 ventiladores italianos e pedestal para lenha, para ambientes amplos ou comerciais, até 4 h, 5 anos.$k$),
($k$Quanto tempo dura a garantia?$k$, $k$Até 5 anos, conforme o modelo. Estrutura 5 anos: Prime, Wide, Vision, Vitro, Altezza, Efficienza, MF 1200, MF 1400 e Evo Fire. 2 anos: Adatto, Duo, Delicatta, Forza, Orbit, 360, Ottanta, MF 350, Fogo Pro e Fire Pro. 1 ano: MF 150 e MF 250. Mão de obra, vidro, vedação, pintura e refratários: 1 ano. Confirme no Certificado de Garantia do modelo. Nunca prometa garantia vitalícia de lareira (vitalícia é só o cabo do piso aquecido; o controlador tem 2 anos).$k$),
($k$O que a garantia cobre?$k$, $k$Defeitos de fabricação, para o comprador original, com nota fiscal e número de série, e instalação feita por técnico qualificado. Não cobre: instalação em desacordo com o manual, superaquecimento (briquete ou lenha em excesso), falta de manutenção, problemas de chaminé/exaustão, cura da tinta malfeita, peças não originais, qualquer modificação (como serpentina) e usar a Adatto sem o templador. No piso aquecido, controlador digital instalado em área molhada perde a garantia.$k$),
($k$Qual a diferença entre os modelos PRO e DE?$k$, $k$Na Adatto, "Pro" é a versão de 3 faces (três lados de vidro, visão panorâmica). "E" e "D" têm vidro na lateral esquerda ou direita, para o cliente escolher o lado que fica à vista no projeto.$k$),
($k$Posso escolher o lado da porta?$k$, $k$Nos modelos E/D o cliente escolhe o lado do vidro lateral (esquerdo ou direito) conforme o projeto. Na Vitro também há vidro frontal + lateral direito ou esquerdo.$k$),
($k$Qual lenha é recomendada?$k$, $k$Lenha natural, seca e envelhecida, com 15 a 20% de umidade. Lenha úmida reduz o rendimento, faz mais fumaça e suja o vidro. Proibido: briquete/lenha ecológica (superaquece e perde a garantia), nó de pinho, madeira tratada ou pintada, compensado, resíduos de obra, carvão e líquidos inflamáveis.$k$)
)
update public.perguntas_frequentes p set resposta = n.resposta
from novas n where p.pergunta = n.pergunta;
