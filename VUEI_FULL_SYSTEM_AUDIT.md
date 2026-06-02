# Vuei Full System Audit

Data da auditoria: 2026-06-02

## 1. Resumo Executivo

O Vuei esta em uma fase intermediaria de estabilizacao: o fluxo principal do viajante ja tem base real com Supabase para `auth`, `profiles`, `trips`, parte de `documents` e leitura do link publico/admin, mas o sistema ainda convive com tres estados diferentes:

1. fluxo real do viajante;
2. fluxo local/mock da agencia;
3. fluxo mock do master.

Status geral:

- Estabilidade do portal do usuario: media.
- Estabilidade do link publico/admin: media.
- Estabilidade de auth/bootstrap: media, melhor que nas rodadas anteriores.
- Estabilidade do portal da agencia: baixa para uso real.
- Estabilidade do portal master: baixa para uso real.
- Coerencia global codigo x banco: media-baixa.

Principais riscos atuais:

- dados reais e mocks coexistem em portais diferentes;
- algumas tabelas/repositorios esperados pelo produto ainda estao em `placeholder`;
- policies de Storage de documentos estao permissivas demais para usuarios autenticados;
- schema de `trip_hotels` diverge do comportamento esperado pela UI;
- ainda existem CTAs que funcionam visualmente, mas nao estao conectados a fonte real de dados.

## 2. Mapa de Rotas

| Rota | Existe | Funcional | Dados reais | Login | Problemas encontrados |
| --- | --- | --- | --- | --- | --- |
| `/` | Sim | Sim | Nao se aplica | Nao | Landing funcional. Sem problema estrutural relevante auditado nesta rodada. |
| `/login` | Sim | Sim | Sim | Nao | Fluxo depende de bootstrap de auth. Hoje parece mais estavel, mas ainda requer teste manual em F5/mobile. |
| `/signup` | Sim | Sim | Sim | Nao | Cadastro viajante usa Supabase Auth e profile bootstrap. Precisa validacao manual recorrente. |
| `/agency/signup` | Sim | Sim | Parcial | Nao | Fluxo de cadastro existe, mas operacao real ainda depende das policies corretas para `agencies` e `agency_members`. |
| `/portal` | Sim | Sim | Sim | Sim | Usa `RouteGuard`. Le viagens reais do usuario. Sem viagens, mostra estado vazio honesto. |
| `/portal/criar-viagem` | Sim | Sim | Sim | Condicional | Se logado e Supabase ativo, cria `trips` real. Se nao logado, salva `vuei_pending_trip`. Ha bug no `copyLink` que prefixa `https://` em link absoluto. |
| `/portal/configuracoes` | Sim | Sim | Parcial | Sim | Usa profile real quando Supabase esta ativo. Ainda ha persistencia local para preferencias/quick access por dispositivo. |
| `/portal/documentos` | Sim | Sim | Parcial | Sim | Usa `documents` reais quando Supabase esta ativo, mas ainda tem fluxo local de PIN proprio e nao unificado com quick access. |
| `/portal/concierge` | Sim | Sim | Nao | Sim | UI existe, mas o modulo ainda nao usa backend real. Ha referencias operacionais mockadas. |
| `/portal/creditos` | Sim | Sim | Nao | Sim | Tela existe, mas repositorio ainda esta em placeholder/local. |
| `/v/[slug]` | Sim | Sim | Sim | Nao | Link publico esta no caminho correto. Nao deve editar. Depende de dados reais de `trips`; documentos publicos ainda exigem evolucao de acesso controlado. |
| `/viagem/[slug]/admin` | Sim | Sim | Sim | Condicional | Busca trip por slug. Sem sessao, pode usar quick access por dispositivo ou login. Escrita real ainda exige sessao do dono. |
| `/agencia` | Sim | Sim | Nao | Sim | Estrutura grande e navegavel, mas dados principais ainda vem de `AgencyContext` local/mock. |
| `/agency` | Sim | Sim | Nao | Sim | Alias limpo para `/agencia`. |
| `/master` | Sim | Sim | Nao | Sim | Portal master existe, mas permanece explicitamente mockado. |
| `/terms`, `/privacy`, `/termos`, `/privacidade`, `/suporte`, `/forgot-password`, `/health` | Sim | Sim | Nao se aplica | Nao | Rotas existem. Parte do conteudo legal/suporte ainda se assume como mock/institucional. |

