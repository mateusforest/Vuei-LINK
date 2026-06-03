# Vuei Final Integration Audit

## A. Resumo executivo

- Estado geral: o Vuei ja tem o fluxo principal real de `auth`, `profiles`, `trips`, `agencies`, `agency_members`, `clients`, `documents`, `trip_hotels` e leitura `master` conectado ao Supabase.
- Nivel de integracao: medio para alto no fluxo principal de viajante e agencia; medio no link admin/public; medio no master para leitura; baixo nas areas ainda fora de escopo operacional, como creditos, IA ampla, financeiro e templates.
- Principais riscos atuais:
  - ainda existem mocks operacionais ou fallbacks visuais em areas de concierge local, creditos, roteiros IA e partes do master;
  - alguns fluxos continuam honestos, mas nao persistem em modo real;
  - parte da limpeza de dados suspeitos depende de revisao manual no banco, nao de automacao.

## B. Mapa de mocks restantes

| Arquivo | Tipo | Risco | Acao recomendada |
|---|---|---|---|
| `app/portal/concierge/page.tsx` | operacional | conversa parece real, mas e toda local | conectar a `ai_conversations`/`ai_messages` ou transformar em estado explicitamente rascunho |
| `app/agencia/roteiros-ia/page.tsx` | operacional | gerava/salvava roteiro falso; nesta rodada ficou honesto | manter como placeholder honesto ate existir persistencia real |
| `contexts/master-context.tsx` | fallback/operacional | acoes de master sao `noopWithLog`, sem persistencia | manter leitura real e nao expor essas acoes como operacionais ate haver backend |
| `app/master/financeiro/page.tsx` | visual/operacional | area sem backend financeiro real | manter estado honesto antes de integrar pagamentos |
| `app/master/ia/page.tsx` | visual/operacional | gestao de prompts/IA ainda parcial | conectar somente quando prompts/uso forem operacionais |
| `app/master/templates/page.tsx` | visual/operacional | templates sem fonte real consolidada | manter como area futura ou conectar a tabela real |
| `app/agency/onboarding/page.tsx` | legado/mock | onboarding legado ainda usa tempo artificial | revisar ou retirar da navegacao operacional |
| `app/privacidade/page.tsx` e `app/termos/page.tsx` | visual/textual | textos ainda mencionam ambiente mockado | atualizar conteudo juridico antes do lancamento |
| `app/suporte/page.tsx` | visual | fala explicitamente em fluxo mockado | alinhar para estado honesto de suporte futuro |

## C. Mapa de dados reais

### Tabelas usadas hoje pelo sistema

- `public.profiles`
  - auth bootstrap
  - header/perfil/configuracoes
  - roles e guards
- `public.agencies`
  - cadastro de agencia
  - configuracoes/branding/logo
  - leitura no master
- `public.agency_members`
  - membership owner
  - leitura de agencia/master
- `public.clients`
  - clientes reais da agencia
  - leitura no master
- `public.trips`
  - viagens do viajante
  - viagens da agencia
  - links publico/admin
  - leitura no master
- `public.documents`
  - documentos do viajante
  - documentos da agencia
  - passagens/anexos do link
  - leitura no master
- `public.trip_hotels`
  - hospedagens reais por viagem
- `public.ai_conversations`
  - historico real da agencia quando a conversa foi persistida
- `public.ai_messages`
  - mensagens reais do concierge quando gravadas

### Fluxos que persistem hoje

- cadastro viajante
- cadastro agencia
- bootstrap de profile
- criacao de cliente da agencia
- criacao de viagem do viajante
- criacao de viagem da agencia
- leitura do dashboard viajante
- leitura do dashboard agencia
- leitura do master
- upload de documentos do viajante
- upload de documentos da agencia
- hospedagem real no link/admin
- branding/logo da agencia

### Fluxos que ainda nao persistem integralmente

