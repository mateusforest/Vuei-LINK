# Vuei Production Readiness Report

Data da auditoria: 2026-06-03

## Resumo geral

O Vuei esta funcional de ponta a ponta nos fluxos principais de viajante, agencia e leitura master quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`, mas ainda nao esta 100% pronto para producao sem pendencias. O nucleo real hoje passa por `profiles`, `agencies`, `agency_members`, `clients`, `trips`, `documents` e parte de `trip_hotels`. Os principais riscos restantes estao em:

- schema real do Concierge ainda dependente de SQL manual no Supabase;
- drift potencial entre SQL versionado e banco real;
- restos de fallback/localStorage em contexts e repositories fora do fluxo principal;
- modulo de equipe/agencia e modulos de creditos/IA ainda nao totalmente operacionais;
- escritas anonimas em admin/public link corretamente bloqueadas por RLS, mas ainda sem backend/token seguro para alguns casos do produto.

## 1. Auth

- Status: OK
- Evidencia: [contexts/auth-context.tsx](./contexts/auth-context.tsx) faz bootstrap com `getSession`, `onAuthStateChange`, `ensureProfile` e timeout; [components/auth/route-guard.tsx](./components/auth/route-guard.tsx) protege `/portal`, `/agencia` e `/master`.
- Tabela utilizada: `public.profiles` e `auth.users`
- Repository utilizado: [lib/auth/ensure-profile.ts](./lib/auth/ensure-profile.ts), [lib/auth/get-current-profile.ts](./lib/auth/get-current-profile.ts)
- Rotas utilizadas: `/login`, `/signup`, `/agency/signup`, `/portal`, `/agencia`, `/master`
- Riscos: guards sao client-side; timeout/falha de sessao ainda depende da qualidade da rede do cliente.
- Melhorias futuras: adicionar validacao server-side por layout/headers se o produto exigir endurecimento maior.

## 2. Profiles

- Status: OK
- Evidencia: [lib/repositories/profiles-repository.ts](./lib/repositories/profiles-repository.ts) faz `getProfile`, `updateProfile`, `listProfiles`; [app/portal/configuracoes/page.tsx](./app/portal/configuracoes/page.tsx) e [app/agencia/configuracoes/page.tsx](./app/agencia/configuracoes/page.tsx) consomem profile real quando Supabase esta ativo.
- Tabela utilizada: `public.profiles`
- Repository utilizado: [lib/repositories/profiles-repository.ts](./lib/repositories/profiles-repository.ts)
- Rotas utilizadas: `/portal/configuracoes`, `/agencia/configuracoes`, `/master/usuarios`
- Riscos: ainda existe fallback local para modo sem Supabase; drift entre `settings.quickAccess` no banco e estado local de biometria por dispositivo.
- Melhorias futuras: reduzir leituras paralelas de `localStorage` nas paginas de configuracao.

## 3. Agency

- Status: Parcial
- Evidencia: [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts) cria e atualiza agencia real; [contexts/agency-context.tsx](./contexts/agency-context.tsx) carrega workspace real por `agency_id`/`owner_user_id`; [app/agencia/page.tsx](./app/agencia/page.tsx) usa dados reais.
- Tabela utilizada: `public.agencies`
- Repository utilizado: [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts)
- Rotas utilizadas: `/agency/signup`, `/agencia`, `/agencia/configuracoes`
- Riscos: ainda ha estados locais para atividades, creditos e algumas preferencias da agencia fora do backend.
- Melhorias futuras: mover atividades internas da agencia para tabela real.

## 4. Agency Members

- Status: Parcial
- Evidencia: o repository suporta leitura e escrita real em [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts), mas [contexts/agency-context.tsx](./contexts/agency-context.tsx) ainda trata `teamMembers` como estado local e [app/agencia/equipe/page.tsx](./app/agencia/equipe/page.tsx) nao persiste a equipe no Supabase de ponta a ponta.
- Tabela utilizada: `public.agency_members`
- Repository utilizado: [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts)
- Rotas utilizadas: `/agencia/equipe`, `/master/agencias`
- Riscos: UI de equipe pode parecer operacional sem refletir completamente a tabela real.
- Melhorias futuras: conectar `addTeamMember`, `updateTeamMember` e `removeTeamMember` do contexto aos repositories reais.

## 5. Clients

- Status: OK
- Evidencia: [lib/repositories/clients-repository.ts](./lib/repositories/clients-repository.ts) implementa `listClients`, `createClient`, `updateClient`, `deleteClient`; [app/agencia/clientes/page.tsx](./app/agencia/clientes/page.tsx) mostra erro real quando falha.
- Tabela utilizada: `public.clients`
- Repository utilizado: [lib/repositories/clients-repository.ts](./lib/repositories/clients-repository.ts)
- Rotas utilizadas: `/agencia/clientes`, `/master`
- Riscos: exclusao fisica e permitida; se o produto quiser historico, faltara soft delete.
- Melhorias futuras: relacao mais rica de clientes com documentos e concierge no portal da agencia.

## 6. Trips

- Status: OK
- Evidencia: [lib/repositories/trips-repository.ts](./lib/repositories/trips-repository.ts) cria/lê/atualiza/exclui `trips`; [app/portal/criar-viagem/page.tsx](./app/portal/criar-viagem/page.tsx) e [app/agencia/viagens/criar/page.tsx](./app/agencia/viagens/criar/page.tsx) persistem no banco; [contexts/trips-context.tsx](./contexts/trips-context.tsx) recarrega trips reais no refresh.
- Tabela utilizada: `public.trips`
- Repository utilizado: [lib/repositories/trips-repository.ts](./lib/repositories/trips-repository.ts)
- Rotas utilizadas: `/portal`, `/portal/criar-viagem`, `/agencia/viagens`, `/agencia/viagens/criar`, `/master/viagens`
- Riscos: o contexto do viajante ainda espelha `localStorage` para compatibilidade e pending trip antes do login.
- Melhorias futuras: remover espelhamento local quando a migracao total estiver aprovada.

## 7. Trip Hotels

- Status: Parcial
- Evidencia: [lib/repositories/trip-hotels-repository.ts](./lib/repositories/trip-hotels-repository.ts) existe e a pagina da viagem usa a tabela real; o SQL versionado esta em [supabase/trip_hotels.sql](./supabase/trip_hotels.sql).
- Tabela utilizada: `public.trip_hotels`
- Repository utilizado: [lib/repositories/trip-hotels-repository.ts](./lib/repositories/trip-hotels-repository.ts)
- Rotas utilizadas: `/viagem/[slug]/admin`, `/v/[slug]`
- Riscos: modulo depende da tabela/schema aplicados exatamente como no SQL; nao ha gestao ampla de hospedagem em todos os portais.
- Melhorias futuras: expor hospedagens reais tambem no portal do viajante/agencia com CRUD unificado.

## 8. Documents

- Status: Parcial
- Evidencia: [lib/repositories/documents-repository.ts](./lib/repositories/documents-repository.ts) faz upload, metadata, listagem e signed URL; [app/portal/documentos/page.tsx](./app/portal/documentos/page.tsx) e [app/agencia/documentos/page.tsx](./app/agencia/documentos/page.tsx) usam fluxo real.
- Tabela utilizada: `public.documents`
- Repository utilizado: [lib/repositories/documents-repository.ts](./lib/repositories/documents-repository.ts)
- Rotas utilizadas: `/portal/documentos`, `/agencia/documentos`, `/viagem/[slug]/admin`, `/v/[slug]`
- Riscos: depende de buckets/policies aplicados manualmente; documentos publicos em link dependem da policy e dos metadados corretos.
- Melhorias futuras: consolidar uma politica unica de signed URL e auditoria de downloads.

## 9. Concierge

- Status: Incompleto
- Evidencia: [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts) ja aponta para `public.ai_conversations` e `public.ai_messages`, mas a camada real depende de [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql); o erro conhecido em producao foi `Could not find the table 'public.ai_conversations' in the schema cache`.
- Tabela utilizada: `public.ai_conversations`, `public.ai_messages`
- Repository utilizado: [lib/repositories/ai-repository.ts](./lib/repositories/ai-repository.ts)
- Rotas utilizadas: `/portal/concierge`, `/agencia/concierge`, `/master/concierge`, `/viagem/[slug]/admin`, `/v/[slug]`
- Riscos: sem o SQL aplicado, o modulo nao persiste; sem sessao, o link nao pode gravar historico real com RLS segura.
- Melhorias futuras: backend/token curto para permitir persistencia segura no link sem abrir policy anonima.

## 10. Public Links

- Status: Parcial
- Evidencia: [app/v/[id]/page.tsx](./app/v/[id]/page.tsx) aponta para a pagina da viagem; [app/viagem/[id]/page.tsx](./app/viagem/[id]/page.tsx) trata modo publico/leitura por slug e usa dados reais da trip, documentos publicos e hospedagens.
- Tabela utilizada: `public.trips`, `public.documents`, `public.trip_hotels`
- Repository utilizado: [lib/repositories/trips-repository.ts](./lib/repositories/trips-repository.ts), [lib/repositories/documents-repository.ts](./lib/repositories/documents-repository.ts), [lib/repositories/trip-hotels-repository.ts](./lib/repositories/trip-hotels-repository.ts)
- Rotas utilizadas: `/v/[slug]`
- Riscos: concierge anonimo ainda nao persiste; leitura depende de a trip existir com slug e visibilidade coerentes.
- Melhorias futuras: endurecer ainda mais a separacao entre secoes publicas e privadas por projection/view.

## 11. Admin Links

- Status: Parcial
- Evidencia: [app/viagem/[id]/page.tsx](./app/viagem/[id]/page.tsx) abre `/viagem/[slug]/admin` por slug real; acoes sensiveis usam PIN/biometria em [lib/auth/quick-access.ts](./lib/auth/quick-access.ts).
- Tabela utilizada: `public.trips`, `public.documents`, `public.trip_hotels`, `public.profiles`
- Repository utilizado: trips/documents/trip-hotels/profiles repositories
- Rotas utilizadas: `/viagem/[slug]/admin`
- Riscos: sem sessao do dono, RLS ainda bloqueia escritas reais em algumas operacoes; isso esta correto do ponto de vista de seguranca, mas ainda nao entrega toda a promessa do produto.
- Melhorias futuras: camada backend/token admin de curta duracao para escrita segura sem login tradicional.

## 12. Branding

- Status: Parcial
- Evidencia: [app/agencia/configuracoes/page.tsx](./app/agencia/configuracoes/page.tsx) salva nome/logo/branding em `agencies`; [app/agencia/layout.tsx](./app/agencia/layout.tsx) le `agency.logo` / `agency.branding.logoUrl`.
- Tabela utilizada: `public.agencies`, `public.profiles`
- Repository utilizado: [lib/repositories/agencies-repository.ts](./lib/repositories/agencies-repository.ts), [lib/repositories/profiles-repository.ts](./lib/repositories/profiles-repository.ts)
- Rotas utilizadas: `/agencia/configuracoes`, `/agencia`
- Riscos: ainda ha `mockPlans` e persistencia auxiliar em `localStorage` na tela de configuracoes da agencia.
- Melhorias futuras: separar branding real de preferencias puramente locais da UI.

## 13. Master

- Status: Parcial
- Evidencia: [contexts/master-context.tsx](./contexts/master-context.tsx) agrega leitura real de `profiles`, `agencies`, `agency_members`, `clients`, `trips`, `documents` e `concierge`; [app/master/page.tsx](./app/master/page.tsx) e listagens mostram zero honesto sem mocks.
- Tabela utilizada: `public.profiles`, `public.agencies`, `public.agency_members`, `public.clients`, `public.trips`, `public.documents`, `public.ai_*`
- Repository utilizado: profiles/agencies/clients/trips/documents/ai repositories
- Rotas utilizadas: `/master`, `/master/usuarios`, `/master/agencias`, `/master/viagens`, `/master/analytics`, `/master/concierge`
- Riscos: varios modulos do master ainda sao somente leitura ou `noop` (`templates`, `ia`, `creditos`, `financeiro`, configuracoes globais).
- Melhorias futuras: ou operacionalizar esses modulos, ou escondelos antes do lancamento comercial.

## 14. Storage Buckets

- Status: Parcial
- Evidencia: arquivos [supabase/storage_documents_bucket.sql](./supabase/storage_documents_bucket.sql) e [supabase/storage_profile_bucket.sql](./supabase/storage_profile_bucket.sql) versionam a configuracao esperada.
- Tabela utilizada: `storage.buckets`, `storage.objects`
- Repository utilizado: [lib/repositories/documents-repository.ts](./lib/repositories/documents-repository.ts) e uploads em configuracoes
- Rotas utilizadas: `/portal/documentos`, `/agencia/documentos`, `/portal/configuracoes`, `/agencia/configuracoes`
- Riscos: configuracao depende de execucao manual no Supabase; bucket de avatar e publico por design.
- Melhorias futuras: checklist automatizado para validar buckets/policies em pre-deploy.

## 15. RLS Policies

- Status: Parcial
- Evidencia: [supabase/schema.sql](./supabase/schema.sql), [supabase/documents.sql](./supabase/documents.sql), [supabase/trip_hotels.sql](./supabase/trip_hotels.sql), [supabase/agency_persistence_fix.sql](./supabase/agency_persistence_fix.sql) e [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql) definem a politica esperada.
- Tabela utilizada: todas as tabelas centrais
- Repository utilizado: todos os repositories Supabase dependem dessas policies
- Rotas utilizadas: transversal ao sistema inteiro
- Riscos: drift entre o SQL versionado e o banco real; parte do banco foi montada em rodadas manuais.
- Melhorias futuras: consolidar migrations oficiais e checklist de aplicacao por ambiente.

## 16. Repositories

- Status: Parcial
- Evidencia: `trips`, `profiles`, `clients`, `agencies`, `documents`, `trip-hotels` e parte de `ai` estao reais; `credits-repository` continua placeholder de leitura; varios repositories ainda tem branch `supabase-placeholder`.
- Tabela utilizada: conforme modulo
- Repository utilizado: [lib/repositories](./lib/repositories)
- Rotas utilizadas: transversal
- Riscos: placeholder/branch local podem mascarar ambiente mal configurado se a UI nao tratar erro com clareza.
- Melhorias futuras: remover branches `supabase-placeholder` quando a configuracao de ambiente estiver consolidada.

## 17. Contexts

- Status: Parcial
- Evidencia: [contexts/auth-context.tsx](./contexts/auth-context.tsx) esta estavel; [contexts/master-context.tsx](./contexts/master-context.tsx) e [contexts/agency-context.tsx](./contexts/agency-context.tsx) leem Supabase real; [contexts/trips-context.tsx](./contexts/trips-context.tsx) ainda mantem espelhamento local e pending trip.
- Tabela utilizada: conforme contexto
- Repository utilizado: trips/agencies/clients/documents/ai/profiles
- Rotas utilizadas: `/portal/**`, `/agencia/**`, `/master/**`
- Riscos: contexts da agencia ainda seguram estados nao persistidos em `teamMembers`, `activities`, `credits`; traveler ainda persiste localmente por compatibilidade.
- Melhorias futuras: quebrar estados operacionais locais remanescentes em repositories reais ou marcar explicitamente como locais.

## 18. Persistencia real

- Status: Parcial
- Evidencia: viajante, agencia e master ja leem/escrevem dados reais em `profiles`, `agencies`, `agency_members`, `clients`, `trips` e `documents`; concierge ainda nao esta completo sem SQL; equipe, creditos e alguns submodulos continuam locais ou honestamente nao operacionais.
- Tabela utilizada: `public.profiles`, `public.agencies`, `public.agency_members`, `public.clients`, `public.trips`, `public.documents`, `public.trip_hotels`, `public.ai_*`
- Repository utilizado: modulo a modulo
- Rotas utilizadas: sistema inteiro
- Riscos: a persistencia real ainda nao cobre 100% dos modulos visiveis do produto.
- Melhorias futuras: finalizar Concierge, equipe, creditos e roteiros IA antes de chamar o sistema de totalmente integrado.

## Observacoes de rotas e evidencias adicionais

- `/portal/creditos` e `/agencia/creditos`: estado honesto de “Em breve”, sem backend real de creditos.
- `/agencia/roteiros-ia`: ainda usa `localStorage` e alerts honestos de integracao pendente.
- `/termos`, `/privacidade`, `/suporte`: texto ainda explicitamente mockado/demonstrativo.
- `/master/templates`, `/master/ia`, `/master/financeiro`, `/master/creditos`: telas existem, mas o contexto do master ainda expoe varias acoes como `noop`.
- `/viagem/[slug]/admin` e `/v/[slug]`: usam slug correto e UUID real internamente, mas a persistencia anonima do concierge ainda esta bloqueada por desenho seguro de RLS.

## Checklist final

### Produção

- [ ] pronto
- [x] pendencias

### Itens bloqueantes

- Concierge ainda sem camada real ativa no banco enquanto [supabase/ai_conversations_setup.sql](./supabase/ai_conversations_setup.sql) nao for aplicado.
- Parte dos modulos visiveis do produto ainda nao esta totalmente operacional em dados reais: equipe da agencia, creditos e roteiros IA.
- Possivel drift entre SQL versionado e banco real por depender de aplicacoes manuais anteriores.

### Itens nao bloqueantes

- Textos e paginas informativas ainda mencionam ambiente mockado.
- Alguns estados locais continuam existindo como compatibilidade/dev fallback quando Supabase nao esta ativo.
- Master possui secoes que sao honestamente somente leitura ou placeholder operacional.

### Prioridade

- Alta: Concierge schema/RLS e consolidacao final de RLS/buckets aplicados no ambiente real.
- Media: equipe da agencia, creditos e limpeza de estados locais remanescentes.
- Baixa: textos informativos mockados, polimento de modulos futuros do master.