Observacoes de rotas:

- Nao foi encontrado `middleware.ts`.
- Nao foram encontrados dominios hardcoded antigos como `vuei.app` ou `vuei-link.vercel.app` nas areas auditadas.
- O app ja usa `NEXT_PUBLIC_APP_URL` em `lib/app-url.ts`.
- O link publico padrao esta em `/v/[slug]`.
- O link admin padrao esta em `/viagem/[slug]/admin`.

## 3. Conexao Entre Portais

### Viajante

Fluxo atual do viajante:

- `auth.users` + `public.profiles` ja formam a base real;
- `TripsContext` carrega `trips` reais via repository quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`;
- `portal` e `link da viagem` ja conseguem operar com a trip real;
- `documents` do usuario estao parcialmente reais.

Status: funcional para a base principal do produto.

### Agencia

Fluxo atual da agencia:

- cadastro de `agency_owner` existe;
- repository de `agencies` existe;
- porem o portal da agencia inteiro ainda usa `contexts/agency-context.tsx`, com seed local em `localStorage` (`vuei_agency`);
- `clients`, `trips`, `documents`, `concierge`, `team` e `activities` da agencia ainda nao fluem de Supabase para o portal operacional.

Status: inconsistente. A base de auth existe, mas o portal operacional ainda nao e real.

### Master

Fluxo atual do master:

- rota existe;
- `MasterContext` assume explicitamente que o portal master permanece mockado;
- agencias, usuarios, trips, creditos, templates, prompts e transacoes sao hardcoded.

Status: mockado. Nao deve ser tratado como operacional.

## 4. Auth, Cadastro, Login e Bootstrap

Arquivos centrais auditados:

- `contexts/auth-context.tsx`
- `components/auth/route-guard.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/agency/signup/page.tsx`
- `lib/auth/ensure-profile.ts`
- `lib/auth/safe-redirect.ts`
- `lib/auth/quick-access.ts`

Status atual:

- `getSession()` existe no bootstrap com timeout;
- `onAuthStateChange()` existe e atualiza `session`/`profile`;
- `refreshProfile()` nao deveria mais acionar loading global;
- `RouteGuard` usa `redirect` seguro e role do `profile` ou de `user_metadata`;
- login/cadastro nao parecem mais depender de `useEffect` para disparar auth.

Riscos residuais:

- ainda ha bastante complexidade no bootstrap para traveler, agency e quick access no mesmo fluxo;
- o comportamento “entra sozinho” pode acontecer legitimamente quando o Supabase restaura uma sessao valida, e isso precisa ser diferenciado de bug em QA;
- o portal da agencia e o portal master fazem o sistema parecer mais integrado do que realmente esta.

Checklist de auth que parece real:

- cadastro viajante -> `auth.users` + `profiles`
- login viajante -> role-based redirect
- cadastro agencia -> tentativa real de `profiles` + `agencies` + `agency_members`
- link admin sem sessao -> quick access por dispositivo ou login

## 5. Mapa do Banco e do Schema

### `profiles`

- Usada por: auth bootstrap, header, configuracoes, redirects por role.
- Status: usada de verdade.
- Policies relevantes: select/update/insert do proprio usuario; leitura global por master.
- Pontos de atencao:
  - a app depende de `profiles` existir para quase tudo do usuario;
  - `ensureProfile` ainda e uma peca critica de resiliencia.

### `agencies`

- Usada por: cadastro de agencia, potencialmente portal agencia e master.
- Status: parcialmente usada de verdade no cadastro, mas nao no portal operacional.
- Policies relevantes: select de owner/member/master; update de owner.
- Problema: o `schema.sql` base nao contem policy de insert para `agencies`; o codigo depende de SQL complementar de RLS ja documentado em fases anteriores.

### `agency_members`

- Usada por: cadastro de agencia, autorizacao por agencia, potencial futuro do portal.
- Status: parcialmente usada.
- Problema: `schema.sql` base nao contem policy de insert/update para membership; depende de SQL complementar.

### `clients`

- Usada por: deveria atender portal da agencia.
- Status: o repository ainda retorna `supabase-placeholder`.
- Problema: o portal da agencia nao esta conectado a esta tabela de forma real.

### `trips`

- Usada por: traveler portal, criacao de viagem, link publico/admin.
- Status: usada de verdade no fluxo principal do viajante.
- Colunas relevantes no codigo:
  - `owner_user_id`
  - `agency_id`
  - `client_id`
  - `slug`
  - `public_link`
  - `admin_link`
  - `visibility`
  - `status`
  - `source`
- Problemas:
  - `createTrip()` no repository sempre grava `draft`, mesmo que a expressao no codigo passe a impressao de ser dinamica;
  - `visibility` e forcada para `private` no create principal;
  - o dashboard do viajante depende corretamente do filtro por `owner_user_id`, mas a agencia ainda nao usa `trips` reais.

### `documents`

- Usada por: portal documentos, anexos do link da viagem.
- Status: parcialmente real.
- Problema estrutural:
  - o SQL de tabela e RLS existe, mas o acesso publico a documentos do link ainda nao esta formalizado de forma especifica no banco; hoje isso continua exigindo camada controlada na aplicacao.

### `trip_hotels`

- Usada por: hospedagem na pagina da viagem.
- Status: usada de verdade no admin link quando Supabase esta ativo.
- Problemas graves:
  - o SQL atual possui `unique (trip_id)`, o que conflita com a UI e com o repository, que tratam hospedagem como lista editavel;
  - nao existe policy de `delete` no SQL auditado, mas o app tenta excluir hospedagens reais;
  - `lib/supabase/types.ts` nao contem `trip_hotels`, entao o repository opera sem tipagem forte.

### Tabelas futuras ja tocadas pelo codigo

- AI: repositories ainda estao em `supabase-placeholder`.
- Creditos: repositories ainda estao em `supabase-placeholder`.

## 6. Policies RLS e SQLs Soltos

### Achados relevantes

1. `supabase/schema.sql` e coerente para a base do viajante, mas incompleto para agencia em relacao a `insert`/`membership`.
2. Existem SQLs complementares fora do schema base, como:
   - `supabase/rls_phase_2_fix.sql`
   - `supabase/documents.sql`
   - `supabase/trip_hotels.sql`
   - `supabase/storage_documents_bucket.sql`
   - `supabase/storage_profile_bucket.sql`
3. A base atual depende de rodar multiplos SQLs manuais na ordem certa.

### Riscos de RLS

- Nao foi identificado uso de `service role` no frontend.
- Nao foi identificada policy aberta com `true`.
- Porem ha risco de seguranca em Storage:
  - `storage_documents_bucket.sql` libera `select/insert/update/delete` em `storage.objects` para qualquer usuario autenticado no bucket `vuei-documents`, sem checar dono, caminho, `trip_id`, `agency_id` ou estrutura de pastas.

Esse ponto deve ser tratado como risco alto antes de uso real intensivo de anexos.

## 7. Storage

### Buckets esperados

- `vuei-documents`
- `vuei-avatars`

### `vuei-avatars`

- Finalidade: avatar do usuario.
- Modelo: bucket publico.
- Escrita/delecao por prefixo do usuario no path.
- Status: aceitavel para avatar, com politica melhor que a de documentos.

### `vuei-documents`

- Finalidade: documentos, passagens e anexos.
- Status: estruturalmente existe no plano, mas a politica atual e permissiva demais para usuarios autenticados.
- Impacto:
  - risco de leitura/escrita ampla entre usuarios autenticados, dependendo da configuracao real no projeto;
  - exige revisao antes de tratar documentos privados como confiaveis.

## 8. Links da Viagem

Status atual dos links:

- `public_link` padrao: `https://www.meuvuei.com/v/[slug]`
- `admin_link` padrao: `https://www.meuvuei.com/viagem/[slug]/admin`

