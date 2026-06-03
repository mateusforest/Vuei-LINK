-- Vuei Concierge RLS review
-- Nao executar automaticamente.
-- Este arquivo existe para revisar a situacao atual das policies do concierge
-- e registrar a limitacao restante para links sem sessao autenticada.

-- =========================================================
-- 1. INSPECAO DAS POLICIES ATUAIS
-- =========================================================

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('ai_conversations', 'ai_messages')
order by tablename, policyname;

-- =========================================================
-- 2. INSPECAO DAS TABELAS USADAS PELO CONCIERGE
-- =========================================================

select count(*) as total_conversations from public.ai_conversations;
select count(*) as total_messages from public.ai_messages;

select id, trip_id, user_id, agency_id, client_id, channel, status, created_at, updated_at
from public.ai_conversations
order by updated_at desc
limit 20;

select id, conversation_id, trip_id, user_id, agency_id, client_id, role, created_at
from public.ai_messages
order by created_at desc
limit 50;

-- =========================================================
-- 3. LIMITACAO ATUAL
-- =========================================================

-- Com o schema atual, o link publico /v/[slug] sem sessao autenticada
-- nao consegue persistir historico real com seguranca apenas via policy SQL.
--
-- Motivo:
-- - ai_conversations e ai_messages usam RLS baseada em auth.uid(), agencia
--   ou role master;
-- - um visitante anonimo nao possui identidade confiavel no banco;
-- - liberar select global por trip abriria historico de terceiros;
-- - liberar insert anonimo sem um identificador de sessao seguro criaria
--   conversa publica sem isolamento adequado.
--
-- Por isso, nenhuma policy anonima ampla e recomendada aqui.

-- =========================================================
-- 4. CAMINHO SEGURO RECOMENDADO
-- =========================================================

-- Opcao recomendada para fase futura:
-- 1. criar uma camada backend controlada (Route Handler / Edge Function)
--    para emitir e validar um token curto de sessao do concierge por link;
-- 2. ou adicionar colunas especificas para sessao publica do concierge
--    com chave derivada e expiracao, acompanhadas de funcao de validacao;
-- 3. somente depois criar policies anonimas estritamente vinculadas a essa
--    validacao, nunca por trip publica aberta.

-- Exemplo apenas conceitual. Nao executar sem desenho completo da API:
-- alter table public.ai_conversations add column public_session_id text;
-- alter table public.ai_conversations add column public_session_expires_at timestamptz;
-- create index if not exists idx_ai_conversations_public_session_id
--   on public.ai_conversations(public_session_id);

-- =========================================================
-- 5. REVISAO MANUAL
-- =========================================================

-- Antes de qualquer mudanca de RLS no concierge, revisar:
-- - se o historico publico deve ser por dispositivo, por cliente ou por link;
-- - se o visitante anonimo pode rever mensagens anteriores;
-- - se a agencia precisa responder em tempo real sem expor terceiros;
-- - se o token do link admin tera mediacao backend para escrita sem login.
