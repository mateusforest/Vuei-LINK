# Supabase Setup Instructions

## Ordem para rodar no SQL Editor

1. `supabase/schema.sql`
2. `supabase/documents.sql`
3. `supabase/ai.sql`

## Como executar

1. Abra o projeto correto no Supabase.
2. Entre em `SQL Editor`.
3. Crie uma query nova.
4. Copie e cole o conteúdo completo de cada arquivo na ordem acima.
5. Execute um arquivo por vez.

## Como validar tabelas

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Tabelas esperadas nesta fase:

- `profiles`
- `agencies`
- `agency_members`
- `clients`
- `trips`
- `documents`
- `ai_conversations`
- `ai_messages`
- `ai_usage_logs`
- `ai_prompts`

## Como confirmar RLS ativa

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

## Avisos de seguranca

- nao usar `service_role` no frontend
- nao expor documentos privados em link publico
- nao usar `?admin=true` como permissao real
- validar policies antes de abrir acesso real