Pontos positivos:

- o codigo atual ja usa `NEXT_PUBLIC_APP_URL`;
- o public link nao deve editar;
- o admin link passa por verificacao de dono com sessao;
- ha fallback seguro para quick access por dispositivo no admin.

Pontos de atencao:

- `lib/security/link-tokens.ts` ainda reconhece `admin=true`, `adminToken` e `publicToken` para compatibilidade retroativa; isso nao esta errado, mas evidencia legado ainda vivo;
- `app/portal/criar-viagem/page.tsx` tem bug no `copyLink()` que faz `https://${link}` mesmo quando `link` ja e absoluto;
- documentos publicos reais da trip exigem cuidado adicional de exposicao controlada, pois o banco nao foi modelado com uma policy publica generica para isso.

## 9. Mapa de CTAs Criticos

| CTA | Origem | Destino/Acao | Status | Observacao |
| --- | --- | --- | --- | --- |
| Criar viagem | `/portal`, `/portal/criar-viagem` | cria `trip` | Funcional real | Usa Supabase no fluxo do viajante logado. |
| Abrir viagem | dashboard do viajante | `/viagem/[slug]/admin` | Funcional real | Depende de auth/owner ou quick access. |
| Compartilhar viagem | dashboard/link | public link | Funcional real | Deve usar somente `shareLink`. |
| Copiar link admin | dashboard/criacao | copia admin link | Funcional com bug | No fluxo de criacao ha bug no prefixo `https://`. |
| Copiar link publico | dashboard/criacao | copia public link | Funcional com bug | Mesmo bug de prefixo na tela de criacao. |
| Documentos | portal/link | tela/repositorio | Parcial real | Dados reais no viajante, mas politica de storage precisa endurecer. |
| Anexar passagem | link admin | upload real de documento `ticket` | Parcial real | Sem IA, mas como anexo real. |
| Hospedagem | link admin | `trip_hotels` | Parcial real | Schema/policy divergem do comportamento esperado. |
| Roteiro | portal/link | tela de roteiro | Mock/Parcial | Ainda ha conteudo operacional mock em rotas de roteiro. |
| Concierge | portal | conversa | Mock | Repository de IA esta em placeholder. |
| Creditos | portal | tela de creditos | Mock | Repository de creditos em placeholder. |
| Configuracoes | portal/mobile avatar | `/portal/configuracoes` | Funcional real/parcial | Profile real + quick access local por dispositivo. |
| Perfil/avatar | header/configuracoes | profile/upload avatar | Parcial real | Base real existe, storage/avatar precisa validacao final. |
| Sair | header/menus | `signOut` | Funcional real | Depende de auth bootstrap estavel. |
| Portal agencia | header/rotas | `/agencia` | Estrutural | Portal existe, mas dados ainda locais/mock. |
| Portal master | rota dedicada | `/master` | Estrutural | Portal ainda mockado. |