- `portal/concierge`
- parte do `concierge` via link quando nao ha sessao valida para escrita
- creditos reais
- compra/upgrade de planos
- roteiros IA persistidos
- areas avancadas do master (`financeiro`, `ia`, `templates`, `creditos` como operacao)

## D. Mapa de rotas

| Rota | Existe | Protegida/Publica | Dados reais ou mock | Observacoes |
|---|---|---|---|---|
| `/` | sim | publica | visual/landing | sem impacto operacional |
| `/login` | sim | publica | real | auth real com redirect |
| `/signup` | sim | publica | real | cria auth/profile traveler |
| `/portal` | sim | protegida traveler | real | viagens reais; creditos ainda nao sao operacionais |
| `/portal/criar-viagem` | sim | protegida traveler | real | cria `trips` reais |
| `/portal/documentos` | sim | protegida traveler | real | upload/documentos reais |
| `/portal/configuracoes` | sim | protegida traveler | real | profile/avatar real |
| `/portal/concierge` | sim | protegida traveler | mock operacional | conversa ainda local |
| `/portal/creditos` | sim | protegida traveler | parcialmente mock | compra ficou honesta, sem backend real |
| `/v/[slug]` | sim | publica | real | leitura de trip, docs publicos e hoteis reais |
| `/viagem/[slug]/admin` | sim | semi-publica com seguranca por acao | real parcial | abre a viagem real; escrita depende de sessao/RLS/desbloqueio |
| `/agency/signup` | sim | publica | real | cadastro de agency owner persistente |
| `/agency` | sim | alias | real | redireciona para `/agencia` |
| `/agencia` | sim | protegida agency | real | dashboard real |
| `/agencia/clientes` | sim | protegida agency | real | CRUD de clientes |
| `/agencia/viagens` | sim | protegida agency | real | leitura real das viagens |
| `/agencia/viagens/criar` | sim | protegida agency | real | cria `trips` com `owner_type = agency` |
| `/agencia/documentos` | sim | protegida agency | real | upload real de documentos |
| `/agencia/links` | sim | protegida agency | real | links reais das trips |
| `/agencia/configuracoes` | sim | protegida agency | real | branding/logo/settings reais |
| `/master` | sim | protegida master | real leitura | overview real |
| `/master/usuarios` | sim | protegida master | real leitura | `profiles` reais |
| `/master/agencias` | sim | protegida master | real leitura | `agencies` reais |
| `/master/viagens` | sim | protegida master | real leitura | `trips` reais |
| `/master/analytics` | sim | protegida master | real parcial | cards reais, sem analytics avancado |

### CTAs quebrados ou incompletos

- card `Clientes` em `app/master/page.tsx`
  - aponta para `/master/agencias`
  - nao existe rota especifica de clientes no master
  - prioridade: P2
- `portal/concierge`
  - CTA responde como se houvesse concierge operacional real
  - prioridade: P1
- areas de `creditos`
  - compra/upgrade nao tem backend real
  - nesta rodada foram deixadas honestas

## E. Comunicacao entre portais

### Ja integrados

- viajante -> `trips` -> link publico/admin
- agencia -> `clients`
- agencia -> `trips`
- agencia -> `documents`
- agencia -> branding/logo -> header/avatar
- agencia/master -> leitura de `profiles`, `agencies`, `clients`, `trips`, `documents`
- link admin -> `trip_hotels`
- link admin -> `documents`

### Parcialmente integrados

- concierge do link -> portal agencia
  - agora existe integracao real quando a conversa consegue escrever em `ai_conversations` / `ai_messages`
  - sem sessao valida do dono, o historico ainda nao sincroniza automaticamente
- link admin -> escrita sensivel
  - fluxo visual existe
  - escrita real continua sujeita a sessao/RLS

### Ainda nao integrados

- viajante -> master em modulos de concierge/creditos/analytics avancado
- agencia -> master em areas alem de leitura basica
- documentos/concierge/creditos -> analiticos operacionais reais

