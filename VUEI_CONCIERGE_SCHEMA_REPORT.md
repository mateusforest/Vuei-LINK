# Vuei Concierge Schema Report

## Causa raiz

O repository do Concierge em [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts) estava implementado para usar `public.ai_conversations` e `public.ai_messages`, mas essas tabelas nao existiam no Supabase ativo. Por isso o erro real era:

`relation "public.ai_conversations" does not exist`

Nao era problema de UX nem de Auth. Era ausencia da camada real de banco para o modulo.

## Campos exigidos pelo codigo

Depois da auditoria e do alinhamento desta rodada, o codigo espera:

### `public.ai_conversations`

- `id`
- `trip_id`
- `client_id`
- `agency_id`
- `owner_user_id`
- `source`
- `status`
- `title`
- `last_message`
- `last_message_at`
- `metadata`
- `created_at`
- `updated_at`

Observacao:
- internamente o app continua usando `userId` no tipo de dominio, mas agora isso e mapeado para `owner_user_id`;
- internamente o app continua usando `channel`, mas isso agora e mapeado para `source`.

### `public.ai_messages`

- `id`
- `conversation_id`
- `role`
- `content`
- `metadata`
- `created_at`

Observacao:
- o vinculo contextual de `trip`, `client`, `agency` e `owner` fica concentrado na conversa pai;
- as mensagens seguem a permissao da conversa via RLS.

## SQL gerado

Arquivo criado:

- [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql)

Ele inclui:

- criacao de `public.ai_conversations`
- criacao de `public.ai_messages`
- indices para `conversation_id`, `trip_id`, `agency_id`, `owner_user_id`, `created_at`, `last_message_at`
- trigger `updated_at` em `ai_conversations`
- RLS segura para traveler, agencia e master
- ausencia proposital de policy anonima ampla

## Policies propostas

### Conversas

- `master` le tudo
- viajante autenticado le conversas onde `owner_user_id = auth.uid()` ou onde a `trip` e dele
- agencia autenticada le conversas da propria `agency_id` e das trips/clientes da propria agencia
- insert/update so para `master`, dono ou agencia autorizada

### Mensagens

- select e insert seguem permissao da conversa pai
- nenhuma policy anonima foi aberta

## Limitacoes do link sem sessao

O link publico/admin sem sessao continua com uma limitacao importante:

- sem sessao autenticada, o frontend nao deve ganhar permissao ampla para gravar em `ai_conversations` ou `ai_messages`;
- nao foi criada nenhuma policy `using (true)` nem bypass anonimo;
- para permitir gravacao segura sem sessao no futuro, o caminho correto e uma camada backend/token curto validado, nao abertura de RLS no banco.

## Arquivos alterados

- [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts)
- [lib/supabase/types.ts](./lib/supabase/types.ts)
- [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql)
- [VUEI_CONCIERGE_SCHEMA_REPORT.md](./VUEI_CONCIERGE_SCHEMA_REPORT.md)

## Como testar depois de rodar o SQL

1. Rodar manualmente o arquivo [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql) no SQL Editor do Supabase.
2. Confirmar no banco que as tabelas `ai_conversations` e `ai_messages` existem.
3. Enviar mensagem em:
   - `/portal/concierge`
   - `/viagem/[slug]/admin`
4. Verificar inserts em:
   - `public.ai_conversations`
   - `public.ai_messages`
5. Abrir `/agencia/concierge` e confirmar leitura do historico real.
6. Abrir `/master/concierge` e confirmar contagem e ultimas interacoes.
7. Testar sem sessao e confirmar que o app mostra erro honesto se a RLS bloquear.