## 10. Mapa de Dados

### Fluxo esperado do viajante

`traveler auth/profile -> trips -> dashboard -> public/admin link -> documents/hotels`

Status atual:

- auth/profile: real
- trips: real
- dashboard: real
- public/admin link: real na base da trip
- documents: parcial
- hotels: parcial

### Fluxo esperado da agencia

`agency_owner profile -> agency -> clients -> trips -> links do cliente`

Status atual:

- agency_owner auth/profile: real
- agency entity: parcialmente real no cadastro
- clients/trips do portal agencia: ainda locais/mock
- links do cliente no portal agencia: nao auditados como reais de ponta a ponta

### Fluxo esperado do master

`master profile -> leitura global de users/agencies/trips/credits`

Status atual:

- role/rota existem
- leitura global continua mockada

### Fluxo esperado de documentos/storage

`trip.id -> documents metadata -> storage object -> signed url`

Status atual:

- traveler e link admin conseguem operar parte disso
- politica do bucket de documentos ainda e insuficiente

### Fluxo esperado de profile/avatar

`auth user -> public.profiles -> header/configuracoes/avatar`

Status atual:

- base real existe
- persistencia melhorou
- ainda precisa QA manual forte em refresh/logout/login/mobile

## 11. Pontos Onde Mock Ainda Interfere Como Dado Real

### Mock alto risco

- `contexts/agency-context.tsx`: trips/clientes/atividades reais da agencia ainda sao locais e seeded.
- `contexts/master-context.tsx`: portal master inteiro continua mockado.