## F. SQL de limpeza recomendado

- Arquivo criado: `supabase/cleanup_mock_data_review.sql`
- Objetivo:
  - listar dados suspeitos;
  - identificar registros orfaos;
  - sugerir limpeza manual segura;
  - nunca apagar automaticamente.

### O que pode ser removido manualmente depois de revisar

- registros claramente marcados como `demo`, `teste`, `mock`
- `agency_members` orfaos
- `trip_hotels` orfaos
- `documents` orfaos

### O que deve ser revisado antes de qualquer acao

- `profiles` de `agency_owner` com `agency_id` nulo
- `agencies` sem `owner_user_id`
- `clients` sem `agency_id`
- `trips` com `owner_type` incoerente

### O que nao deve ser apagado automaticamente

- usuarios reais
- agencias reais
- clientes reais
- viagens reais
- documentos reais

## G. Problemas criticos por prioridade

### P0

- nenhum P0 estrutural novo encontrado no fluxo principal ja conectado

### P1

- `app/portal/concierge/page.tsx` ainda simula concierge local como se fosse operacional
- parte do concierge do link depende de sessao valida do dono para virar historico real da agencia
- creditos ainda nao possuem backend financeiro/ledger operacional

### P2

- `app/agencia/roteiros-ia/page.tsx` permanece como rascunho visual honesto, sem persistencia
- `app/master/page.tsx` tem CTA de clientes sem rota propria
- areas `master/financeiro`, `master/ia`, `master/templates` ainda nao sao operacionais
- textos de `termos`, `privacidade` e `suporte` ainda mencionam mock/demo

### P3

- refinamento de onboarding legado
- consolidacao de analytics reais
- PWA/install/support integrados

## H. Plano para 100%

### Fase 1: estabilizacao obrigatoria

- conectar `portal/concierge` ao mesmo backend de `ai_conversations`/`ai_messages`
- decidir politica segura para persistencia de concierge vindo do link sem sessao tradicional
- remover os ultimos textos/estados que ainda soam demo

### Fase 2: portais e dados reais

- criar rota/listagem real de clientes no master
- consolidar areas de `master/creditos`, `master/ia`, `master/templates`
- ligar historicos e contadores de documentos/concierge com dados reais

### Fase 3: PWA/mobile

- revisar onboarding legado mobile
- revisar suporte mobile
- revisar fluxos de instalacao/PWA

### Fase 4: IA / creditos / pagamentos

- ledger real de creditos
- compra real de creditos
- prompts reais
- financeiro master real

## I. Arquivos provaveis para a proxima rodada

- `app/portal/concierge/page.tsx`
- `lib/repositories/ai-repository.ts`
- `app/master/page.tsx`
- `app/master/creditos/page.tsx`
- `app/master/ia/page.tsx`
- `app/master/templates/page.tsx`
- `app/master/financeiro/page.tsx`
- `app/privacidade/page.tsx`
- `app/termos/page.tsx`
- `app/suporte/page.tsx`

## J. Checklist final de testes manuais

- notebook:
  - signup traveler
  - login traveler
  - criar viagem
  - abrir `/v/[slug]`
  - abrir `/viagem/[slug]/admin`
  - anexar documento no portal do viajante
  - salvar perfil/avatar
- agencia:
  - signup agency owner
  - confirmar `profiles`, `agencies`, `agency_members`
  - criar cliente
  - criar viagem
  - abrir `/agencia/documentos`
  - enviar documento real
  - salvar branding/logo
  - refresh e validar persistencia
- master:
  - abrir `/master`
  - abrir `/master/usuarios`
  - abrir `/master/agencias`
  - abrir `/master/viagens`
  - comparar com contagens reais do Supabase
- celular / aba anonima:
  - abrir `/v/[slug]`
  - abrir `/viagem/[slug]/admin`
  - validar acesso rapido/admin
  - validar ausencia de dados mockados nas viagens reais
