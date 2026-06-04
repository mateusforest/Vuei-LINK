# Vuei Agency Team Real Data Report

## O que era local/mock

- [contexts/agency-context.tsx](./contexts/agency-context.tsx) mantinha `teamMembers` apenas em estado local quando o resto do workspace da agencia ja vinha do Supabase.
- [app/agencia/equipe/page.tsx](./app/agencia/equipe/page.tsx) tratava o fluxo de convite como operacional, mas apenas criava itens em memoria/local.
- A leitura real de `public.agency_members` ja existia em [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts), mas nao estava sendo usada pelo contexto da agencia.

## O que virou real

- O `refreshAgencyWorkspace()` agora carrega membros reais via `listAgencyMembers(agencyId)`.
- O owner passa a aparecer como membro real quando existir em `public.agency_members`.
- Adicionar membro agora:
  - exige `agencyId` real;
  - procura o email em `public.profiles`;
  - se o profile existir, cria o vinculo em `public.agency_members`;
  - sincroniza `public.profiles.role = agency_member` e `public.profiles.agency_id`;
  - se o profile nao existir, mostra estado honesto: `Convite de novo usuario ainda depende de fluxo de convite.`
- Editar role/status agora persiste via `updateAgencyMember`.
- Remover membro agora persiste como desativacao (`status = inactive`) em vez de apenas sumir localmente.
- Na desativacao, o profile vinculado volta para `role = traveler` e `agency_id = null`.
- O owner nao pode ser alterado nem removido pela tela.

## Arquivos alterados

- [app/agencia/equipe/page.tsx](./app/agencia/equipe/page.tsx)
- [contexts/agency-context.tsx](./contexts/agency-context.tsx)
- [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts)
- [supabase/agency_members_rls_review.sql](./supabase/agency_members_rls_review.sql)

## SQL necessario

- Nenhum SQL foi executado automaticamente.
- Arquivo de revisao criado:
  - [supabase/agency_members_rls_review.sql](./supabase/agency_members_rls_review.sql)

Ele existe para conferir se o ambiente real possui as policies esperadas de `select`, `insert` e `update` em `public.agency_members`.

## Como testar adicionar membro existente

1. Garantir que o usuario convidado ja exista em `public.profiles`.
2. Entrar como `agency_owner`.
3. Abrir `/agencia/equipe`.
4. Clicar em `Convidar`.
5. Informar nome e email que ja existe em `profiles`.
6. Confirmar que:
   - o membro aparece na lista;
   - o registro aparece em `public.agency_members`;
   - nao ha sucesso visual se o insert falhar.

## Como testar editar/remover membro

1. Abrir o menu do membro na tela `/agencia/equipe`.
2. Alterar funcao para `admin`, `agente` ou `gerente`.
3. Confirmar que a role atualiza em `public.agency_members`.
4. Clicar em `Desativar`.
5. Confirmar que o `status` muda para `inactive` no banco.
6. Validar que o owner nao permite alteracao nem remocao.

## Limitacoes restantes

- Criacao de novo usuario convidado ainda nao existe nesta rodada, porque o frontend nao deve criar `auth.users` manualmente.
- O fluxo atual vincula apenas emails ja existentes em `public.profiles`.
- A remocao foi modelada como desativacao para manter seguranca e evitar depender de `delete policy` nesta fase.