### Mock medio risco

- `app/portal/concierge/page.tsx`: ainda referencia operacao simulada.
- `app/portal/viagem/roteiro/page.tsx`: ainda possui conteudo de roteiro exemplo.
- `app/portal/documentos/page.tsx`: possui fluxo local de PIN proprio, paralelo ao quick access novo.
- `lib/repositories/clients-repository.ts`: `supabase-placeholder`.
- `lib/repositories/credits-repository.ts`: `supabase-placeholder`.
- `lib/repositories/ai-repository.ts`: `supabase-placeholder`.

### Mock baixo risco

- paginas legais/suporte com conteudo provisoriamente mockado, sem impacto operacional direto.

## 12. PWA e Mobile

Status atual:

- ha icones e assets de app;
- ha `app/icon.png`;
- existem componentes de PWA no projeto;
- menu inferior mobile existe no portal do usuario e da agencia;
- acesso mobile a configuracoes do usuario foi adicionado via avatar.

Lacunas:

- nao foi encontrado `manifest.ts`, `manifest.webmanifest` ou `service worker` auditavel;
- a experiencia ainda e “web app mobile” mais do que PWA operacional completo;
- o quick access por dispositivo esta coerente conceitualmente, mas precisa teste real em Safari/WhatsApp browser/PWA instalado.

## 13. Portal Master

Status:

- rota existe;
- role master existe no modelo;
- `RouteGuard` existe;
- mas o portal continua mockado por design nesta fase.

O que falta para operar:

- repositorios reais para agencias, usuarios, trips, creditos e analytics;
- consolidar leitura global via Supabase;
- remover datasets hardcoded do `MasterContext`.

## 14. Portal Agencia

Status:

- rotas existem;
- `/agency` e alias de `/agencia`;
- cadastro de agencia existe;
- papel `agency_owner` existe.

Problema central:

- o portal operacional da agencia ainda nao usa a fonte real esperada.

O que falta:

- conectar `clients-repository` ao Supabase;
- migrar `AgencyContext` de seed local para leitura/escrita real;
- ligar criacao de clientes e viagens da agencia a `clients`/`trips`;
- alinhar links gerados para cliente com os dados reais.

## 15. Problemas Criticos por Prioridade

### P0 - Impede uso real ou cria risco serio

1. `storage_documents_bucket.sql` esta permissivo demais para usuarios autenticados no bucket `vuei-documents`.
2. Portal agencia ainda usa dados locais/mock como base principal.
3. Portal master ainda usa dados mock como base principal.

### P1 - Instabilidade, perda de confianca ou divergencia forte

1. `trip_hotels` SQL diverge da UI:
   - `unique (trip_id)` limita a uma hospedagem por viagem;
   - ausencia de policy de `delete`.
2. `clients-repository`, `credits-repository` e `ai-repository` ainda retornam `supabase-placeholder`.
3. `copyLink()` em `/portal/criar-viagem` concatena `https://` com links absolutos.
4. `app/portal/documentos/page.tsx` ainda usa PIN local proprio, inconsistente com a camada de quick access.
5. Criacao real da agencia depende de RLS complementar fora do schema base.

### P2 - Melhoria necessaria antes de escalar

1. Falta `manifest`/service worker claros para PWA.
2. `lib/supabase/types.ts` nao inclui `trip_hotels`.
3. Master e agencia precisam padronizar nomes de rota e estados reais.
4. Legal/support pages ainda sao provisoriamente mockadas.

### P3 - Futuro

1. IA real.
2. Creditos reais/ledger.
3. Pagamentos.
4. Analytics operacionais do master.

## 16. Plano de Acao Recomendado

### Fase 1 - Estabilizacao obrigatoria

1. Endurecer policies do bucket `vuei-documents`.
2. Corrigir schema/policies de `trip_hotels`.
3. Corrigir `copyLink()` em `/portal/criar-viagem`.
4. Unificar o fluxo de PIN dos documentos com a estrategia de quick access.
5. Revisar bootstrap manualmente em notebook + celular + aba anonima.

### Fase 2 - Portais e dados reais

