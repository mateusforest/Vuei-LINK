# Auth Bootstrap Audit

## Escopo auditado

- `contexts/auth-context.tsx`
- `components/auth/route-guard.tsx`
- `contexts/trips-context.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/agency/signup/page.tsx`
- `app/agencia/layout.tsx`

## Onde travava hoje

### 1. Loading global do AuthContext

O `loading` do `AuthContext` era usado para mais de um papel:

- bootstrap inicial da sessao;
- `refreshProfile()`;
- `onAuthStateChange()`;
- `signOut()`;
- finalizacao de `signIn()` e `signUp()`.

Isso criava uma condicao em que os guards protegidos (`RouteGuard`) ficavam esperando o mesmo `loading` global, mesmo quando o problema real estava apenas em `ensureProfile()` ou em um refresh secundario.

### 2. Promise sem timeout no bootstrap

O fluxo abaixo nao tinha timeout:

- `supabase.auth.getSession()`
- `ensureProfile()`
- `getAgencyByOwner()`
- `listTripsByUser()`

Se qualquer uma dessas chamadas demorasse demais ou pendurasse por rede/RLS, o app podia permanecer em `Carregando sessao...`.

### 3. Guard dependendo de profile completo

O `RouteGuard` aguardava `loading` global e avaliava o acesso principalmente pelo `profile`. Quando o `profile` atrasava, a UI autenticada ficava presa mesmo com `session.user` ja restaurado.

### 4. Botoes de login/cadastro presos por loading global

As telas:

- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/agency/signup/page.tsx`

desabilitavam o botao com `loading` do `AuthContext`. Isso fazia o CTA depender do bootstrap global, e nao apenas do estado local do formulario.

## useEffect que reexecutavam

### Auth bootstrap

`contexts/auth-context.tsx`

- havia um `useEffect` principal de bootstrap;
- `onAuthStateChange` chamava nova sincronizacao assincrona;
- `signIn()` e `signUp()` tambem sincronizavam estado localmente.

Isso nao era uma dependencia circular formal, mas criava reexecucoes sobrepostas do mesmo fluxo de sessao/profile.

### Redirecionamentos em login/cadastro

As paginas de login/cadastro tinham `useEffect` de redirect baseados em:

- `loading`
- `user`
- `profile?.role`

Com o `loading` global oscilando por motivos nao relacionados ao submit local, o redirect podia parecer instavel.

## Dependencias circulares

Nao foi encontrada dependencia circular direta entre:

- `AuthContext`
- `TripsContext`
- `RouteGuard`

Mas havia acoplamento de estado:

- `TripsContext` esperava `loading` do `AuthContext`;
- `RouteGuard` esperava `loading` do `AuthContext`;
- telas publicas tambem desabilitavam CTA por esse mesmo `loading`.

Na pratica, isso criava um gargalo unico.

## Loading que podia nunca voltar para false

### Confirmado

- `AuthContext` durante bootstrap/refresh sem timeout.

### Risco adicional

- `TripsContext` ao carregar viagens remotas sem timeout.
- `app/agencia/layout.tsx` ao carregar agencia sem timeout.

Esses dois nao bloqueavam todos os portais da mesma forma que o guard, mas podiam deixar spinners locais presos por mais tempo que o necessario.

## Correcoes aplicadas

### AuthContext

- bootstrap com timeout maximo de 10s;
- separacao pratica entre bootstrap global e acoes interativas;
- `refreshProfile()` nao liga mais o loading global;
- `onAuthStateChange()` sincroniza sessao/profile sem reativar o loading global;
- falha de profile nao trava mais a aplicacao;
- logs adicionados:
  - `[BOOT] started`
  - `[BOOT] session loaded`
  - `[BOOT] profile loaded`
  - `[BOOT] finished`

### RouteGuard

- passou a aceitar role resolvida por:
  - `profile.role`
  - ou `user.user_metadata.role`
- log de redirect:
  - `[BOOT] redirecting`

### TripsContext

- carregamento de trips com timeout de 10s;
- falha em trips nao trava portal;
- logs adicionados:
  - `[BOOT] started`
  - `[BOOT] trips loaded`
  - `[BOOT] finished`
  - `[TRIPS] loading user trips`
  - `[TRIPS] loaded trips`
  - `[TRIPS] load error`

### Agency bootstrap local

- `app/agencia/layout.tsx` passou a carregar agencia com timeout de 10s;
- falha em agencia nao trava renderizacao;
- log adicionado:
  - `[BOOT] agency loaded`

### Formularios publicos

- login/cadastro/cadastro de agencia nao desabilitam mais o CTA por `loading` global;
- CTA agora depende so de:
  - `isLoading` local;
  - campos invalidos.

## Resultado esperado

- paginas autenticadas nao devem mais ficar indefinidamente em `Carregando sessao...`;
- portal deve abrir mesmo sem trips;
- portal traveler deve abrir mesmo se profile/agencia demorarem ou falharem;
- login e cadastro nao devem ficar presos por bootstrap global.

## Pendencias honestas

- ainda existe duplicacao natural entre `signIn/signUp` e `onAuthStateChange`, mas agora ela nao deve congelar a UI;
- o comportamento de “entrar sozinho” pode continuar acontecendo quando ja existe sessao valida restaurada pelo Supabase. Isso e esperado e nao representa clique fantasma.
