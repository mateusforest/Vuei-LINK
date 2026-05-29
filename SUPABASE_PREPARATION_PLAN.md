# Vuei - Supabase Preparation Plan

## Objetivo
Preparar a base tecnica do Vuei para a futura integracao com Supabase sem conectar backend ainda.

Escopo desta fase:
- definir ordem segura de tabelas;
- documentar dependencias entre entidades;
- registrar riscos de permissao e RLS;
- mapear como os tipos compartilhados do frontend se conectam ao backend futuro;
- orientar a migracao de `localStorage` para banco.

Fora de escopo:
- criar tabelas agora;
- configurar projeto Supabase;
- escrever migrations;
- integrar autenticacao, storage, IA ou billing.

---

## 1. Ordem De Implementacao Das Tabelas

### Primeira Onda
- `profiles`
- `agencies`
- `clients`
- `trips`

Motivo:
- estabelece identidade dos atores principais;
- resolve a entidade central do produto;
- substitui a dependencia atual de `vuei_trips` e do bloco principal de `vuei_agency`.

### Segunda Onda
- `trip_travelers`
- `trip_flights`
- `trip_accommodations`
- `trip_itinerary_items`
- `documents`
- `trip_permissions`

Motivo:
- tira do frontend os dados filhos hoje mockados ou agregados localmente;
- permite que a pagina do link da viagem passe a ler a estrutura completa com seguranca.

### Terceira Onda
- `credit_balances`
- `credit_transactions`
- `plans`
- `credit_packages`

Motivo:
- unifica o modelo de creditos entre usuario, agencia e master;
- cria ledger real para consumo de IA, concierge, leitura de documentos e upgrades futuros.

### Quarta Onda
- `ai_conversations`
- `ai_messages`
- `ai_usage_logs`
- `ai_prompts`

Motivo:
- transforma concierge e automacoes em contratos rastreaveis;
- conecta uso de IA a viagens, clientes, agencias e ledger de creditos.

### Quinta Onda
- `payments`
- `subscriptions`
- `webhooks`
- `invoices`

Motivo:
- billing deve entrar por ultimo para nao forcar retrabalho nos contratos principais;
- depende de agencias, perfis, planos e creditos ja consolidados.

---

## 2. Campos Minimos Por Entidade

### `profiles`
- `id`
- `email`
- `name`
- `phone`
- `avatar_url`
- `role`
- `agency_id`
- `created_at`
- `updated_at`

### `agencies`
- `id`
- `name`
- `slug`
- `logo`
- `owner_user_id`
- `plan`
- `status`
- `credits_balance`
- `created_at`
- `updated_at`

### `clients`
- `id`
- `agency_id`
- `name`
- `email`
- `phone`
- `document`
- `notes`
- `status`
- `created_at`
- `updated_at`

### `trips`
- `id`
- `title`
- `slug`
- `destination`
- `country`
- `city`
- `start_date`
- `end_date`
- `status`
- `style`
- `owner_type`
- `owner_user_id`
- `agency_id`
- `client_id`
- `admin_link_token` ou equivalente
- `public_slug` ou `public_link`
- `cover_image`
- `visibility`
- `offline_enabled`
- `created_at`
- `updated_at`

---

## 3. Relacoes Principais

### Profile
- pode ser:
  - `traveler`
  - `agency_owner`
  - `agency_member`
  - `master`
- pode pertencer a uma agencia quando role for de agencia;
- pode ter saldo proprio de creditos;
- pode ser dono de viagens de usuario comum.

### Agency
- possui `owner_user_id`;
- possui membros via `profiles.agency_id`;
- possui clientes;
- possui viagens;
- possui saldo de creditos e plano.

### Client
- pertence a uma agencia;
- pode ter varias viagens;
- pode ter documentos e conversas ligadas indiretamente pelas viagens.

### Trip
- pode pertencer a usuario comum via `owner_user_id`;
- pode pertencer a agencia + cliente via `agency_id` e `client_id`;
- possui slug;
- possui acesso admin e acesso publico;
- possui permissoes publicas;
- possui entidades filhas de roteiro, viajantes, documentos, voos e hospedagem.

### Credit
- pode pertencer a `profile` ou `agency`;
- deve sempre registrar transacao em ledger;
- nao pode depender apenas de saldo derivado sem historico.

### Document
- pode pertencer a `trip`;
- pode estar ligado a `client`, `agency` e `owner_user_id`;
- pode ser privado ou publico no link;
- deve ter storage e metadados seguros.

---

## 4. Dependencias Entre Entidades

- `profiles` deve existir antes de `agencies.owner_user_id`.
- `agencies` deve existir antes de `clients.agency_id`.
- `profiles` e `agencies` devem existir antes de `trips`.
- `trips` deve existir antes de:
  - `trip_travelers`
  - `trip_flights`
  - `trip_accommodations`
  - `trip_itinerary_items`
  - `documents`
  - `trip_permissions`
