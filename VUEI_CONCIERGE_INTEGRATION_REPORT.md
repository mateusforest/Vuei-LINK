# Vuei Concierge Integration Report

## Como o concierge funcionava hoje

- O link da viagem em [app/viagem/[id]/page.tsx](./app/viagem/%5Bid%5D/page.tsx) ja conseguia responder e, em alguns cenarios, salvar conversa real quando a conta proprietaria estava autenticada.
- O portal da agencia em [app/agencia/concierge/page.tsx](./app/agencia/concierge/page.tsx) mostrava uma lista baseada em `conciergeRequests`, mas a tela ainda criava respostas extras apenas em estado local.
- O portal do viajante em [app/portal/concierge/page.tsx](./app/portal/concierge/page.tsx) era totalmente mockado, com mensagens e respostas simuladas.
- O portal master em [app/master/concierge/page.tsx](./app/master/concierge/page.tsx) ainda era operacionalmente mockado: cards fixos, resposta fixa e `conciergeRequests` vazio no contexto.

## O que estava mockado

- Portal do viajante: conversa inteira em estado local.
- Portal master: monitoramento do concierge sem leitura real das tabelas `ai_conversations` e `ai_messages`.
- Portal agencia: replies adicionais apos a primeira resposta nao persistiam de verdade.
- Link da viagem: ainda mostrava aviso de sincronizacao parcial quando a sessao do dono nao estava autenticada.

## O que passou a ser real

- O repository em [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts) agora tem:
  - `listConversations`
  - `listConversationsByTrip`
  - `listMessages`
  - `listMessagesByConversationIds`
  - `createConversation`
  - `addMessage`
  - `updateConversationStatus`
- O portal do viajante agora usa conversas reais vinculadas a uma viagem real carregada do contexto de trips.
- O portal da agencia agora reconstrui o concierge a partir de `ai_conversations` + `ai_messages`, incluindo historico real e ultima interacao.
- O portal master agora le conversas reais do concierge, totaliza mensagens reais e mostra o thread real da solicitacao.
- O link da viagem continua respondendo com base nos dados reais da trip e agora tenta sincronizar a conversa real sempre que o Supabase estiver ativo.

## Estrutura das tabelas usadas

- `public.ai_conversations`
  - `id`
  - `trip_id`
  - `user_id`
  - `agency_id`
  - `client_id`
  - `channel`
  - `status`
  - `metadata`
  - `created_at`
  - `updated_at`
- `public.ai_messages`
  - `id`
  - `conversation_id`
  - `trip_id`
  - `user_id`
  - `agency_id`
  - `client_id`
  - `role`
  - `content`
  - `credits_used`
  - `metadata`
  - `created_at`

## Fluxo de sincronizacao

1. Mensagem enviada pelo link ou portal.
2. `createConversation` cria ou reutiliza a conversa real.
3. `addMessage` grava a mensagem do usuario.
4. `addMessage` grava a resposta do assistant/agent.
5. Agencia recarrega `ai_conversations` e `ai_messages` reais por `agency_id`.
6. Master recarrega `ai_conversations` e `ai_messages` reais em modo leitura.

## Arquivos alterados

- [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts)
- [app/portal/concierge/page.tsx](./app/portal/concierge/page.tsx)
- [contexts/agency-context.tsx](./contexts/agency-context.tsx)
- [app/agencia/concierge/page.tsx](./app/agencia/concierge/page.tsx)
- [contexts/master-context.tsx](./contexts/master-context.tsx)
- [app/master/concierge/page.tsx](./app/master/concierge/page.tsx)
- [app/viagem/[id]/page.tsx](./app/viagem/%5Bid%5D/page.tsx)
- [supabase/concierge_rls_review.sql](./supabase/concierge_rls_review.sql)

## SQL necessario

- Nenhum SQL foi executado automaticamente.
- O arquivo [supabase/concierge_rls_review.sql](./supabase/concierge_rls_review.sql) foi criado para revisar a limitacao atual de RLS em links sem sessao autenticada.
- Com o schema atual, nao e seguro abrir persistencia anonima total do concierge apenas com policies SQL.

## Limitacoes restantes

- O link publico `/v/[slug]` sem sessao ainda pode esbarrar em RLS ao tentar persistir historico real no banco.
- Para suporte completo e seguro a historico anonimo no link, ainda falta uma camada backend/token de sessao do concierge ou uma extensao de schema especifica para isso.
- Esta rodada nao alterou IA real, scoring, creditos nem automacao de resposta.

## Como testar

### Link e sincronizacao

1. Abrir uma viagem real com dados no Supabase.
2. Enviar mensagem no link admin com a conta dona autenticada.
3. Confirmar criacao/leitura em `ai_conversations` e `ai_messages`.
4. Atualizar a pagina e verificar se o historico permanece.

### Portal agencia

1. Abrir `/agencia/concierge`.
2. Verificar se a conversa da viagem aparece com ultima interacao real.
3. Responder pela agencia.
4. Atualizar a pagina e confirmar persistencia da nova mensagem.

### Portal master

1. Abrir `/master/concierge` com role `master`.
2. Confirmar cards reais de pendentes, em andamento, resolvidos e mensagens.
3. Abrir uma solicitacao e verificar o thread real do concierge.

### Portal viajante

1. Abrir `/portal/concierge` com usuario autenticado e pelo menos uma viagem real.
2. Enviar mensagem.
3. Atualizar a pagina e confirmar que a conversa continua existindo.
