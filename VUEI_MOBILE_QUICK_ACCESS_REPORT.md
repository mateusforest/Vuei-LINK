# Vuei Mobile Quick Access Report

## Por que o PIN do PC nao funcionava no celular

- O acesso rapido do Vuei foi desenhado para ser **por dispositivo**.
- O PIN nao viaja entre aparelhos e nao fica no Supabase em texto puro.
- No commit anterior, o PIN era salvo localmente com hash + salt no navegador/dispositivo onde foi configurado.
- Resultado: configurar o PIN no notebook nao tornava o PIN disponivel no celular.
- Como o mobile nao tinha um caminho claro para `Configuracoes`, o usuario nao conseguia preparar o proprio dispositivo para abrir o link admin com acesso rapido.

## Onde o acesso a Configuracoes foi adicionado no mobile

- Em [app/portal/layout.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/layout.tsx), o avatar do topo mobile agora abre `/portal/configuracoes`.
- Foi o menor ajuste visual possivel, sem alterar o menu inferior nem o layout geral.

## O que foi ajustado em Configuracoes

- Em [app/portal/configuracoes/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/configuracoes/page.tsx):
  - adicionei um card claro de `Acesso rapido neste dispositivo`;
  - o texto agora explica:
    - `O PIN e salvo apenas neste dispositivo.`
    - `Para usar o acesso rapido neste celular, configure o PIN aqui.`
  - o card mostra o status local de PIN e biometria;
  - se o usuario vier do fluxo do link admin, a pagina mostra orientacao adicional e oferece `Voltar para a viagem`.

## Como configurar PIN no celular

1. Fazer login normalmente no portal.
2. Tocar no avatar do topo mobile.
3. Abrir `Configuracoes`.
4. Entrar em `PIN de seguranca`.
5. Criar ou alterar o PIN de 4 digitos neste dispositivo.
6. Opcionalmente ativar `Face ID / Biometria` se o navegador oferecer suporte real a WebAuthn/passkey.

## Como testar o link admin

1. No notebook, criar ou localizar uma viagem e copiar `/viagem/[slug]/admin`.
2. No celular sem sessao ativa:
   - abrir o link admin;
   - se o celular ja tiver PIN/biometria configurados para aquele owner, a tela curta de desbloqueio aparece;
   - se nao tiver, a tela agora oferece:
     - `Entrar com login`
     - `Configurar acesso rapido neste dispositivo`
3. Ao escolher configurar o acesso rapido:
   - o sistema envia para login;
   - depois do login, volta para `/portal/configuracoes?quickAccess=1...`;
   - o usuario configura PIN/biometria;
   - depois pode voltar para o link admin.

## Arquivos alterados

- [app/portal/layout.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/layout.tsx)
- [app/portal/configuracoes/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/configuracoes/page.tsx)
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/[id]/page.tsx)

## Limitacoes restantes

- Sem sessao Supabase valida, o Vuei ainda nao deve escrever em dados protegidos por RLS.
- O acesso rapido libera o fluxo de entrada e leitura/controle local do admin link, mas operacoes persistentes podem continuar exigindo login do dono.
- Em navegadores embutidos, como alguns webviews de WhatsApp, a biometria pode nao estar disponivel. Nesses casos, o fallback seguro continua sendo PIN local ou login.
