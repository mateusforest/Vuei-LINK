# Vuei Admin Security Rules Report

Data: 2026-06-02

## Regra final aplicada

- O link admin `/viagem/[slug]/admin` agora abre diretamente quando a viagem existe.
- O link publico `/v/[slug]` permanece somente leitura.
- PIN e biometria deixaram de ser bloqueio inicial da rota admin.
- PIN e biometria passam a ser exigidos apenas em acoes sensiveis.

Acoes sensiveis cobertas nesta rodada:

- desbloquear documentos privados;
- editar dados da viagem;
- salvar configuracoes da viagem;
- adicionar/editar/remover hospedagem;
- anexar documentos;
- anexar passagens;
- atualizar viajantes.

## Como o link admin abre

Fluxo final:

1. A rota `/viagem/[slug]/admin` busca a trip por `slug`.
2. Se a viagem nao existir, mostra `Viagem nao encontrada ou link expirado.`
3. Se a viagem existir:
   - o modo admin abre visualmente;
   - a rota nao exige login, PIN nem Face ID para abrir.
4. Se o usuario autenticado nao for o dono:
   - mostra `Voce nao tem permissao para editar esta viagem.`
5. Se o usuario tentar uma acao sensivel:
   - o app solicita PIN da conta ou biometria do dispositivo;
   - se a acao exigir escrita no Supabase e nao houver sessao valida do dono, o app mostra `Entre para salvar alteracoes nesta viagem.` e redireciona para login nesse momento.

## Onde o PIN e salvo

O PIN agora fica salvo em:

- `public.profiles.settings.quickAccess.enabled`
- `public.profiles.settings.quickAccess.pinHash`
- `public.profiles.settings.quickAccess.pinSalt`
- `public.profiles.settings.quickAccess.pinIterations`

O app tambem continua lendo o armazenamento local antigo apenas como compatibilidade/migracao:

- se existir PIN legado local e o profile ainda nao tiver `settings.quickAccess`, o app pode sincronizar esse hash para o profile real quando o usuario autenticado abrir Configuracoes.

## Por que Face ID / biometria e por dispositivo

Biometria continua local por design:

- WebAuthn / `PublicKeyCredential` depende do autenticador do aparelho;
- credenciais biometricas nao sao sincronizadas de forma portavel entre notebook e celular pelo app;
- por isso a biometria continua sendo configurada e validada por dispositivo.

Em resumo:

- PIN = da conta
- Face ID / biometria = do dispositivo

## SQL necessario

Nenhum SQL novo foi necessario para `profiles.settings` nesta rodada.

Motivo:

- a coluna `public.profiles.settings jsonb` ja existe no schema atual do Vuei.

## Arquivos alterados

- [lib/auth/quick-access.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/auth/quick-access.ts)
- [types/profile.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/types/profile.ts)
- [lib/auth/get-current-profile.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/auth/get-current-profile.ts)
- [lib/auth/ensure-profile.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/auth/ensure-profile.ts)
- [lib/repositories/profiles-repository.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/repositories/profiles-repository.ts)
- [app/portal/configuracoes/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/configuracoes/page.tsx)
- [app/portal/documentos/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/documentos/page.tsx)
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/[id]/page.tsx)

## Como testar no PC e no celular

### 1. PIN da conta

1. Entrar no portal com a conta dona da viagem.
2. Ir para `/portal/configuracoes`.
3. Criar um PIN.
4. Fazer logout.
5. Fazer login novamente no mesmo dispositivo.
6. Confirmar que o PIN continua ativo.
7. Entrar em outro dispositivo com a mesma conta.
8. Ir para Configuracoes e confirmar que o PIN da conta aparece como configurado.

### 2. Biometria

1. No dispositivo com suporte a WebAuthn, abrir `/portal/configuracoes`.
2. Ativar biometria.
3. Confirmar que a biometria aparece ativa apenas naquele aparelho.
4. Abrir outro aparelho sem biometria configurada e confirmar que a biometria nao aparece como ativa automaticamente.

### 3. Link admin

1. Abrir `/viagem/[slug]/admin` sem login.
2. Confirmar que a viagem abre.
3. Clicar em uma acao sensivel, como salvar hospedagem ou anexar documento.
4. Confirmar:
   - sem sessao valida do dono, o app pede login somente nesse momento;
   - com sessao valida do dono, o app pede PIN da conta ou biometria antes da acao sensivel.

### 4. Documentos privados

1. Abrir o admin da viagem como dono autenticado.
2. Tentar abrir documentos privados.
3. Confirmar que a tela pede PIN da conta ou biometria local.
4. Confirmar que PIN invalido nao desbloqueia.

## Limitacoes restantes

1. Documentos privados sem sessao do dono continuam limitados pelo backend real:
   - sem sessao autenticada do dono, a rota admin abre;
   - mas o carregamento de documentos privados do Supabase continua sujeito a RLS.
2. Isso significa que:
   - a regra de abertura do admin foi ajustada;
   - a regra de seguranca das acoes sensiveis foi ajustada;
   - mas leitura de dados privados reais sem sessao ainda depende do backend permitir esse acesso de forma segura no futuro.
3. Nao foi criada nenhuma backdoor para contornar RLS.
4. Nao foi usado `service role` no frontend.
