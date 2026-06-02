# Vuei Admin Actions Security Report

## O que exigia login antes

- `app/viagem/[id]/page.tsx`
  - `requireSensitiveAccess()` redirecionava para login quando nao havia sessao do dono.
  - `ensureSensitiveAccess()` redirecionava para login antes de abrir o fluxo de desbloqueio.
  - `handleSaveHotel()` bloqueava por `canWrite` e mandava ao login antes de tentar salvar.
  - `handleDeleteHotel()` fazia o mesmo.
  - `handleAddDocument()` fazia o mesmo.
  - `AddFlightModal` mostrava `Entre com a conta proprietaria para anexar passagens nesta viagem`.
  - `AddDocumentModal` mostrava `Entre com a conta proprietaria para anexar documentos nesta viagem`.

## O que passou a usar PIN / Face ID

- Documentos e passagens:
  - continuam abrindo modal sem login;
  - ao anexar/salvar, exigem `ensureSensitiveAccess()`;
  - a mensagem agora orienta desbloqueio:
    - `Desbloqueie com PIN ou Face ID para anexar este documento.`
    - `Desbloqueie com PIN ou Face ID para anexar esta passagem.`
- Acoes sensiveis no link admin:
  - editar dados da viagem;
  - editar viajantes;
  - editar configuracoes da viagem;
  - salvar/excluir hospedagem;
  - anexar documentos;
  - anexar passagens.

## O que ficou livre no admin link

- Abrir `/viagem/[slug]/admin`
- Abrir modais de:
  - hospedagem
  - documentos
  - passagens
- Navegar pela pagina admin sem sessao

## Ajustes aplicados

- Removido o redirecionamento imediato para login em:
  - `requireSensitiveAccess()`
  - `ensureSensitiveAccess()`
- Hospedagem:
  - `handleSaveHotel()` nao exige mais login antes de tentar salvar
  - `handleDeleteHotel()` nao exige mais login antes de tentar excluir
- Documentos e passagens:
  - passaram a usar o `tripOwnerUserId` como referencia do dono da viagem
  - o primeiro bloqueio passou a ser PIN/Face ID, nao login
- Erros de persistencia agora mostram mensagem honesta quando o Supabase/RLS barra a escrita:
  - `Desbloqueio concluido, mas esta acao ainda exige login da conta proprietaria para salvar no banco.`

## SQL necessario?

- Nenhum SQL novo foi gerado nesta rodada.
- Motivo:
  - permitir escrita anonima em `documents` ou `trip_hotels` apenas com policy SQL seria arriscado e abriria uma superficie indevida no banco.
  - a solucao segura para salvar hospedagem e anexos sem sessao no futuro e um fluxo backend/token admin real, nao uma policy aberta.

## Limitacoes atuais de RLS

- Mesmo com o desbloqueio visual por PIN/Face ID:
  - `documents`
  - `trip_hotels`
  - uploads em `vuei-documents`
  ainda podem falhar sem sessao valida do dono, porque o Supabase continua corretamente protegido por RLS.
- Isso significa:
  - o link admin agora se comporta como o produto pede no frontend;
  - mas a persistencia sem login ainda depende de uma camada backend segura para token admin.

## Como testar no celular

1. Abrir `/viagem/[slug]/admin` sem sessao.
2. Abrir `Hospedagem` e tocar em `Adicionar`.
3. Preencher e salvar:
   - o app nao deve mandar ao login imediatamente;
   - se o banco barrar, deve mostrar erro honesto.
4. Abrir `Documentos` e tocar em `Adicionar`.
5. Selecionar arquivo:
   - o app deve pedir PIN/Face ID antes do upload;
   - nao deve mandar ao login de cara.
6. Abrir `Passagens` e tocar em `Anexar`.
7. Selecionar arquivo:
   - o app deve pedir PIN/Face ID antes do upload;
   - nao deve mandar ao login de cara.
8. Se o PIN/biometria nao estiver configurado:
   - a tela de desbloqueio deve orientar configuracao de acesso rapido;
   - o login fica como opcao secundaria, nao como primeiro bloqueio.

## Arquivos alterados

- `app/viagem/[id]/page.tsx`