- `profiles` e `agencies` devem existir antes de `credit_balances`.
- `credit_balances` e `trips` devem existir antes de `credit_transactions`.
- `trips`, `profiles`, `agencies` e `clients` devem existir antes de `ai_conversations`.
- `ai_conversations` deve existir antes de `ai_messages`.

---

## 5. Regras Futuras De Permissao

### Usuario comum
- pode acessar apenas seu proprio `profile`;
- pode criar e editar apenas suas proprias viagens;
- pode acessar apenas documentos e creditos ligados ao proprio escopo;
- nao pode acessar dados de outras agencias ou outros viajantes.

### Agency owner
- pode acessar a propria agencia;
- pode acessar membros, clientes, viagens e documentos da propria agencia;
- pode administrar creditos e plano da agencia.

### Agency member
- pode acessar apenas dados da agencia vinculada;
- nao pode ver outra agencia;
- pode ter escopos reduzidos por modulo no futuro.

### Master
- precisa visao global de agencias, usuarios, viagens, creditos e IA;
- deve ser bypass controlado por role, nunca por slug ou query param.

### Link publico
- pode acessar apenas informacoes permitidas por `trip_permissions`;
- nao pode ver documentos privados;
- nao pode acessar operacoes administrativas nem dados sensiveis.

### Link admin
- nao deve depender apenas de `?admin=true`;
- precisa token seguro, hash, ACL ou sessao autenticada no futuro.

---

## 6. Observacoes Sobre RLS Futura

### Riscos principais
- link publico nao pode acessar documento privado;
- `agency_member` nao pode acessar outra agencia;
- `traveler` nao pode acessar viagem de outro `traveler`;
- `master` precisa visao global sem abrir brechas para usuarios comuns;
- `adminLink` nao pode ser apenas uma variacao da URL publica;
- storage precisa politica separada para privado x publico;
- creditos precisam ledger imutavel e auditavel.

### Recomendacoes de RLS
- politicas baseadas em `auth.uid()` e `profiles.role`;
- politicas por `agency_id` para membros e owners;
- politicas por `owner_user_id` para viajantes;
- politicas separadas para leitura publica de viagem com `public_link`/token;
- politicas de storage separadas para bucket privado e bucket publico;
- impossibilitar update/delete direto em ledger de creditos, preferindo inserts controlados.

---

## 7. Observacoes Sobre Links Admin E Publicos

### Estado atual
- o frontend ainda diferencia admin/publico principalmente por `?admin=true`;
- `adminLink` e `shareLink/publicLink` sao gerados no frontend.

### Estado futuro recomendado
- `slug` continua sendo URL amigavel da viagem;
- acesso publico usa rota publica controlada por permissoes;
- acesso admin usa token seguro ou sessao autenticada;
- documentos privados nunca ficam disponiveis em responses publicas;
- permissions de compartilhamento ficam persistidas em `trip_permissions`.

---

## 8. Observacoes Sobre Documentos Privados

- `isPrivate` sozinho nao basta no backend final;
- usar combinacao de:
  - `visibility`
  - bucket privado/publico
  - regras de acesso por trip, owner e agency
- o link compartilhavel deve receber apenas documentos com visibilidade publica;
- qualquer leitura por IA em documento privado deve respeitar escopo do dono.

---

## 9. Observacoes Sobre Creditos

- hoje existem contratos diferentes em `TripsContext`, `AgencyContext` e `MasterContext`;
- o backend deve adotar:
  - `credit_balances` como saldo atual
  - `credit_transactions` como ledger
  - `plans` como oferta recorrente
  - `credit_packages` como compra avulsa
- toda acao que consome credito deve gerar transacao:
  - concierge
  - roteiro IA
  - leitura de documento
  - leitura de passagem
  - ajustes administrativos

---

## 10. Migracao De LocalStorage

### Estado atual
- `vuei_trips`
- `vuei_credits`
- `vuei_agency`
- `vuei_portal_settings`
- `vuei_agencia_configuracoes_frontend`
- `vuei_agencia_roteiros_ia`

### Estrategia recomendada
- manter leitura defensiva de payload legado;
- adicionar `schemaVersion` nos blobs locais enquanto o backend nao entra;
- quando Supabase entrar:
  - carregar remoto primeiro quando existir sessao/dono valido;
  - migrar dados locais para o backend via adaptadores;
  - so depois considerar limpeza opcional do cache local.

### Riscos
- payload local antigo pode divergir do novo contrato;
- viagens locais podem ter slug que ainda precise normalizacao;
- configuracoes de agencia e usuario hoje vivem fora de uma entidade central.

---

## 11. Proxima Fase Sugerida

### Fase 2.3
- criar tipos compartilhados de request/response para a primeira onda (`profiles`, `agencies`, `clients`, `trips`);
- criar adapters de ida e volta entre payload local e payload backend;
- endurecer a tipagem dos contexts e do master;
- revisar validacao de tipos do build antes de conectar qualquer SDK real.

### Fase 2.4
- iniciar integracao Supabase apenas da primeira onda, com fallback local temporario para nao quebrar o app.