1. Conectar `clients-repository` ao Supabase.
2. Migrar `AgencyContext` para dados reais.
3. Parar de mostrar clientes/viagens seeded no portal agencia.
4. Definir se master entra em fase real agora ou permanece explicitamente “nao operacional”.

### Fase 3 - PWA/mobile

1. Criar `manifest`.
2. Definir estrategia de instalacao.
3. Testar Safari/WhatsApp browser/PWA instalado.
4. Refinar quick access por dispositivo em cenarios mobile reais.

### Fase 4 - IA, creditos e pagamentos

1. Tirar repositories de placeholder.
2. Consolidar ledger/creditos.
3. Integrar IA e billing apenas depois da base operacional real estar fechada.

## 17. SQL Recomendado

Nao executar automaticamente. Apenas recomendacao.

### 17.1 Storage de documentos

Objetivo:

- restringir `storage.objects` por owner/path, trip ou escopo seguro;
- impedir que qualquer usuario autenticado tenha acesso amplo ao bucket.

Necessidade:

- revisar `storage_documents_bucket.sql` e substituir policies bucket-wide por policies baseadas em:
  - prefixo do usuario no path; ou
  - verificacao de ownership da trip/documento; ou
  - padrao controlado de pasta por owner/trip.

### 17.2 `trip_hotels`

Objetivo:

- remover divergencia entre schema e UI.

Necessidade:

- remover a restricao `unique (trip_id)` em migracao segura futura, se o produto realmente suportar varias hospedagens por viagem;
- adicionar policy de `delete` coerente com owner/member;
- refletir a tabela em `lib/supabase/types.ts`.

### 17.3 Agencia

Objetivo:

- garantir cadastro real e operacao de owner/member sem remendos manuais dispersos.

Necessidade:

- consolidar no schema principal as policies seguras de insert/select/update para `agencies` e `agency_members` que hoje dependem de SQL complementar.

## 18. Arquivos Provaveis Para a Proxima Rodada

Prioridade alta:

- `supabase/storage_documents_bucket.sql`
- `supabase/trip_hotels.sql`
- `lib/supabase/types.ts`
- `app/portal/criar-viagem/page.tsx`
- `app/portal/documentos/page.tsx`
- `lib/repositories/clients-repository.ts`
- `contexts/agency-context.tsx`

Prioridade media:

- `contexts/master-context.tsx`
- `lib/repositories/credits-repository.ts`
- `lib/repositories/ai-repository.ts`
- `app/portal/concierge/page.tsx`
- `app/portal/viagem/roteiro/page.tsx`

Prioridade mobile/PWA:

- `app/layout.tsx`
- futuros arquivos de `manifest`
- possivel camada de SW/PWA quando o produto decidir fechar isso

## 19. Checklist Final de Testes Manuais

### Notebook

- criar conta viajante
- login/logout/login
- F5 em `/portal`
- criar viagem
- abrir dashboard
- abrir link publico
- abrir link admin
- anexar documento
- anexar passagem
- salvar hospedagem
- alterar perfil/avatar

### Celular

- abrir link publico por WhatsApp
- abrir link admin sem sessao
- usar quick access por PIN
- configurar quick access em `/portal/configuracoes`
- abrir `/portal` e `/portal/documentos`
- validar refresh em Safari/Chrome mobile

### Aba anonima

- abrir public link
- abrir admin link sem sessao
- confirmar redirect para login quando quick access nao estiver configurado

### Agencia

- cadastrar agency owner
- confirmar `profiles.role = agency_owner`
- confirmar registro em `agencies`
- confirmar membership em `agency_members`
- entrar em `/agencia`
- validar se os dados exibidos ainda sao seeded/local

### Master

- login com role master
- entrar em `/master`
- confirmar se os dados sao mock

## 20. Conclusao

O Vuei ja tem uma espinha dorsal real para o fluxo do viajante, mas ainda nao pode ser considerado “operacional inteiro” porque agencia e master nao estao no mesmo nivel de realidade do portal do usuario. A melhor ordem agora nao e adicionar feature nova: e fechar primeiro a seguranca de Storage, alinhar `trip_hotels`, migrar a agencia para dados reais e explicitar o que continua mockado para nao gerar falsa percepcao de completude.
