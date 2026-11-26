# Análise do app na Meta — AURA CRM (acesso avançado do Instagram)

App: **AURA CRM** · ID 1358564789611890 · empresa verificada: A&G Comércio de Sistemas para Aquecimento LTDA.
Situação em 26/11/2026: app **publicado**, empresa **verificada**, permissões só em **acesso padrão**
("Pronto para teste") e o pedido de Análise **montado mas não enviado**.

Com acesso padrão a Meta só entrega ao AURA o que vem de quem tem papel no app (administradores,
desenvolvedores, testadores). Clientes reais mandam direct e comentam, mas não chega nada. O
acesso avançado resolve isso — e ele só sai pela Análise do app.

O que pedir (já está na lista do envio): `instagram_manage_messages`, `instagram_manage_comments`,
`instagram_basic`, `public_profile`.

> **Não pedir agora:** "Human Agent" (responder até 7 dias depois) e "Business Asset User Profile
> Access". O AURA ainda não usa o primeiro, e a Meta reprova recurso que o vídeo não mostra.
> Depois de aprovado, dá para pedir num envio separado.

---

## 0. Antes de enviar (checklist)

Em **Configurações do app › Básico**:

- [ ] **Ícone do app** 1024×1024 (o logo da AURA).
- [ ] **URL da Política de Privacidade:** `https://crm.mflaser.com.br/privacidade`
- [ ] **URL dos Termos de Serviço** (pode ser a mesma página): `https://crm.mflaser.com.br/privacidade`
- [ ] **URL de exclusão de dados:** `https://crm.mflaser.com.br/exclusao-de-dados`
- [ ] **Categoria:** Business and Pages (Negócios e Páginas).
- [ ] **E-mail de contato** que alguém lê (a Meta manda o resultado por ele).
- [ ] **Domínios do app:** `crm.mflaser.com.br`

Na AURA:

- [ ] A política de privacidade já cita os prestadores (Supabase, Anthropic e OpenAI) — publicado
      junto com este documento. Abra o link acima e confira antes de enviar.
- [ ] Ter uma **conta do Instagram pessoal de teste** (qualquer uma que NÃO seja das lojas) para
      mandar o direct e o comentário durante a gravação.
- [ ] Ter na AURA um login de gestor ou vendedor da LF para gravar (o seu serve).

---

## 1. Textos de cada permissão (colar em inglês)

A Meta lê em inglês. Cada campo pede "como o app usa" e "por que é necessário".

### instagram_manage_messages

> AURA CRM is the internal customer-service CRM used only by the staff of Grupo MF's own stores
> (LF Lareiras, A&G Aquecimento, Sole Ferro e Fogo and MF International), which sell fireplaces in
> Brazil. Each store connects its own Instagram Professional account through Facebook Login for
> Business. We use instagram_manage_messages to (1) receive, via webhook, the Direct messages that
> customers send to the store's Instagram account, (2) show them in the store's inbox inside AURA
> together with the customer's history in the CRM, and (3) let the store's salespeople reply from
> AURA — text, photos, videos, audio, stickers, reactions and replies to a specific message. When the
> store turns it on, a virtual assistant may answer a customer who has waited more than 2 hours (or
> outside business hours); it always introduces itself as a virtual assistant, never quotes prices,
> can be paused per conversation by the staff, and only replies inside Meta's 24-hour messaging
> window. Messages are used only to serve the customer who wrote to that store; they are not used for
> advertising and are not sold or shared. Without this permission the stores' teams cannot answer
> their Instagram customers from the CRM, and customers' questions get lost between tools.

### instagram_manage_comments

> The stores' Instagram posts receive questions in the comments (price, models, installation). AURA
> CRM uses instagram_manage_comments to receive these comments via webhook, list them in the store's
> inbox, and let the store's staff (1) reply publicly, (2) reply privately (private reply to the
> commenter's Direct), and (3) hide or delete offensive or spam comments on the store's own posts.
> This is used only on the posts of the Instagram account the store connected, only to serve and
> moderate that store's own audience. Without it, comments asking for information stay unanswered and
> the team has no way to moderate spam from the CRM.

### instagram_basic

> AURA CRM uses instagram_basic to read the connected Instagram Professional account's profile
> (username, profile picture, id) to show which store account is connected and to route each
> conversation and comment to the right store, and to read the store's own media list so that
> comments can be shown with the post they belong to. It is required by instagram_manage_messages and
> instagram_manage_comments to identify the account and its posts. No data from other accounts is
> collected.

### public_profile

> Used by Facebook Login for Business to identify the store employee who connects the store's
> Instagram account to AURA CRM (name and Facebook user id), so that the connection is recorded as
> made by an authorized employee of that store. No other use.

---

