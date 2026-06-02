# Vuei Quick Access Audit

## Status atual encontrado

- O toggle de `Face ID / Biometria` existia em [app/portal/configuracoes/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/configuracoes/page.tsx), mas era apenas preferencia visual.
- O PIN tambem existia na mesma pagina, mas ficava em estado/localStorage comum e havia valor mockado em texto puro.
- A pagina da viagem em [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/[id]/page.tsx) tinha um modal de PIN mockado que aceitava qualquer 4 digitos e ate mostrava `Use 1234 para testar`.
- Nao havia WebAuthn/passkey real implementado.
- O fluxo admin ia direto para login quando nao havia sessao.

## O que foi corrigido

- Criei a camada local segura em [lib/auth/quick-access.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/auth/quick-access.ts).
- O PIN agora:
  - e por dispositivo;
  - usa hash local com `PBKDF2 + SHA-256`;
  - usa `salt` aleatorio;
  - nao fica salvo em texto puro.
- A biometria agora:
  - so pode ser ativada se `WebAuthn/PublicKeyCredential` estiver disponivel;
  - registra credencial local do dispositivo;
  - nao finge suporte quando o navegador nao oferece.
- O link admin `/viagem/[slug]/admin` agora:
  - tenta identificar a viagem por `slug`;
  - se nao houver sessao, verifica se existe acesso rapido configurado para o `owner_user_id` daquela viagem;
  - mostra tela curta de desbloqueio por PIN/biometria quando disponivel;
  - so manda para `/login?redirect=...` quando o acesso rapido nao estiver configurado.
- O modal de documentos privados dentro da pagina da viagem passou a usar o mesmo PIN seguro por dispositivo.

## Arquivos alterados

- [lib/auth/quick-access.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/auth/quick-access.ts)
- [app/portal/configuracoes/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/configuracoes/page.tsx)
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/[id]/page.tsx)

## Decisoes de seguranca

- Nao usei `service role`.
- Nao desativei RLS.
- Nao usei `public_token` para liberar edicao.
- O acesso rapido e amarrado ao `owner_user_id` da viagem e ao dispositivo.
- O PIN nao fica em texto puro.
- A biometria usa `WebAuthn` apenas quando o navegador realmente suporta.

## Limitacoes tecnicas importantes

- Sem sessao Supabase valida, o Vuei nao pode gravar em tabelas protegidas por RLS de forma segura.
- Por isso, o desbloqueio rapido no `/admin` libera o acesso rapido ao modo administrador da tela, mas operacoes de escrita que dependem do Supabase ainda podem exigir login do dono.
- Em navegadores embutidos, como alguns webviews de WhatsApp, o suporte a WebAuthn pode nao existir. Nesses casos, o fallback seguro e PIN ou login.
- O arquivo [app/portal/documentos/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/documentos/page.tsx) ainda possui fluxo proprio antigo de PIN e merece alinhamento numa proxima rodada, se quisermos unificar toda a experiencia de documentos.

## Como testar no celular

1. Entrar no portal com a conta dona da viagem.
2. Abrir `Configuracoes`.
3. Configurar um PIN de 4 digitos.
4. Opcionalmente ativar biometria se o dispositivo oferecer suporte.
5. Copiar o link admin `/viagem/[slug]/admin`.
6. Abrir esse link no celular sem sessao ativa.
7. Validar:
   - aparece a tela `Desbloqueie para editar esta viagem`;
   - aparece `Usar PIN`;
   - aparece `Usar Face ID / biometria` apenas se houver suporte e configuracao;
   - se o PIN estiver certo, a tela admin abre;
   - se o acesso rapido nao estiver configurado, o fluxo vai para `/login?redirect=...`.

## Proximos passos recomendados

- Criar uma sessao curta server-side para acesso rapido admin, se o produto realmente quiser permitir escrita sem login tradicional.
- Unificar o PIN dos documentos do portal com a mesma camada de `quick-access`.
- Criar expiracao curta de desbloqueio por dispositivo para o admin link.
