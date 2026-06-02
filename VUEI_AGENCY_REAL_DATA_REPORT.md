# Vuei Agency Real Data Report

## Resumo

Nesta rodada, o Portal Agência deixou de usar `localStorage/mock` como fonte operacional principal quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`.

O fluxo real agora cobre:

- carregamento da agência do usuário autenticado;
- listagem real de clientes da agência;
- criação, edição e exclusão de clientes reais;
- listagem real de viagens da agência;
- criação e exclusão de viagens reais da agência;
- carregamento real de documentos já vinculados às viagens da agência;
- geração e uso consistente de `adminLink` e `shareLink`.

O que ainda não virou fluxo operacional real nesta fase:

- upload real de documentos pela área da agência;
- concierge da agência;
- equipe da agência;
- créditos/ledger real da agência;
- portal master.

Essas áreas agora ficam honestas: não usam mais dados fake como se fossem produção no fluxo principal coberto por esta fase.

## O que estava mockado

- `contexts/agency-context.tsx` era a fonte principal de:
  - clientes;
  - viagens;
  - documentos;
  - concierge;
  - equipe;
  - atividades;
  - créditos.
- `lib/repositories/clients-repository.ts` não operava de verdade no Supabase.
- criação de viagem da agência ainda dependia do contexto local como fluxo principal.
- a página de links da agência ainda:
  - copiava links com `https://` duplicado;
  - abria link compartilhável em rota errada.
- a área de documentos da agência ainda simulava upload com nome fake.

## O que virou real

### AgencyContext

Arquivo principal:

- `contexts/agency-context.tsx`

Com Supabase ativo, o contexto agora:

- resolve a agência via `profiles.agency_id` ou `owner_user_id`;
- carrega clientes reais de `public.clients`;
- carrega viagens reais de `public.trips` filtradas por `agency_id` e `owner_type = 'agency'`;
- carrega documentos reais de `public.documents` por `trip_id`;
- deixa de ler `localStorage` como fonte principal no modo real;
- evita exibir mock antigo por alguns frames no primeiro carregamento.

### Clients Repository

Arquivo:

- `lib/repositories/clients-repository.ts`

Queries/repositories reais criados ou consolidados:

- `listClients(agencyId)`
- `getClientById(id)`
- `createClient(payload)`
- `updateClient(id, payload)`
- `deleteClient(id)`
- `listClientsWithTrips(agencyId)`

Todas essas funções agora usam Supabase quando a flag real está ativa, mantendo fallback local apenas fora desse modo.

### Trips da agência

Arquivo:

- `lib/repositories/trips-repository.ts`

Ajustes relevantes:

- `createTrip()` agora respeita o `status` recebido, em vez de forçar `draft` sempre;
- `deleteTrip()` agora remove no Supabase quando o modo real está ativo.

No fluxo da agência, viagens reais são criadas com:

- `owner_type = 'agency'`
- `agency_id`
- `client_id` quando houver
- `slug`
- `admin_link`
- `public_link`
- `status`

### Páginas ajustadas para fluxo real

Arquivos alterados:

- `app/agencia/page.tsx`
- `app/agencia/clientes/page.tsx`
- `app/agencia/viagens/criar/page.tsx`
- `app/agencia/viagens/page.tsx`
- `app/agencia/documentos/page.tsx`
- `app/agencia/links/page.tsx`

Principais ajustes:

- handlers passaram a aguardar operações assíncronas reais;
- exclusão de cliente e viagem usa repositório real;
- criação de viagem da agência só conclui quando a viagem real foi criada;
- dashboard e listas passam a renderizar dados reais da agência;
- links público/admin usam URLs corretas;
- cópia de link deixou de concatenar `https://` em link já absoluto.

## SQL necessário

Nenhum novo SQL foi criado nesta rodada.

Observação importante:

- esta fase pressupõe que já existam policies RLS válidas para:
  - `agencies`
  - `agency_members`
  - `clients`
  - `trips`
  - `documents`

Se a criação de clientes ou viagens da agência falhar por RLS, o próximo passo correto é auditar as policies atuais do projeto e gerar SQL recomendado específico, sem abrir acesso amplo.

## Limitações restantes

### Documentos da agência

A listagem de documentos reais já funciona quando existem documentos ligados às viagens da agência.

Mas o upload pela área `/agencia/documentos` ainda não foi convertido em upload real de arquivo nesta fase.

Decisão tomada:

- impedir que o portal grave documento fake no banco como se fosse real;
- exibir mensagem honesta quando o usuário tenta usar esse fluxo ainda não finalizado.

### Concierge, equipe e créditos

Continuam fora do escopo desta fase.

No modo real da agência:

- concierge fica sem dados fake operacionais;
- equipe continua sem backend real;
- créditos exibem o saldo da agência quando disponível, mas sem ledger real novo nesta fase.

## Como testar cadastro de agência

1. Criar uma conta pela rota ` /agency/signup `.
2. Confirmar no Supabase:
   - `auth.users` recebeu o usuário;
   - `public.profiles` recebeu `role = 'agency_owner'`;
   - `public.agencies` recebeu a agência;
   - `public.agency_members` recebeu o vínculo do owner;
   - `profiles.agency_id` foi preenchido, se a policy permitir.
3. Fazer login com a conta recém-criada.
4. Abrir ` /agencia `.
5. Confirmar que:
   - não aparecem clientes/viagens mockados;
   - a tela abre mesmo com banco vazio;
   - o nome da agência pode ser resolvido pela tabela real.

## Como testar criação de cliente

1. Logar com uma conta `agency_owner`.
2. Abrir ` /agencia/clientes `.
3. Criar um novo cliente.
4. Confirmar no Supabase:
   - novo registro em `public.clients`;
   - `agency_id` corresponde à agência do usuário.
5. Editar o cliente.
6. Confirmar `update` em `public.clients`.
7. Excluir o cliente.
8. Confirmar remoção real no banco.

## Como testar criação de viagem de cliente

1. Logar com uma conta `agency_owner`.
2. Criar ou selecionar um cliente real.
3. Abrir ` /agencia/viagens/criar `.
4. Finalizar a criação da viagem.
5. Confirmar no Supabase:
   - novo registro em `public.trips`;
   - `owner_type = 'agency'`;
   - `agency_id` preenchido;
   - `client_id` preenchido quando cliente foi associado;
   - `slug` gerado;
   - `admin_link` no padrão `/viagem/[slug]/admin`;
   - `public_link` no padrão `/v/[slug]`.
6. Voltar para:
   - ` /agencia `
   - ` /agencia/viagens `
   - ` /agencia/links `
7. Confirmar que a viagem aparece nas três áreas usando dados reais.

## Como testar os links da agência

1. Abrir ` /agencia/links `.
2. Copiar o link admin e o compartilhável.
3. Confirmar que:
   - nenhum deles vem com `https://https://`;
   - o compartilhável usa o link curto público;
   - o admin usa `/viagem/[slug]/admin`.
4. Testar abrir em nova aba.

## O que não foi alterado

- design geral do Portal Agência;
- layout;
- portal master;
- IA;
- créditos/pagamentos;
- SQL destrutivo;
- policies abertas;
- uso de service role no frontend.