## 2. Roteiro do vídeo (um vídeo só, 3 a 5 minutos)

Grave a tela do computador (Windows: **Win + Alt + R** na Barra de Jogos, ou o app Clipchamp/OBS),
em 1080p, **mostrando a barra de endereço do navegador**. Sem narração está ok; se puder, coloque
legendas curtas em inglês (sugestões abaixo). Use só a **conversa de teste**, nunca dados de cliente
real.

| # | O que fazer na tela | Legenda sugerida (inglês) |
|---|---|---|
| 1 | Abrir `https://crm.mflaser.com.br/login` e entrar na AURA. | "Store employee logs in to AURA CRM (internal tool of Grupo MF)." |
| 2 | Ir em **Painel do Gestor › Ajustes › Instagram** e clicar em **Conectar**. | "The store connects its own Instagram Professional account." |
| 3 | Na janela da Meta, mostrar a tela de permissões (direct, comentários, perfil), escolher a conta **@lflareiras** e confirmar. | "Facebook Login for Business: the employee grants instagram_basic, instagram_manage_messages and instagram_manage_comments." |
| 4 | De volta à AURA, mostrar a conta conectada. | "Connected account shown in AURA." |
| 5 | No **celular, com a conta de teste**, mandar um direct para @lflareiras ("Oi, quanto custa a lareira X?"). | "A customer sends a Direct message to the store." |
| 6 | Na AURA, abrir **Instagram** e mostrar a mensagem chegando. | "instagram_manage_messages: the message arrives in the store inbox via webhook." |
| 7 | Responder pela AURA (texto + uma foto) e mostrar a resposta chegando no celular de teste. | "The salesperson replies from AURA; the customer receives it on Instagram." |
| 8 | Mostrar o botão de **pausar o assistente virtual** nessa conversa. | "The virtual assistant always identifies itself and can be paused by staff." |
| 9 | Com a conta de teste, **comentar** num post da @lflareiras. | "A customer comments on a store post." |
| 10 | Na AURA, abrir os **comentários**, **responder em público**, depois **responder no privado**, depois **ocultar** o comentário. Mostrar no celular o resultado de cada um. | "instagram_manage_comments: reply publicly, reply privately and hide a comment on the store's own post." |
| 11 | Encerrar mostrando `https://crm.mflaser.com.br/privacidade` e `/exclusao-de-dados`. | "Privacy policy and data deletion instructions." |

Dica: se o direct de teste não aparecer, é porque a conta de teste não tem papel no app. Adicione essa
pessoa em **Funções do app › Funções › Testadores** antes de gravar (com acesso padrão só testadores
chegam ao AURA — é exatamente o que a Análise vai liberar).

---

## 3. Instruções para o revisor (campo "notes for reviewer")

> AURA CRM is an internal tool: only employees of Grupo MF's stores have accounts, so there is no
> public sign-up. The screencast shows the full flow end to end: an employee logs in, connects the
> store's Instagram Professional account through Facebook Login for Business, receives a customer's
> Direct message and a comment via webhook, and replies/moderates from AURA. The app only accesses the
> Instagram accounts that each store connects, and only uses the data to serve that store's
> customers. If you need a test login, please contact us at the e-mail in the app settings and we will
> provide a reviewer account restricted to a test store.

---

## 4. Perguntas de tratamento de dados (Data Handling)

Respostas verdadeiras, que batem com a política de privacidade:

- **Quem trata os dados:** A&G Comércio de Sistemas para Aquecimento LTDA (Brasil).
- **Prestadores de serviço (processors):** Supabase (banco de dados/arquivos), Anthropic (IA do
  assistente e organização do atendimento), OpenAI (transcrição de áudio). Todos só agem em nome das
  lojas.
- **Compartilha com terceiros para publicidade?** Não.
- **Vende dados?** Não.
- **Exclusão:** o cliente pede pelo e-mail/WhatsApp indicados em `/exclusao-de-dados`; a loja exclui
  no CRM.
- **Pedidos de autoridades:** atendidos só com ordem legal, conforme a LGPD.

---

## 5. Enviar e depois

1. **Analisar › Análise do app › Avançar**: preencher os textos (seção 1), subir o vídeo (seção 2),
   as instruções (seção 3) e as respostas (seção 4). Enviar.
2. A Meta costuma responder em **alguns dias, até ~2 semanas**. Se pedir ajustes, ela diz o quê —
   ajuste só aquilo e reenvie.
3. **Depois de aprovado:**
   - cada loja conecta o próprio Instagram em Painel do Gestor › Ajustes › Instagram
     (hoje só a @lflareiras está conectada; faltam A&G, Sole e MF);
   - mandar um direct de uma conta qualquer (sem papel no app) e conferir que chega na AURA;
   - ligar o assistente virtual por loja, se quiserem.
