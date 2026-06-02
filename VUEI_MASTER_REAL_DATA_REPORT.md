# Vuei Master Real Data Report

## 1. O que era mock

Antes desta fase, o Portal Master dependia majoritariamente de dados internos em `contexts/master-context.tsx`:

- agencias fake;
- usuarios fake;
- viagens fake;
- atividades fake;
- dashboard com receita, churn, IA, crescimento e destinos inventados;
- listagens de usuarios/agencias/viagens sem leitura do Supabase;
- analytics com metricas sinteticas nao conectadas ao banco.

## 2. O que virou real

Nesta fase, o Master passou a ler dados reais do Supabase para:

- `profiles`:
  - total de usuarios;
  - usuarios recentes;
  - roles reais;
  - created_at e updated_at reais;
- `agencies`:
  - total de agencias;
  - agencias recentes;
  - owner resolvido via `profiles`;
  - plano, status, credits_balance e created_at reais;
- `agency_members`:
  - contagem real de membros por agencia;
- `clients`:
  - total global de clientes;
- `trips`:
  - total de viagens;
  - viagens recentes;
  - viagens por agencia;
  - viagens por status;
  - links admin/publicos reais;
- `documents`:
  - total de documentos;
  - contagem de documentos por viagem.

## 3. Queries utilizadas

O Master passou a usar leitura agregada via repositories:

- `listProfiles()`
- `listAgencies()`
- `listAllAgencyMembers()`
- `listAllClients()`
- `listTrips()`
- `listDocuments()`

Essas leituras alimentam o novo `MasterProvider`, que monta em memoria:

- mapa de owners por agencia;
- contagem de membros por agencia;
- contagem de viagens por usuario/agencia;
- contagem de documentos por viagem;
- atividades recentes derivadas de agencias, usuarios e viagens reais.

## 4. Arquivos alterados

- `contexts/master-context.tsx`
- `lib/repositories/agencies-repository.ts`
- `lib/repositories/clients-repository.ts`
- `lib/repositories/documents-repository.ts`
- `app/master/page.tsx`
- `app/master/usuarios/page.tsx`
- `app/master/agencias/page.tsx`
- `app/master/viagens/page.tsx`
- `app/master/analytics/page.tsx`
- `app/master/layout.tsx`

## 5. Dados exibidos pelo dashboard

O dashboard `/master` agora mostra dados reais para:

- Usuarios
- Agencias
- Clientes
- Viagens
- Documentos

Tambem mostra:

- usuarios recentes reais;
- agencias recentes reais;
- viagens recentes reais;
- atividade recente derivada de registros reais.

Sem dados:

- exibe `0`;
- exibe estado vazio honesto;
- nao inventa receita, churn, IA, destinos ou analytics.

## 6. SQL necessario

Nenhum SQL novo foi necessario nesta fase.

Motivo:

- `profiles`, `agencies`, `agency_members`, `clients`, `trips` e `documents` ja possuem estrutura suficiente para leitura;
- o `schema.sql` atual ja contem `public.is_master_user()` e policies de `select` que incluem o role `master` para essas tabelas.

## 7. Limitacoes restantes

O escopo desta fase foi somente leitura real do Master. Portanto, continuam fora do escopo operacional:

- `concierge`;
- `ia`;
- `creditos`;
- `financeiro`;
- `templates`;
- configuracoes avancadas do master.

Essas areas continuam renderizando com estado limitado ou sem fonte operacional completa. Nesta rodada, o foco foi remover a falsa sensacao de operacao real em dashboard, usuarios, agencias, viagens e analytics.

Tambem permanecem como limitacoes:

- `monthlyRevenue` no Master permanece `0` por nao haver modulo financeiro real nesta fase;
- ajustes administrativos como suspender usuario/agencia ou ajustar creditos nao foram ligados ao banco;
- o badge superior de creditos no layout permanece sem operacao real consolidada.

## 8. Como testar

### Cadastro de agencia

1. Crie uma conta de agencia.
2. Confirme no Supabase:
   - `auth.users`
   - `public.profiles`
   - `public.agencies`
   - `public.agency_members`
3. Acesse `/master/agencias`.
4. Verifique se a nova agencia aparece com:
   - nome real;
   - owner real;
   - created_at real.

### Criacao de cliente

1. Entre no portal da agencia.
2. Crie um cliente real.
3. Acesse `/master`.
4. Verifique se o card de `Clientes` aumentou.

### Criacao de viagem de cliente

1. Entre no portal da agencia.
2. Crie uma viagem real vinculada a um cliente.
3. Acesse `/master/viagens`.
4. Verifique se aparecem:
   - titulo real;
   - agencia real;
   - status real;
   - created_at real;
   - links reais.

### Usuarios e roles

1. Acesse `/master/usuarios`.
2. Confirme se as roles estao coerentes:
   - `traveler` -> Viajante
   - `agency_owner` / `agency_member` -> Agencia
   - `master` -> Master

## 9. Resumo final

O Portal Master deixou de depender de mocks operacionais para o nucleo de leitura do produto.

Hoje o Master enxerga dados reais de:

- usuarios;
- agencias;
- clientes;
- viagens;
- documentos.

O que ainda nao foi conectado de forma operacional ficou explicitamente fora do escopo e deve ser tratado em rodada propria, sem misturar leitura real com metricas inventadas.
