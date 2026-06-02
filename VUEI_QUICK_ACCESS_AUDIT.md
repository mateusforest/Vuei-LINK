# Vuei Quick Access Audit

## Status atual do PIN / Face ID

O Vuei ja tinha uma base real de acesso rapido implementada antes desta rodada:

- `PIN` com hash + salt;
- armazenamento local por dispositivo em `localStorage`;
- tentativa de sincronizacao do PIN da conta via `public.profiles.settings.quickAccess`;
- biometria por dispositivo usando `WebAuthn / PublicKeyCredential` quando suportado;
- fallback seguro para login quando a conta ou o dispositivo nao conseguem validar o acesso.

O ponto que ainda estava inconsistente era a entrada do link admin:

- o portal ja possuia configuracao de PIN/biometria;
- a pagina da viagem ja possuia modal de desbloqueio sensivel;
- mas o `/viagem/[slug]/admin` ainda nao usava esse fluxo como gate inicial de acesso no celular sem sessao.

## Estava mockado ou funcional?

- `PIN`: funcional, com hash + salt, sem texto puro.
- `Biometria`: funcional apenas quando o navegador/dispositivo oferece suporte real a WebAuthn.
- `Configuracao em /portal/configuracoes`: funcional.
- `Gate inicial do link admin sem sessao`: incompleto antes desta rodada.

## Regra aplicada nesta rodada

Para ` /viagem/[slug]/admin `:

1. Se a viagem nao existe:
   - mostra `Viagem nao encontrada ou link expirado.`

2. Se existe sessao Supabase valida:
   - dono abre normalmente;
   - usuario autenticado sem ser dono recebe `Voce nao tem permissao para editar esta viagem.`

3. Se nao existe sessao:
   - o sistema verifica se este dispositivo tem acesso rapido configurado para o `owner_user_id` da viagem;
   - se existir PIN/biometria local, mostra tela curta de desbloqueio;
   - se nao existir, redireciona para `/login?redirect=/viagem/[slug]/admin`.

4. Depois do desbloqueio:
   - a tela admin abre sem login tradicional;
   - escrita real no banco ainda pode continuar limitada por RLS quando nao houver sessao valida.

## Arquivos alterados

- `app/viagem/[id]/page.tsx`
- `VUEI_QUICK_ACCESS_AUDIT.md`

## Decisoes de seguranca

- nenhum backdoor foi criado;
- o link admin nao libera acesso so por conhecer a URL;
- o desbloqueio sem sessao depende de um segredo local do dispositivo:
  - PIN local valido para o `owner_user_id` da viagem;
  - ou credencial biometrica WebAuthn registrada neste dispositivo;
- `public_token` nao foi usado para edicao;
- nenhuma policy RLS foi afrouxada;
- nenhuma chave foi exposta;
- nao houve uso de service role no frontend.

## Limitacoes tecnicas

Mesmo apos o desbloqueio sem sessao:

- o frontend consegue liberar a experiencia de entrada no modo admin;
- mas operacoes de escrita que dependem de tabelas protegidas por RLS ainda podem exigir sessao valida do dono.

Em outras palavras:

- o acesso rapido resolve a entrada no link admin sem transformar o Vuei em um portal tradicional;
- mas nao substitui autenticacao backend para escrita real em tabelas protegidas.

## Como testar no celular

### Cenario 1: sem sessao e sem acesso rapido configurado

1. Abrir `/viagem/[slug]/admin` em navegador mobile sem login.
2. Confirmar que:
   - se a viagem existir;
   - e nao houver PIN/biometria configurados neste dispositivo;
   - o app redireciona para `/login?redirect=/viagem/[slug]/admin`.

### Cenario 2: sem sessao e com PIN configurado neste dispositivo

1. Fazer login no portal.
2. Ir em `/portal/configuracoes`.
3. Configurar PIN.
4. Encerrar a sessao.
5. Abrir `/viagem/[slug]/admin`.
6. Confirmar que:
   - aparece a tela curta de desbloqueio;
   - o usuario pode usar `PIN`;
   - se o PIN estiver correto, o admin abre.

### Cenario 3: sem sessao e com biometria configurada neste dispositivo

1. Fazer login no portal.
2. Ir em `/portal/configuracoes`.
3. Ativar biometria em dispositivo/navegador com suporte a WebAuthn.
4. Encerrar a sessao.
5. Abrir `/viagem/[slug]/admin`.
6. Confirmar que:
   - aparece a tela curta de desbloqueio;
   - o botao `Usar Face ID / biometria` fica visivel;
   - a validacao biometrica libera a abertura.

### Cenario 4: sessao valida mas usuario nao e o dono

1. Fazer login com outra conta.
2. Abrir `/viagem/[slug]/admin`.
3. Confirmar a mensagem:
   - `Voce nao tem permissao para editar esta viagem.`

## Proximos passos recomendados

1. Padronizar visualmente a tela curta de desbloqueio como componente dedicado do produto, sem mudar a regra aplicada agora.
2. Se o produto quiser escrita real sem login pelo link admin, isso precisara de camada backend/token admin real, nao de relaxamento de RLS.
3. Validar em iPhone Safari, Android Chrome, PWA instalado e navegador interno do WhatsApp para confirmar comportamento do WebAuthn.
