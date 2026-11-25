# A equipe de agentes da AURA

Pedido do Elton (25/11/2026): um agente para cada função do CRM, trabalhando
junto com a IA; uma AURA que aprende com os agentes e com as conversas e
guarda isso sem nunca perder; e um **escritório virtual** onde dá para ver os
agentes trabalhando, conversando, propondo agentes novos — com uma
**Diretora** comandando todos.

O contrato (os tipos que todo agente segue) está em
`src/lib/agentes/tipos.ts`. Este documento explica como as peças se encaixam.

---

## 1. Quem é quem

```
AURA DIRETORA (diretora.ts)  ── 7h20 e 18h, seg a sáb
   │  lê o que cada agente relatou, publica o plano do dia, faz pedidos,
   │  aponta agente que não ajuda, cobra o gestor quando alguém acumula
   │  itens, responde o que chega para ela e, no máximo 1x/semana,
   │  propõe um agente novo.
   ▼
AGENTES DE FUNÇÃO (nativos/*)          GUARDIÃO DO CONHECIMENTO (guardiao.ts)
   follow-up, leads, agenda,              23h30, todo dia: copia a base de
   pipeline, pós-venda, manutenção,       conhecimento para a nuvem, confere,
   reativação, marketing, metas,          guarda 1 ano e avisa se algo sumiu.
   orçamento, qualidade, conversas,
   curador, revisor do aprendizado,    AGENTES CONFIGURÁVEIS (configuravel.ts)
   resumo do gestor…                      nascem de proposta aprovada pelo
                                          gestor mestre; leem só uma fonte.
EQUIPE VERMELHA (nativos/cacador-*.ts, setor "seguranca")
   Caçador de Brechas (6h) e Caçador de Erros (de 6 em 6 h): os
   "sabotadores do bem". Só LEEM e SONDAM (GET sem login nas rotas
   protegidas); nunca gravam dado nem mexem em código. Dizem o que está
   aberto ou quebrado e COMO ARRUMAR (regra; a IA rápida só reescreve o
   texto); alerta para a Diretora e card para os mestres no que é alto.
ROTINAS DO SISTEMA (sistema.ts)
   sentinelas, backup, supervisão, briefing, repasse de leads, cobranças,
   relatórios, aprendizado da semana. Rodam pelos crons de sempre; aqui só
   ganham uma mesa no escritório (estado lido de aura_execucoes_cron).
```

### O motor (`src/lib/agentes/motor.ts`)

O cron `GET /api/cron/agentes` roda **a cada 10 minutos**. O motor:

1. **Monta o registro**: agentes do código (Diretora, Guardião, nativos,
   rotinas do sistema) + o que o banco sobrepõe em `aura_agentes` (ligado,
   orçamento, agenda) + os configuráveis que só existem no banco.
2. **Escolhe os devidos** (`agentesDevidos`, regra pura em `agenda.ts`):
   intervalo → passou o intervalo desde a última rodada; diário → há um
   horário marcado que passou há no máximo 3 h e ainda não rodou depois dele.
   A Diretora roda por último, para ler o que os outros acabaram de fazer.
3. **Roda um de cada vez**, sem passar de ~240 s por chamada (o resto fica
   para a próxima volta). Trava por agente: uma rodada de cada vez; rodada
   "rodando" há mais de 20 min é marcada como interrompida.
4. **Entrega a IA com trava** (`ctx.ia`): `podeChamarIA()` (saldo do gestor),
   orçamento do mês do agente (soma de `ia_uso` com `funcao = 'agente/<id>'`),
   60 s de prazo, até 2 novas tentativas, custo registrado com
   `registrarUsoIA`. Falhou ou foi barrada → devolve `null` e o agente segue
   só com regras. Perfil `rapido` = modelo de volume, `redacao` = modelo de
   raciocínio (`src/lib/aura/modelos.ts`). **Prazo da rodada** (`ctx.prazo`):
   o `ctx.ia` não abre chamada com menos de 20 s sobrando e encolhe o tempo
   de espera e as novas tentativas para a resposta chegar antes do corte —
   rodada cortada pelo prazo não grava NADA. Agente com laço de IA (o
   Revisor) confere `ctx.prazo` antes de abrir lote novo. Resposta cortada no
   teto de tokens (JSON ou texto) conta como falha e vai o texto por regra.
