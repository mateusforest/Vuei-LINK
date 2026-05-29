# Vuei — Data Contracts And Backend Plan

## Objetivo
Congelar os contratos de dados do frontend atual antes da implementacao de backend, Supabase, autenticacao real, storage, IA real e pagamentos.

Escopo desta fase:
- mapear contexts, hooks e estados globais relevantes;
- mapear persistencia em `localStorage`;
- definir contratos de dados alvo;
- criar matriz de telas x dados;
- propor ordem segura de migracao para Supabase;
- listar riscos tecnicos antes da integracao.

Fora de escopo nesta fase:
- implementar backend;
- criar tabelas;
- integrar Supabase;
- trocar fluxos visuais;
- remover mocks do frontend.

---

## 1. Mapa De Contexts E Estados Globais

### 1.1 `TripsContext`
- Arquivo: [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
- Responsabilidade:
  - gerenciar viagens do portal do usuario;
  - gerenciar viagem ativa;
  - gerenciar saldo/historico de creditos do usuario;
  - gerar slug, `adminLink` e `shareLink`;
  - persistir viagens e creditos no navegador.
- Tipos/interfaces atuais:
  - `Trip`
    - `id`
    - `slug`
    - `name`
    - `destination`
    - `country`
    - `city`
    - `startDate`
    - `endDate`
    - `style`
    - `companions`
    - `passengersCount`
    - `status`
    - `coverImage`
    - `adminLink`
    - `shareLink`
    - `createdAt`
  - `credits`
    - `balance`
    - `history[]`
      - `action`
      - `amount`
      - `date`
      - `source`
- Funcoes expostas:
  - `addTrip`
  - `updateTrip`
  - `deleteTrip`
  - `setActiveTrip`
  - `getTripBySlug`
  - `useCredits`
  - `addCredits`
- Telas consumidoras:
  - [app/portal/layout.tsx](/abs/path/app/portal/layout.tsx)
  - [app/portal/page.tsx](/abs/path/app/portal/page.tsx)
  - [app/portal/criar-viagem/page.tsx](/abs/path/app/portal/criar-viagem/page.tsx)
  - [app/portal/viagem/page.tsx](/abs/path/app/portal/viagem/page.tsx)
  - [app/portal/compartilhar/page.tsx](/abs/path/app/portal/compartilhar/page.tsx)
  - [app/portal/creditos/page.tsx](/abs/path/app/portal/creditos/page.tsx)
  - leitura indireta em [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx) via `localStorage`
- Dados persistidos:
  - `vuei_trips`
  - `vuei_credits`
- Dependencias:
  - `localStorage`
  - logica interna de slugificacao
  - imagens mockadas por destino
- Riscos:
  - contrato atual mistura dados de formulario (`companions`) com dados derivados (`passengersCount`);
  - nao existe `updatedAt`;
  - nao existe relacao forte com `profile/user`;
  - `adminLink` e `shareLink` ficam denormalizados e precisarao de politica clara no backend;
  - nao contempla entidades filhas separadas para voos, hospedagem, documentos e roteiro.

### 1.2 `AgencyContext`
- Arquivo: [contexts/agency-context.tsx](/abs/path/contexts/agency-context.tsx)
- Responsabilidade:
  - gerenciar operacao do portal da agencia;
  - armazenar clientes, viagens, documentos, concierge, equipe, creditos e atividades;
  - gerar slugs e links das viagens criadas pela agencia;
  - persistir estado agregado da agencia no navegador.
- Tipos/interfaces atuais:
  - `Client`
    - `id`
    - `name`
    - `email`
    - `phone`
    - `document?`
    - `notes?`
    - `status`
    - `createdAt`
  - `AgencyTrip`
    - `id`
    - `slug`
    - `clientId`
    - `clientName`
    - `name`
    - `destination`
    - `country`
    - `city`
    - `startDate`
    - `endDate`
    - `style`
    - `passengersCount`
    - `status`
    - `coverImage`
    - `adminLink`
    - `shareLink`
    - `createdAt`
    - `itinerary?`
    - `documents?`
  - `AgencyDocument`
    - `id`
    - `tripId?`
    - `clientId?`
    - `name`
    - `type`
    - `isPrivate`
    - `fileUrl?`
    - `createdAt`
  - `ItineraryItem`
    - `id`
    - `day`
    - `title`
    - `time`
    - `type`
    - `highlight?`
  - `ConciergeRequest`
    - `id`
    - `tripId`
    - `clientId`
    - `clientName`
    - `destination`
    - `question`
    - `response?`
    - `status`
    - `createdAt`
  - `TeamMember`
    - `id`
    - `name`
    - `email`
    - `role`
    - `status`
    - `avatar?`
    - `createdAt`
  - `Activity`
    - `id`
    - `action`
    - `description`
    - `type`
    - `timestamp`
  - `AgencyCredits`
    - `balance`
    - `plan`
    - `history[]`
- Funcoes expostas:
  - clientes: `addClient`, `updateClient`, `deleteClient`, `getClientById`
  - viagens: `addTrip`, `updateTrip`, `deleteTrip`, `getTripById`, `getTripsByClient`
  - documentos: `addDocument`, `deleteDocument`, `getDocumentsByTrip`, `getDocumentsByClient`
  - concierge: `addConciergeRequest`, `respondToRequest`, `resolveRequest`
  - equipe: `addTeamMember`, `updateTeamMember`, `removeTeamMember`
  - creditos: `useCredits`, `addCredits`
  - atividade: `addActivity`
- Telas consumidoras:
  - [app/agencia/layout.tsx](/abs/path/app/agencia/layout.tsx)
  - [app/agencia/page.tsx](/abs/path/app/agencia/page.tsx)
  - [app/agencia/clientes/page.tsx](/abs/path/app/agencia/clientes/page.tsx)
  - [app/agencia/viagens/page.tsx](/abs/path/app/agencia/viagens/page.tsx)
  - [app/agencia/viagens/criar/page.tsx](/abs/path/app/agencia/viagens/criar/page.tsx)
  - [app/agencia/links/page.tsx](/abs/path/app/agencia/links/page.tsx)
  - [app/agencia/documentos/page.tsx](/abs/path/app/agencia/documentos/page.tsx)
  - [app/agencia/concierge/page.tsx](/abs/path/app/agencia/concierge/page.tsx)
  - [app/agencia/equipe/page.tsx](/abs/path/app/agencia/equipe/page.tsx)
  - [app/agencia/creditos/page.tsx](/abs/path/app/agencia/creditos/page.tsx)
  - [app/agencia/analytics/page.tsx](/abs/path/app/agencia/analytics/page.tsx)
  - [app/agencia/roteiros-ia/page.tsx](/abs/path/app/agencia/roteiros-ia/page.tsx)
  - [app/agencia/configuracoes/page.tsx](/abs/path/app/agencia/configuracoes/page.tsx) usa creditos do contexto
  - leitura indireta em [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx) via `localStorage`
- Dados persistidos:
  - `vuei_agency`
- Dependencias:
  - `localStorage`
  - logica interna de slugificacao
  - atividade baseada em side-effects locais
- Riscos:
  - contexto unico concentra muitos dominios;
  - `clientName` duplicado dentro da viagem alem de `clientId`;
  - `documents` existem ao mesmo tempo como array global e tambem opcionais dentro de `AgencyTrip`;
  - agencia em si nao existe como entidade persistida aqui, apenas dados operacionais;
  - creditos e plano vivem dentro da agencia mas configuracoes da agencia estao em outra chave local separada.

### 1.3 `MasterContext`
- Arquivo: [contexts/master-context.tsx](/abs/path/contexts/master-context.tsx)
- Responsabilidade:
  - fornecer mocks do portal master;
  - gerenciar agencias, usuarios, viagens, concierge, prompts, templates, transacoes, creditos, atividades, notificacoes e settings;
  - operar busca global e notificacoes do portal master.
- Tipos/interfaces atuais:
  - `Agency`
  - `User`
  - `MasterTrip`
  - `ConciergeRequest`
  - `AIPrompt`
  - `Template`
  - `Transaction`
  - `MasterCredits`
  - `Activity`
  - `Notification`
  - `MasterSettings`
- Funcoes expostas:
  - `addAgency`, `updateAgency`, `suspendAgency`, `activateAgency`
  - `addUser`, `updateUser`, `suspendUser`, `activateUser`, `adjustUserCredits`
  - `updateConciergeStatus`
  - `addPrompt`, `updatePrompt`, `togglePrompt`
  - `addTemplate`, `updateTemplate`, `toggleTemplate`, `duplicateTemplate`
  - `addCreditsPackage`, `updateCreditsPackage`
  - `updateSettings`
  - `markNotificationRead`, `markAllNotificationsRead`
  - `searchGlobal`
- Telas consumidoras:
  - [app/master/layout.tsx](/abs/path/app/master/layout.tsx)
  - [app/master/page.tsx](/abs/path/app/master/page.tsx)
  - [app/master/agencias/page.tsx](/abs/path/app/master/agencias/page.tsx)
  - [app/master/usuarios/page.tsx](/abs/path/app/master/usuarios/page.tsx)
  - [app/master/viagens/page.tsx](/abs/path/app/master/viagens/page.tsx)
  - [app/master/analytics/page.tsx](/abs/path/app/master/analytics/page.tsx)
  - [app/master/concierge/page.tsx](/abs/path/app/master/concierge/page.tsx)
  - [app/master/ia/page.tsx](/abs/path/app/master/ia/page.tsx)
  - [app/master/creditos/page.tsx](/abs/path/app/master/creditos/page.tsx)
  - [app/master/financeiro/page.tsx](/abs/path/app/master/financeiro/page.tsx)
  - [app/master/configuracoes/page.tsx](/abs/path/app/master/configuracoes/page.tsx)
  - [app/master/templates/page.tsx](/abs/path/app/master/templates/page.tsx)
- Dados persistidos:
  - nenhum `localStorage` hoje
- Dependencias:
  - somente estado em memoria do React
- Riscos:
  - master reinicia ao recarregar;
  - dados nao refletem necessariamente o que usuario e agencia criam;
  - ha inconsistencias entre o contrato exposto e o consumo em algumas telas:
    - [app/master/configuracoes/page.tsx](/abs/path/app/master/configuracoes/page.tsx) usa `addActivity`, mas `MasterContext` nao expoe essa acao;
    - [app/master/templates/page.tsx](/abs/path/app/master/templates/page.tsx) espera `deleteTemplate` e `toggleTemplateFeatured`, mas o contexto expoe `toggleTemplate` e `duplicateTemplate`;
  - `MasterTrip` usa contrato diferente do `Trip` real do portal/agencia.

### 1.4 Contextos Locais Da Pagina Da Viagem
- Arquivo: [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx)
- Contextos locais:
  - `PermissionContext`
    - `isAdmin`
    - `setIsAdmin`
  - `ToastContext`
    - `showToast`
- Responsabilidade:
  - estado local de permissao de visualizacao;
  - feedback visual dos modais/acoes do link da viagem.
- Persistencia:
  - nao persiste diretamente;
  - le `vuei_trips` e `vuei_agency` para montar a viagem.
- Riscos:
  - regras de permissao ainda dependem de query param `?admin=true`;
  - sem autenticacao/assinatura do link ainda nao existe separacao real entre publico e privado.

### 1.5 Contextos Que Nao Existem Ainda Como Dominio Separado
- `ClientsContext`: nao existe; clientes vivem dentro de `AgencyContext`.
- `CreditsContext`: nao existe; creditos vivem em `TripsContext`, `AgencyContext` e `MasterContext` de formas diferentes.
- `AuthContext` ou `UserContext`: nao existe; login/onboarding e perfis ainda sao mockados por tela.
- `DocumentsContext`: nao existe; documentos do usuario ficam no estado local da pagina da viagem e documentos da agencia vivem em `AgencyContext`.

---

## 2. Mapa De LocalStorage

### 2.1 `vuei_trips`
- Tipo salvo:
  - `Trip[]`
- Onde e criada/atualizada:
  - [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
- Onde e lida:
  - [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
  - [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx)
- Onde e apagada:
  - nao ha `removeItem`; apenas exclusao de itens dentro do array pelo contexto
- Telas impactadas:
  - portal do usuario
  - pagina do link da viagem
- Observacoes:
  - deve virar tabela `trips` no backend;
  - fonte real das viagens do portal do usuario.

### 2.2 `vuei_credits`
- Tipo salvo:
  - `{ balance, history[] }`
- Onde e criada/atualizada:
  - [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
- Onde e lida:
  - [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
- Onde e apagada:
  - nao ha remocao
- Telas impactadas:
  - [app/portal/layout.tsx](/abs/path/app/portal/layout.tsx)
  - [app/portal/creditos/page.tsx](/abs/path/app/portal/creditos/page.tsx)
- Observacoes:
  - deve virar saldo/transacoes ligados ao perfil;
  - historico atual e simples demais para auditoria real.

### 2.3 `vuei_agency`
- Tipo salvo:
  - objeto agregado com:
    - `clients`
    - `trips`
    - `documents`
    - `conciergeRequests`
    - `teamMembers`
    - `activities`
    - `credits`
- Onde e criada/atualizada:
  - [contexts/agency-context.tsx](/abs/path/contexts/agency-context.tsx)
- Onde e lida:
  - [contexts/agency-context.tsx](/abs/path/contexts/agency-context.tsx)
  - [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx)
- Onde e apagada:
  - nao ha remocao da chave inteira
- Telas impactadas:
  - todo o portal da agencia
  - pagina do link da viagem
- Observacoes:
  - deve ser quebrada em tabelas separadas;
  - hoje mistura varios dominios em um unico blob.

### 2.4 `vuei_agencia_roteiros_ia`
- Tipo salvo:
  - lista de roteiros/itinerarios mockados gerados na tela de roteiros IA
- Onde e criada/atualizada:
  - [app/agencia/roteiros-ia/page.tsx](/abs/path/app/agencia/roteiros-ia/page.tsx)
- Onde e lida:
  - [app/agencia/roteiros-ia/page.tsx](/abs/path/app/agencia/roteiros-ia/page.tsx)
- Onde e apagada:
  - nao ha remocao explicita
- Telas impactadas:
  - [app/agencia/roteiros-ia/page.tsx](/abs/path/app/agencia/roteiros-ia/page.tsx)
- Observacoes:
  - deve migrar para tabela de drafts/logs de IA ou `itineraries`;
  - hoje esta desconectada das viagens do `AgencyContext`.

### 2.5 `vuei_portal_settings`
- Tipo salvo:
  - `{ profile, settings }`
- Onde e criada/atualizada:
  - [app/portal/configuracoes/page.tsx](/abs/path/app/portal/configuracoes/page.tsx)
- Onde e lida:
  - [app/portal/configuracoes/page.tsx](/abs/path/app/portal/configuracoes/page.tsx)
- Onde e apagada:
  - nao ha remocao
- Telas impactadas:
  - configuracoes do usuario
- Observacoes:
  - parte deve virar `profiles.settings`;
  - parte sensivel como PIN/biometria nao deve ir em claro para o banco sem regra/criptografia.

### 2.6 `vuei_agencia_configuracoes_frontend`
- Tipo salvo:
  - `{ agencyData, notifications }`
- Onde e criada/atualizada:
  - [app/agencia/configuracoes/page.tsx](/abs/path/app/agencia/configuracoes/page.tsx)
- Onde e lida:
  - [app/agencia/configuracoes/page.tsx](/abs/path/app/agencia/configuracoes/page.tsx)
- Onde e apagada:
  - nao ha remocao
- Telas impactadas:
  - configuracoes da agencia
- Observacoes:
  - deve ser incorporada ao contrato final de `Agency` e `AgencySettings`;
  - hoje esta fora do `AgencyContext`, criando possivel divergencia com creditos/plano reais da agencia.

### 2.7 `vuei-pwa-dismissed`
- Tipo salvo:
  - string numerica com contagem de dispensas do popup PWA
- Onde e criada/atualizada:
  - [components/pwa-popup.tsx](/abs/path/components/pwa-popup.tsx)
- Onde e lida:
  - [components/pwa-popup.tsx](/abs/path/components/pwa-popup.tsx)
- Onde e apagada:
  - nao ha remocao
- Telas impactadas:
  - landing / experiencia PWA
- Observacoes:
  - deve continuar local; nao precisa ir para banco.

### 2.8 Conflitos E Orfaos
- Nao ha chaves claramente duplicadas por nome.
- Ha duplicacao conceitual:
  - perfil/configuracoes do usuario vivem fora de um `Profile` global;
  - configuracoes da agencia vivem fora do `AgencyContext`;
  - roteiros IA vivem fora do agregado de viagens/agencia.
- Dados que devem virar banco:
  - `vuei_trips`
  - `vuei_credits`
  - `vuei_agency`
  - `vuei_agencia_roteiros_ia`
  - partes de `vuei_portal_settings`
  - partes de `vuei_agencia_configuracoes_frontend`
- Dados que podem continuar locais:
  - `vuei-pwa-dismissed`
  - estados efemeros de modais, toasts e filtros.

---

## 3. Contrato Final Sugerido — `Trip`

### 3.1 Objetivo
Unificar viagens criadas por usuario e viagens criadas por agencia sob um unico contrato canônico.

### 3.2 Contrato Sugerido

```ts
type TripStatus = "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
type TripOwnerType = "traveler" | "agency"
type TripVisibility = "private" | "public"

interface Trip {
  id: string
  title: string
  slug: string
  destination: string
  country: string | null
  city: string | null
  startDate: string | null
  endDate: string | null
  status: TripStatus
  style: string | null
  ownerType: TripOwnerType
  ownerUserId: string | null
  agencyId: string | null
  clientId: string | null
  adminLink: string
  publicLink: string
  coverImage: string | null
  visibility: TripVisibility
  travelersCount: number
  permissions: {
    publicCanViewItinerary: boolean
    publicCanViewAccommodation: boolean
    publicCanViewFlights: boolean
    publicCanViewPublicDocuments: boolean
    publicCanUseConcierge: boolean
  }
  creditsSummary: {
    balance: number | null
    used: number | null
    total: number | null
  } | null
  offlineEnabled: boolean
  createdAt: string
  updatedAt: string
}
```

### 3.3 Entidades Filhas Relacionadas
- `TripTraveler[]`
- `TripFlight[]`
- `TripAccommodation[]`
- `TripItineraryItem[]`
- `TripDocument[]`
- `TripPermission` ou JSON controlado
- `TripCreditUsage[]`

### 3.4 Comparacao Com O Frontend Atual
- `name` atual deve virar `title`.
- `companions` deve deixar de ser campo principal e virar preferencia opcional ou input de onboarding.
- `passengersCount` deve ser mantido, mas o ideal e derivar tambem de `travelers[]`.
- `adminLink` e `shareLink` ja existem, mas padronizar `publicLink`.
- `city` e `country` ja existem em contexts, mas nem sempre sao fonte primaria; hoje derivam de `destination`.
- nao existe `updatedAt` hoje.
- nao existe `visibility` explicita hoje.
- itinerary, flights, accommodations e documents ainda nao fazem parte do contrato raiz do portal do usuario.

### 3.5 Regras
- slug deve ser unico globalmente por ambiente;
- `publicLink` nunca pode expor documentos privados;
- viagens de agencia devem sempre ter `agencyId` e `clientId`;
- viagens de usuario comum devem ter `ownerUserId`;
- `adminLink` nao deve depender so de query param no backend final.

---

## 4. Contrato Final Sugerido — `Client`

### 4.1 Contrato

```ts
type ClientStatus = "lead" | "active" | "inactive" | "archived"

interface Client {
  id: string
  agencyId: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  notes: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
}
```

### 4.2 Onde Clientes Aparecem Hoje
- [app/agencia/page.tsx](/abs/path/app/agencia/page.tsx)
- [app/agencia/clientes/page.tsx](/abs/path/app/agencia/clientes/page.tsx)
- [app/agencia/viagens/criar/page.tsx](/abs/path/app/agencia/viagens/criar/page.tsx)
- [app/agencia/links/page.tsx](/abs/path/app/agencia/links/page.tsx) via viagens
- [app/agencia/documentos/page.tsx](/abs/path/app/agencia/documentos/page.tsx)
- [app/agencia/concierge/page.tsx](/abs/path/app/agencia/concierge/page.tsx)
- [app/master/page.tsx](/abs/path/app/master/page.tsx) de forma indireta pelos mocks agregados

### 4.3 Comparacao Com O Atual
- o contexto atual nao tem `agencyId` no `Client`, mas deve ter no backend.
- nao existe `updatedAt`.
- `notes` e `document` ja sao previstos, mas nao sao centrais em todas as telas.
- hoje viagens carregam `clientName` duplicado; ideal e resolver por join, com snapshot opcional quando necessario.

---

## 5. Contrato Final Sugerido — `Agency`

### 5.1 Contrato

```ts
type AgencyPlan = "starter" | "pro" | "enterprise"
type AgencyStatus = "pending" | "active" | "suspended" | "archived"

interface Agency {
  id: string
  name: string
  slug: string
  logo: string | null
  ownerUserId: string
  plan: AgencyPlan
  status: AgencyStatus
  creditsBalance: number
  settings: {
    email: string | null
    phone: string | null
    cnpj: string | null
    address: string | null
    notifications: {
      concierge: boolean
      trips: boolean
      credits: boolean
      newClients: boolean
    }
    security: {
      twoFactorEnabled: boolean
    }
  }
  branding: {
    logoUrl: string | null
  }
  createdAt: string
  updatedAt: string
}
```

### 5.2 Dependencias No Produto
- portal da agencia
- portal master
- creditos da agencia
- usuarios vinculados a agencia
- viagens e links criados pela agencia

### 5.3 Comparacao Com O Atual
- `AgencyContext` nao possui entidade `Agency` formal;
- [app/agencia/configuracoes/page.tsx](/abs/path/app/agencia/configuracoes/page.tsx) guarda `agencyData` fora do contexto principal;
- `MasterContext` possui uma `Agency` diferente, mais orientada a visao administrativa;
- no backend, deve haver uma entidade unica de agencia com visoes derivadas para master e portal agencia.

---

## 6. Contrato Final Sugerido — `Profile/User`

### 6.1 Contrato

```ts
type UserRole = "traveler" | "agency_owner" | "agency_member" | "master"

interface Profile {
  id: string
  email: string
  name: string
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  agencyId: string | null
  creditsBalance: number | null
  settings: {
    language: string | null
    darkMode: boolean
    notificationsEnabled: boolean
    biometricEnabled: boolean
    pinEnabled: boolean
  } | null
  createdAt: string
  updatedAt: string
}
```

### 6.2 Regras
- `traveler` acessa portal do usuario;
- `agency_owner` acessa portal da agencia com controle administrativo;
- `agency_member` acessa a mesma agencia vinculada com escopo limitado;
- `master` acessa portal master;
- um membro de agencia deve sempre ter `agencyId`;
- saldo de creditos do usuario comum deve estar associado ao perfil ou a uma carteira separada.

### 6.3 Comparacao Com O Atual
- nao ha `AuthContext` nem `ProfileContext`;
- configuracoes do usuario ficam em [app/portal/configuracoes/page.tsx](/abs/path/app/portal/configuracoes/page.tsx);
- `MasterContext` tem `User` com contrato diferente do ideal final;
- plano do usuario aparece em mock de configuracoes, mas nao existe entidade global que o sustente.

---

## 7. Contrato Final Sugerido — `Document`

### 7.1 Contrato

```ts
type DocumentVisibility = "private" | "public_trip" | "agency_only"

interface Document {
  id: string
  tripId: string | null
  clientId: string | null
  agencyId: string | null
  ownerUserId: string | null
  name: string
  type: string
  fileUrl: string | null
  filePath: string | null
  mimeType: string | null
  size: number | null
  isPrivate: boolean
  visibility: DocumentVisibility
  aiExtractedData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
```

### 7.2 Regras
- documentos privados nao aparecem no link compartilhavel;
- documentos podem ser anexados por usuario ou agencia;
- leitura por IA futura deve escrever em `aiExtractedData` ou tabela filha;
- `fileUrl` e `filePath` devem ser compatíveis com storage remoto.

### 7.3 Comparacao Com O Atual
- na agencia ja existe `AgencyDocument`, mas sem `updatedAt`, `filePath`, `mimeType`, `size` ou `visibility` detalhada;
- na pagina do link ha documentos mockados locais que ainda nao saem de `Trip`;
- falta fonte unica para documentos entre portal do usuario, agencia e link vivo.

---

## 8. Contratos Sugeridos — Creditos

### 8.1 `CreditBalance`

```ts
type CreditOwnerType = "profile" | "agency"

interface CreditBalance {
  ownerType: CreditOwnerType
  ownerId: string
  balance: number
  updatedAt: string
}
```

### 8.2 `CreditTransaction`

```ts
type CreditTransactionType =
  | "grant"
  | "purchase"
  | "usage_ai"
  | "usage_concierge"
  | "usage_document"
  | "usage_itinerary"
  | "refund"
  | "adjustment"
  | "plan_included"

interface CreditTransaction {
  id: string
  ownerType: CreditOwnerType
  ownerId: string
  amount: number
  type: CreditTransactionType
  reason: string
  relatedTripId: string | null
  relatedDocumentId: string | null
  createdAt: string
}
```

### 8.3 `CreditPackage`

```ts
interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

### 8.4 `Plan`

```ts
interface Plan {
  id: string
  code: "starter" | "pro" | "enterprise" | "premium_user"
  name: string
  ownerType: "profile" | "agency"
  monthlyCredits: number
  price: number
  limits: Record<string, number | boolean>
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

### 8.5 Mapeamento Atual
- usuario:
  - `TripsContext.credits`
- agencia:
  - `AgencyContext.credits`
- master:
  - `MasterContext.credits`
  - `MasterContext.transactions`

### 8.6 Riscos Atuais
- tres contratos de credito diferentes;
- sem ledger unico;
- sem relacao forte entre consumo e viagem/documento/acao;
- planos aparecem tanto em configuracoes quanto em creditos, sem entidade canônica.

---

## 9. Contratos Sugeridos — Concierge / IA

### 9.1 `AiConversation`

```ts
interface AiConversation {
  id: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  channel: "concierge" | "itinerary" | "documents"
  status: "open" | "closed"
  createdAt: string
  updatedAt: string
}
```

### 9.2 `AiMessage`

```ts
interface AiMessage {
  id: string
  conversationId: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  role: "user" | "assistant" | "agent" | "system"
  content: string
  creditsUsed: number
  metadata: Record<string, unknown> | null
  createdAt: string
}
```

### 9.3 `AiUsageLog`

```ts
interface AiUsageLog {
  id: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  module: "concierge" | "itinerary" | "documents" | "ticket_reader"
  action: string
  creditsUsed: number
  metadata: Record<string, unknown> | null
  createdAt: string
}
```

### 9.4 Modulos Que Usarao IA
- concierge do usuario
- concierge da agencia
- roteiros IA
- leitura de passagem
- leitura de documento
- leitura de roteiro anexado

### 9.5 Comparacao Com O Atual
- agencia tem `ConciergeRequest` local;
- master tem `ConciergeRequest` local com outro contrato;
- nao existe ainda conversa/mensagem/log separados;
- `roteiros-ia` persiste uma lista local separada da viagem.

---

## 10. Matriz — Telas X Dados

| Tela | Dados necessarios | Origem atual | Origem futura |
|---|---|---|---|
| Landing `/` | CTAs, estado PWA | componentes locais + `vuei-pwa-dismissed` | conteudo estatico + preferencias locais |
| Onboarding `/onboarding` | dados iniciais do usuario/viagem | estado local de formulario | `profiles` + `trips` |
| Login `/login` | credenciais mock | estado local | `auth.users` + `profiles` |
| Portal usuario `/portal` | `trips`, `activeTrip`, links, creditos | `TripsContext` + `vuei_trips` + `vuei_credits` | `trips` + `profiles` + `credit_balances` |
| Criar viagem `/portal/criar-viagem` | formulario e criacao de viagem | `TripsContext.addTrip` | `trips` + `trip_travelers` |
| Viagem do portal `/portal/viagem` | lista de viagens, abrir, excluir | `TripsContext` | `trips` |
| Compartilhar `/portal/compartilhar` | `activeTrip`, `adminLink`, `shareLink`, permissoes mock | `TripsContext` | `trips` + `trip_permissions` |
| Configuracoes usuario `/portal/configuracoes` | perfil e preferencias | `vuei_portal_settings` | `profiles` + `profile_settings` |
| Creditos usuario `/portal/creditos` | saldo, historico, compra mock | `TripsContext.credits` | `credit_balances`, `credit_transactions`, `plans`, `packages` |
| Documentos usuario `/portal/documentos` | documentos mock do portal | estado local / mock | `documents` + storage |
| Concierge usuario `/portal/concierge` | mensagens/uso mock | estado local / mock | `ai_conversations`, `ai_messages`, `ai_usage_logs` |
| Pagina do link `/viagem/[id]` | viagem, modais, documentos, voos, hotel, roteiro, creditos, permissoes | leitura de `vuei_trips` e `vuei_agency` + mock local | `trips` + tabelas filhas + regras de acesso |
| Agencia dashboard `/agencia` | clientes, viagens, creditos, atividades, concierge | `AgencyContext` | `agencies`, `clients`, `trips`, `credit_balances`, `ai_conversations` |
| Agencia clientes `/agencia/clientes` | clientes e viagens por cliente | `AgencyContext` | `clients` + `trips` |
| Agencia criar viagem `/agencia/viagens/criar` | clientes + criacao de viagem | `AgencyContext` | `clients` + `trips` |
| Agencia viagens `/agencia/viagens` | lista de viagens, docs, concierge | `AgencyContext` | `trips`, `documents`, `ai_conversations` |
| Agencia links `/agencia/links` | links das viagens | `AgencyContext.trips` | `trips` |
| Agencia documentos `/agencia/documentos` | documentos, cliente, viagem | `AgencyContext.documents/clients/trips` | `documents`, `clients`, `trips`, storage |
| Agencia concierge `/agencia/concierge` | solicitacoes e respostas | `AgencyContext.conciergeRequests` | `ai_conversations`, `ai_messages` |
| Agencia roteiros IA `/agencia/roteiros-ia` | geracao/historico de roteiros IA | `AgencyContext.credits` + `vuei_agencia_roteiros_ia` | `ai_usage_logs` + `itinerary_templates` + `trips` |
| Agencia equipe `/agencia/equipe` | membros da equipe | `AgencyContext.teamMembers` | `profiles` + relacao com `agencies` |
| Agencia creditos `/agencia/creditos` | saldo, historico, upgrade | `AgencyContext.credits` | `credit_balances`, `credit_transactions`, `plans`, `packages` |
| Agencia configuracoes `/agencia/configuracoes` | dados da agencia, notificacoes, branding | `vuei_agencia_configuracoes_frontend` + `AgencyContext.credits` | `agencies` + `agency_settings` + `plans` |
| Master overview `/master` | stats, atividades, creditos, concierge | `MasterContext` em memoria | consultas agregadas em `profiles`, `agencies`, `trips`, `credits`, `ai_logs` |
| Master agencias `/master/agencias` | agencias e stats | `MasterContext` | `agencies` + agregacoes |
| Master usuarios `/master/usuarios` | usuarios, viagens, creditos | `MasterContext` | `profiles` + `trips` + `credit_balances` |
| Master viagens `/master/viagens` | viagens globais | `MasterContext` | `trips` + joins |
| Master concierge `/master/concierge` | solicitacoes globais | `MasterContext` | `ai_conversations`, `ai_messages` |
| Master IA `/master/ia` | prompts e uso | `MasterContext.aiPrompts` | `ai_prompts`, `ai_usage_logs` |
| Master templates `/master/templates` | templates de roteiro/conteudo | `MasterContext.templates` | `templates` |
| Master creditos `/master/creditos` | pacotes e creditos agregados | `MasterContext.credits` | `credit_packages`, `credit_transactions`, `plans` |
| Master financeiro `/master/financeiro` | transacoes e faturamento | `MasterContext.transactions` | `billing_transactions`, `plans`, `payments` |
| Master configuracoes `/master/configuracoes` | settings globais | `MasterContext.settings` | `platform_settings` |

---

## 11. Plano De Migracao Para Supabase

### Fase A — Base Estrutural
- `profiles`
- `agencies`
- `clients`
- `trips`

Objetivo:
- estabilizar identidade dos atores;
- substituir o que hoje vive em `vuei_trips` e no bloco principal de `vuei_agency`;
- permitir joins basicos entre usuario, agencia, cliente e viagem.

Decisoes importantes:
- definir slug unico;
- definir roles e membership de agencia;
- definir politica de acesso ao link admin/publico.

### Fase B — Estruturas Filhas Da Viagem
- `documents`
- storage de arquivos
- `trip_flights`
- `trip_accommodations`
- `trip_itinerary_items`
- `trip_travelers`
- `trip_permissions`

Objetivo:
- tirar voos, hospedagem, documentos e roteiro dos mocks locais;
- permitir que a pagina do link leia a viagem inteira do banco;
- aplicar visibilidade publica/privada corretamente.

### Fase C — Creditos, Planos E Pacotes
- `credit_balances`
- `credit_transactions`
- `plans`
- `credit_packages`

Objetivo:
- unificar os tres sistemas de credito atuais;
- tornar consumo rastreavel por usuario/agencia e por modulo.

### Fase D — Concierge E IA
- `ai_conversations`
- `ai_messages`
- `ai_usage_logs`
- opcionalmente `ai_prompts`

Objetivo:
- substituir `ConciergeRequest` fragmentado;
- ligar uso de IA ao consumo de creditos;
- guardar historico de atendimento e geracao de conteudo.

### Fase E — Pagamentos E Billing
- `payments`
- `subscriptions`
- `invoices`
- `webhooks`
- reconciliacao com `credit_transactions`

Objetivo:
- habilitar compra real de creditos e upgrades;
- fechar o ciclo de billing sem retrabalho nos contratos anteriores.

---

## 12. Riscos Antes Do Backend

### 12.1 Duplicacao De Estado
- viagens do usuario e da agencia usam contratos parecidos, mas nao iguais;
- agencia e configuracoes da agencia estao separadas entre contexto e `localStorage`;
- documentos aparecem em mais de um lugar conceitual.

### 12.2 Divergencia Entre Link Publico E Admin
- hoje a pagina da viagem decide o modo admin por query string;
- falta token/ACL real;
- risco de vazar areas privadas quando a integracao real entrar.

### 12.3 Permissoes
- nao existe modelo centralizado de ACL;
- usuario, agencia, membro de agencia e master ainda nao estao formalizados no frontend.

### 12.4 Documentos Privados
- regra visual existe, mas ainda nao ha enforcement de backend/storage;
- `isPrivate` sozinho nao basta, e preciso `visibility` + storage seguro.

### 12.5 Creditos Inconsistentes
- contratos de credito diferem entre usuario, agencia e master;
- sem ledger unico fica facil perder rastreabilidade.

### 12.6 Slug Duplicado
- frontend resolve unicidade localmente;
- no backend sera necessario indice unico e estrategia de retry/normalizacao.

### 12.7 Multiagencia
- nao ha membership formal de usuarios em agencias;
- risco de misturar dados entre dono e membros da operacao.

### 12.8 Usuario Sem Profile
- o projeto ainda nao separa autenticacao de perfil;
- ao integrar auth, cada sessao devera garantir existencia de `Profile`.

### 12.9 LocalStorage Antigo
- dados antigos podem nao encaixar no novo contrato;
- sera preciso versionamento e migracao defensiva no bootstrap do app.

### 12.10 Divergencia Do Master
- `MasterContext` hoje nao espelha dados reais dos outros portais;
- se o backend comecar pelo master sem alinhar os contratos, a retaguarda vai nascer desconectada do produto principal.

### 12.11 Tipagem E Contratos Que Ja Mostram Desalinhamento
- build atual passa mesmo com validacao de tipos ignorada;
- ha telas do master consumindo funcoes/campos que o contexto nao expoe de forma consistente;
- isso nao quebra a fase atual, mas e um alerta para endurecer os tipos antes da integracao real.

---

## 13. Recomendacoes

### Recomendacao 1
Definir `Trip` como entidade central do produto e evitar contratos paralelos para portal usuario, agencia e master.

### Recomendacao 2
Separar claramente:
- entidade raiz;
- entidades filhas da viagem;
- configuracoes por perfil/agencia;
- ledger de creditos;
- conversa de IA.

### Recomendacao 3
Criar camada de `adapters` ou `mappers` no frontend antes do backend real:
- `mapStoredTripToTripView`
- `mapAgencyTripToTrip`
- `mapMasterTripToTripSummary`

Isso reduz impacto visual e evita refatoracao global na hora da migracao.

### Recomendacao 4
Versionar o payload local atual:
- ex.: `schemaVersion` em `vuei_trips` e `vuei_agency`
- facilita migrar usuarios existentes quando o app passar a buscar dados do backend.

### Recomendacao 5
Endurecer tipagem do master antes de ligar Supabase:
- alinhar `useMaster` com os consumidores reais;
- remover funcoes fantasmas ou adiciona-las formalmente ao contrato.

---

## 14. Proxima Fase Sugerida

### Fase 2.1 — Preparacao Tecnica Antes Do Backend
- criar tipos compartilhados em `types/` para:
  - `Trip`
  - `Client`
  - `Agency`
  - `Profile`
  - `Document`
  - `CreditTransaction`
  - `AiConversation`
- alinhar os contexts atuais a esses tipos, sem trocar o visual;
- criar adaptadores entre mock/localStorage e contrato final;
- revisar validacao de tipos no build.

### Fase 2.2 — Inicio Do Supabase
- comecar por `profiles`, `agencies`, `clients` e `trips`;
- manter fallback local temporario enquanto as telas sao migradas por etapas.

---

## Resumo Executivo
- O frontend atual esta estavel para navegacao, mas os dados ainda estao fragmentados entre contexts, estados locais e mocks.
- O produto principal ja pede uma entidade `Trip` central, com ACL, slug unico e relacionamentos claros.
- `AgencyContext` e `TripsContext` ja servem como modelo de dominio inicial, mas precisam convergir.
- `MasterContext` deve ser tratado como visao agregada futura, nao como fonte de verdade.
- A ordem segura de backend e: identidade e viagens primeiro, dados filhos depois, creditos na sequencia, IA em seguida e billing por ultimo.
