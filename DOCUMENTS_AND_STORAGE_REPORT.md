# Vuei - Documents And Storage Report

## Objetivo
Preparar a base tecnica de documentos, uploads e storage do Vuei sem migrar ainda as telas atuais para fluxo real de backend.

## SQL De Documentos

Arquivo criado:
- [supabase/documents.sql](/abs/path/supabase/documents.sql)

Tabela criada:
- `documents`

Campos principais:
- `id`
- `trip_id`
- `client_id`
- `agency_id`
- `owner_user_id`
- `name`
- `type`
- `file_url`
- `file_path`
- `mime_type`
- `size_bytes`
- `is_private`
- `visibility`
- `ai_extracted_data`
- `created_at`
- `updated_at`

Visibilidades suportadas:
- `private`
- `public_trip`
- `agency_only`

## Indices

Criados:
- `documents.trip_id`
- `documents.client_id`
- `documents.agency_id`
- `documents.owner_user_id`
- `documents.visibility`
- `documents.is_private`

## Updated At

Foi aplicado trigger com a funcao existente `public.set_updated_at()` em `documents`.

## RLS De Documents

RLS ativada na tabela `documents`.

Policies iniciais:
- traveler pode ler/inserir/atualizar/remover documentos das proprias viagens;
- agency owner/member pode ler/inserir/atualizar/remover documentos da propria agencia;
- master pode ler todos;
- link publico nao foi liberado nesta fase por policy generica.

Observacao importante:
- acesso publico a documentos do link da viagem deve entrar depois via endpoint controlado ou consulta por token com filtros rigidos.

## Bucket Sugerido

Bucket planejado:
- `vuei-documents`

Direcao definida:
- bucket privado por padrao;
- documentos privados nunca publicos;
- acesso por signed URL no futuro;
- link publico so pode acessar documentos com `visibility = public_trip`;
- arquivos de agencia devem respeitar `agency_id`;
- arquivos de usuario devem respeitar `owner_user_id`.

As instrucoes e observacoes do bucket foram deixadas em [supabase/documents.sql](/abs/path/supabase/documents.sql).

## Repository

Arquivo criado:
- [lib/repositories/documents-repository.ts](/abs/path/lib/repositories/documents-repository.ts)

Funcoes preparadas:
- `listDocumentsByTrip(tripId)`
- `listDocumentsByClient(clientId)`
- `createDocumentMetadata(payload)`
- `updateDocumentMetadata(id, payload)`
- `deleteDocument(id)`
- `uploadDocumentFile(file, path)`
- `getSignedDocumentUrl(path)`
- `listPublicTripDocuments(tripId)`

Comportamento atual:
- usa fluxo local/mock por padrao;
- so considera camada Supabase quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true` e houver env publica;
- ainda nao conecta SDK nem troca telas existentes.

## Validacao De Arquivos

Arquivo criado:
- [lib/files/file-validation.ts](/abs/path/lib/files/file-validation.ts)

Funcoes:
- `validateDocumentFile`
- `formatFileSize`
- `getDocumentTypeFromMime`

Regras atuais:
- formatos permitidos:
  - PDF
  - PNG
  - JPG
  - JPEG
- tamanho maximo:
  - 10MB

## Preparacao Para Leitura Por IA

Contrato adicionado em:
- [types/document.ts](/abs/path/types/document.ts)

Tipo:
- `DocumentAiExtraction`

Campos:
- `documentId`
- `module`
- `status`
- `extractedData`
- `confidence`
- `createdAt`

Nao ha processamento real nesta fase.

## Compatibilidade Mantida

- nenhuma tela foi migrada forcadamente para upload real;
- nenhum documento mockado foi removido;
- nenhum layout visual foi alterado;
- o fluxo atual da pagina do link continua intacto;
- a camada nova ficou pronta para ser plugada depois com baixo risco.

## Riscos

- o projeto ainda nao usa o SDK do Supabase, entao o repository real esta preparado apenas como placeholder/fallback controlado;
- `file_url` e `file_path` ainda nao estao ligados a bucket real;
- a publicacao segura de documentos do link compartilhavel depende de token/endpoint dedicado numa fase futura;
- documentos privados exigirao storage policies e signed URLs antes de qualquer liberacao real;
- telas atuais de upload ainda sao majoritariamente mockadas, entao a integracao deve ser gradual.

## Proximos Passos

### Passo 1
Adicionar o SDK oficial do Supabase e ligar a repository de documentos por feature flag.

### Passo 2
Conectar upload real ao bucket `vuei-documents`.

### Passo 3
Migrar primeiro a tela da agencia de documentos, depois portal do usuario, mantendo fallback local temporario.

### Passo 4
Criar endpoint/controlador seguro para documentos publicos do link da viagem.

### Passo 5
Depois conectar leitura de documentos por IA usando `DocumentAiExtraction` e `ai_extracted_data`.
