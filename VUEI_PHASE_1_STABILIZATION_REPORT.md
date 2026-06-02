# Vuei Phase 1 Stabilization Report

Data: 2026-06-02

## Objetivo da rodada

Executar apenas a Fase 1 de estabilizacao obrigatoria do Vuei:

1. endurecer o Storage de documentos;
2. alinhar `trip_hotels` com a UI atual;
3. corrigir o bug de `copyLink`;
4. unificar o PIN dos documentos com a camada segura de quick access por dispositivo.

## Arquivos alterados

- [supabase/storage_documents_bucket.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/storage_documents_bucket.sql)
- [supabase/trip_hotels.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/trip_hotels.sql)
- [lib/supabase/types.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/supabase/types.ts)
- [lib/repositories/trip-hotels-repository.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/repositories/trip-hotels-repository.ts)
- [app/portal/criar-viagem/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/criar-viagem/page.tsx)
- [app/portal/documentos/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/documentos/page.tsx)
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/[id]/page.tsx)

## SQL recomendado

### 1. Storage de documentos

Arquivo recomendado:

- `supabase/storage_documents_bucket.sql`

O que muda:

- remove a policy ampla anterior que permitia qualquer usuario autenticado operar no bucket inteiro `vuei-documents`;
- passa a exigir prefixo do usuario no path do arquivo:
  - `<auth.uid()>/<trip_id>/documents/...`
  - `<auth.uid()>/<trip_id>/tickets/...`

Impacto:

- um usuario autenticado nao consegue mais ler, atualizar ou apagar arquivos de outro usuario apenas por estar autenticado;
- novos uploads do portal e do link admin passam a seguir esse padrao de path.

Observacao:

- esse SQL deve ser revisado e rodado manualmente no Supabase SQL Editor.

### 2. `trip_hotels`

Arquivo recomendado:

- `supabase/trip_hotels.sql`

O que muda:

- remove a restricao `unique (trip_id)` para permitir varias hospedagens por viagem, como a UI ja suporta;
- adiciona policy de `delete`;
- faz backfill seguro de `name` a partir de `hotel_name`, se essa coluna antiga existir;
- faz backfill seguro de `confirmation_code` a partir de `confirmation_number`, se essa coluna antiga existir;
- recria trigger de `updated_at`.

Observacao:

- esse SQL nao foi executado automaticamente;
- ele deve ser revisado e rodado manualmente antes de depender de multiplas hospedagens por viagem em producao.

## Riscos corrigidos

### Storage

Antes:

- bucket `vuei-documents` aceitava `select/insert/update/delete` para qualquer usuario autenticado, sem separar dono nem path.

Agora:

- o SQL de referencia foi endurecido para path ownership por `auth.uid()`.

### Hospedagens

Antes:

- SQL permitia so uma hospedagem por viagem por causa do `unique (trip_id)`;
- repository e UI tratavam hospedagens como lista editavel;
- nao havia policy de `delete`;
- `lib/supabase/types.ts` nao conhecia `trip_hotels`.

Agora:

- SQL de referencia foi alinhado com a UI;
- tipagem de `trip_hotels` foi adicionada;
- repository consegue ler tanto `name` quanto `hotel_name`, e `confirmation_code` quanto `confirmation_number`.

### Links

Antes:

- a tela de criacao de viagem fazia `https://${link}`, mesmo quando `adminLink` e `shareLink` ja eram absolutos.

Agora:

- o `copyLink()` copia o valor exato do link gerado.

### PIN dos documentos

Antes:

- `/portal/documentos` aceitava um PIN local solto de 4 digitos;
- nao usava hash + salt;
- nao usava a camada segura por dispositivo ja criada no Vuei.

Agora:

- a tela usa `lib/auth/quick-access.ts`;
- validacao por PIN usa hash local + salt por dispositivo;
- biometria do dispositivo pode ser usada quando ja estiver configurada;
- se o dispositivo nao tiver acesso rapido configurado, a tela orienta o usuario a configurar em `/portal/configuracoes`.

## O que nao foi alterado

- nenhum layout foi redesenhado;
- nenhum portal de agencia/master foi migrado;
- nenhuma policy foi executada automaticamente;
- nenhum fluxo de IA, creditos ou pagamentos foi alterado;
- nenhum bucket novo foi criado automaticamente;
- nao houve alteracao de RLS fora dos arquivos SQL de recomendacao.

## Como testar Storage

1. Rode manualmente o SQL de [supabase/storage_documents_bucket.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/storage_documents_bucket.sql) no Supabase.
2. Faca login com um usuario A.
3. Em `/portal/documentos`, anexe um arquivo.
4. Confirme no Storage que o path segue:
   - `<user_id>/<trip_id>/documents/...`
5. Faca login com um usuario B.
6. Tente acessar o mesmo arquivo por operacao autenticada no app.
7. O usuario B nao deve conseguir ler/alterar/apagar o objeto do usuario A.

## Como testar hospedagens

1. Rode manualmente o SQL de [supabase/trip_hotels.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/trip_hotels.sql) no Supabase.
2. Abra `/viagem/[slug]/admin` com a sessao do dono.
3. Adicione duas hospedagens na mesma viagem.
4. Confirme se ambas aparecem no app.
5. Edite uma hospedagem e confirme `update`.
6. Exclua uma hospedagem e confirme `delete`.
7. Verifique se o erro real do Supabase aparece caso a policy ainda nao esteja correta no banco.

## Como testar links

1. Em `/portal/criar-viagem`, crie uma viagem.
2. Copie o `adminLink`.
3. Copie o `shareLink`.
4. Confirme que:
   - `shareLink` segue `/v/[slug]`
   - `adminLink` segue `/viagem/[slug]/admin`
5. Confirme que o texto copiado nao comeca com `https://https://`.

## Como testar PIN dos documentos

1. No mesmo dispositivo, va para `/portal/configuracoes`.
2. Configure um PIN em `Acesso rapido neste dispositivo`.
3. Va para `/portal/documentos`.
4. Abra a area de documentos privados.
5. Informe o PIN configurado.
6. Confirme que:
   - qualquer `0000` aleatorio nao libera mais;
   - somente o PIN configurado no dispositivo funciona;
   - se biometria estiver configurada, o botao de biometria aparece.
7. Em outro dispositivo sem configuracao local, acesse `/portal/documentos` e confirme que a tela orienta configurar o acesso rapido primeiro.

## Limites restantes desta fase

- documentos publicos do link ainda dependem de uma estrategia maior de exposicao segura para leitura sem sessao;
- o SQL endurecido do bucket foi preparado, mas precisa ser revisado e rodado por voce no Supabase;
- a agencia e o master continuam fora desta rodada;
- quick access no portal de documentos agora esta coerente com a camada segura, mas continua sendo por dispositivo, nao por conta global.