5. **Grava o resultado**:
   - **achados → `aura_recomendacoes`**, sem repetir: a mesma `chave`
     pendente é atualizada (texto, prioridade, destinatário, link); chave nova
     é criada — menos se a pessoa concluiu/dispensou o mesmo item há menos que
     o prazo dele; pendente que o agente não relatou mais vira
     `resolvida_sozinha` (só se nenhuma chamada de IA falhou na rodada, e
     nunca nos configuráveis, cuja IA escolhe só uma parte dos itens);
   - **validade**: card que o agente confirmou e que venceria antes da
     próxima rodada dele tem a validade renovada (`venceAntesDaProximaRodada`,
     `agenda.ts`); a data de criação não muda. Só vira `expirada` (1 h depois
     de `expira_em`) o que o agente parou de relatar sem poder dar como
     resolvido. Antes a validade nunca era renovada e a varredura tirava do
     ar, no mesmo dia, o card que o agente acabara de confirmar (o Ritmo da
     Meta sumia um dia sim, um dia não; a Reativação ficava a semana fora);
   - **um aviso por pessoa por dia** no sino ("AURA: N itens novos para você
     hoje", leva ao `/meu-dia`) — os seguintes só atualizam o número;
   - **falas** no escritório (`aura_escritorio_mensagens`);
   - **sugestões de conhecimento** via `guardarAprendizado` (nascem
     "sugerido", no máximo 10 por rodada);
   - **propostas** de agente novo (`aura_agente_propostas`, sem repetir nome
     enquanto aberta);
   - **diário** da rodada (`aura_agente_execucoes`) com o custo real tirado
     de `ia_uso`.
6. Relata no mural só quando há novidade (no máximo 1 relato/hora por agente;
   falha sempre aparece).

### O escritório (`GET /api/gestor/agentes`)

Devolve o `EstadoEscritorio` (tipos.ts): as mesas (estado, o que está
fazendo, últimas 10 rodadas, próxima rodada, achados abertos/resolvidos,
custo), as falas, as propostas, o plano do dia e a saúde da base de
conhecimento. Gestor de uma loja vê falas e contagens da própria loja (e as
falas sem loja); o gestor mestre vê tudo.

### Rotas

| Rota | Quem | O quê |
|---|---|---|
| `GET /api/cron/agentes` | cron (CRON_SECRET) | roda os devidos; `?agente=<id>&forcar=1` roda um |
| `GET /api/gestor/agentes` | gestor aprovado | `EstadoEscritorio` |
| `PATCH /api/gestor/agentes/<id>` | gestor mestre | `{ ativo?, orcamentoMensalUsd? }` |
| `POST /api/gestor/agentes/<id>/rodar` | gestor mestre | roda agora (mesmo desligado) |
| `POST /api/gestor/agentes/propostas/<id>` | gestor mestre | `{ decisao: "aprovar" \| "recusar" }` |
| `GET /api/gestor/agentes/diretora` | gestor aprovado | a conversa dele com a Diretora (últimas 50 mensagens) |
| `POST /api/gestor/agentes/diretora` | gestor aprovado | `{ texto }` (até 2000) → `{ pergunta, resposta }`: ela responde na hora (IA dela, sem inventar número), encaminha pedidos a agentes e pode propor um agente novo (status `proposta`) |
| `POST /api/agentes/mensagem` | dono do card ou gestor da loja | `{ recomendacaoId, refazer? }` → `{ mensagem, telefone }` (cliente, negócio, pós-venda, lead, manutenção e compromisso) |
| `GET /api/aura/supervisao` | o próprio vendedor | cards do Meu Dia, agora com `agente`, `agente_nome`, `acao_url`, `pode_gerar_mensagem` |
| `POST /api/gestor/aprendizado` | gestor da loja / mestre | agora também `acao: "desfazer"` |

---

## 2. Regras de segurança (valem para todo agente)

1. **Nenhum agente envia mensagem para cliente.** Ele sugere; o vendedor
   envia. O botão "Gerar mensagem" escreve um rascunho; telefone e e-mail
   nunca vão para a IA (o telefone volta só para a tela abrir o WhatsApp).
2. **Nenhum agente altera dado de negócio** (venda, cliente, etapa, dono).
   Escreve só nas tabelas da equipe: recomendações, avisos, escritório,
   propostas, sugestões de conhecimento, diário.
   - **Exceção explícita: o Revisor do Aprendizado** (`revisor-aprendizado`)
     pode mudar `aura_aprendizado.status` (aprovar/recusar sugestão) e, se
     preciso, a `resposta`. Sempre reversível: grava quem decidiu
     (`revisado_por_agente`), por quê (`revisao_motivo`) e com que confiança
     (`revisao_confianca`); o gestor desfaz com `acao: "desfazer"` em
     `/api/gestor/aprendizado` (volta a "sugerido"), e cada mudança fica no
     histórico do conhecimento.
3. **O código do WhatsApp não é tocado.** Os agentes só LEEM o que o
   supervisor do WhatsApp já grava (`whatsapp_ia_leads`).
4. **Toda chamada de IA** passa por `podeChamarIA()` e pelo orçamento do
   agente, e fica em `ia_uso` como `agente/<id>`.
5. **Número em texto de IA tem de vir dos dados.** A Diretora confere: se o
   plano escrito pela IA traz um número que não está nos dados, ele é
   descartado e vai o plano escrito por regra.
6. **Agente configurável** lê só uma fonte da lista fechada, com colunas
   fixas e seguras; a IA só escolhe entre os itens que recebeu; o
   destinatário sai de regra; no máximo 50 achados; nunca mais que 1x/hora.

---

## 3. O conhecimento nunca se perde

Três camadas, de propósito independentes:

1. **Histórico** (`aura_conhecimento_historico`, migração 110): gatilho
   AFTER INSERT/UPDATE/DELETE em `aura_aprendizado`, `aura_aprendizado_origem`,
   `aura_materiais`, `aura_material_trechos`, `playbook`,
   `perguntas_frequentes`, `treinamentos` (Academy), `links_uteis` e
   `perguntas_qualificacao`. Guarda a linha inteira de antes e de depois,
   quem mexeu e quando. Ninguém além do service_role edita ou apaga (privilégio
   revogado + gatilho que recusa). Sem teto de tamanho.
2. **Cópia noturna do conhecimento** (Guardião, 23h30): todas essas tabelas
   (mais `aura_agentes` e `aura_agente_propostas`) em
   `backups/conhecimento/AAAA-MM-DD.json.gz` no Storage; baixa de volta e
   confere a contagem; guarda **365 dias**. Se alguma tabela encolheu mais de
   5% desde a noite anterior, avisa a Diretora e põe um item urgente no Meu
   Dia dos gestores mestres (que continua aparecendo por 7 dias).
3. **Backup completo do banco** (22h, `src/lib/backup/executar.ts`): banco
   inteiro + esquema + sessões do WhatsApp, no disco da VPS e no mesmo bucket
   (~30 dias).

**Para recuperar** um item apagado: procure em `aura_conhecimento_historico`
pela `tabela` e `registro_id` (a linha `antes` da operação DELETE tem tudo),
ou baixe a cópia do dia em `backups/conhecimento/`.

### Prompts pequenos com base grande

`src/lib/conhecimento/recuperar.ts` escolhe o conhecimento **aprovado** mais
relevante para um assunto, dentro de um orçamento de tokens: palavras em
comum (sem acento, sem palavras vazias), recência e vezes que fechou venda;
itens inteiros, nunca cortados no meio. `textoDoAprendizado` (que antes pegava
os 120 que mais fecharam e cortava em 8 mil caracteres) agora usa esse
ranking — a base pode crescer à vontade e o prompt fica do mesmo tamanho.

---

## 4. Como adicionar um agente

**Nativo (no código):**

1. Crie `src/lib/agentes/nativos/<nome>.ts` exportando um `DefinicaoAgente`
   (`tipo: "nativo"`, `agenda`, `usaIA`, `orcamentoMensalUsd`, `executar`).
2. `executar(ctx)` lê com `ctx.sb` (chave de serviço), decide por **regra** e
   só chama `ctx.ia(...)` onde a IA agrega (escrever, resumir, reconhecer
   padrão). Devolve `{ resumo, achados, mensagens?, aprendizados?, propostas?, metricas? }`.
3. Cada achado precisa de uma `chave` **estável** (mesmo problema na mesma
   entidade → mesma chave), `destinatarioId` (profiles.id) e `expiraEmDias`.
   Relate **todos** os abertos a cada rodada: o que não for relatado vira
   "resolvida_sozinha".
4. Acrescente-o em `AGENTES_NATIVOS` (`nativos/index.ts`). Pronto: o cron já
   o encontra; o gestor mestre liga/desliga e muda o orçamento pela tela.

**Configurável (sem código):** um agente propõe (`propostas` no resultado);
o gestor mestre aprova no escritório; nasce em `aura_agentes` com a
`ConfigAgenteConfiguravel` e começa a rodar na agenda dela.

---

## 5. O que precisa estar no banco

Ordem: **105 → 108 → 109 → 110 (106 e 107 são do Instagram e do chat do site, já aplicadas)**. (Na produção a numeração pode mudar na
hora de aplicar; a 110 trava sozinha se a 105 não estiver lá.)

- **105**: `administro_a_loja()`, `aura_execucoes_cron` (diário dos crons).
- **110** (`supabase/migrations/110_agentes_e_conhecimento.sql`):
  `aura_agentes`, `aura_agente_execucoes`, `aura_escritorio_mensagens`,
  `aura_agente_propostas`; colunas novas em `aura_recomendacoes`
  (`agente`, `chave`, `expira_em`, `mensagem_sugerida`, `atualizado_em`,
  `acao_url`, `pode_gerar_mensagem`; `supervisao_id` opcional; status
  `expirada` e `resolvida_sozinha`; único `(agente, chave)` pendente);
  colunas de revisão em `aura_aprendizado`; `aura_conhecimento_historico`
  com os gatilhos; RLS em tudo (gestor aprovado lê; escrita só pelo servidor).

**Pendente para uma migração futura:** o CHECK de `aura_agentes.setor` ainda
não aceita `atendimento` nem `seguranca`. Até lá o código grava o setor mais
próximo (`setorParaOBanco`, `util.ts`) — a mesa usa o setor do código, então
ligar/desligar os caçadores funciona; um configurável proposto nesses setores
nasce em "gestao"/"dados".

**Sem a 110** nada quebra: o motor responde "aguardando migração 110" (o cron
fica verde), a tela mostra a equipe com o aviso, o Meu Dia e o aprendizado
funcionam como antes.

### Crons (deploy/aura-crons)

- `*/10 * * * *` → `/api/cron/agentes` (novo).
- Aprendizado do WhatsApp agora é **semanal** (domingo 21h) e **pula** a
  rodada enquanto houver mais de 100 sugestões esperando revisão.
