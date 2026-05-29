# Production Readiness Checklist

## 1. Build

- [x] `npm run build` executa com sucesso
- [x] warning conhecido documentado: lockfiles multiplos e raiz do Turbopack
- [x] `turbopack.root` fixado em [next.config.mjs](/abs/path/next.config.mjs)
- [x] paginas com `useSearchParams` ja foram estabilizadas para build
- [x] rota dinamica principal `/viagem/[id]` compila
- [ ] remover `typescript.ignoreBuildErrors` antes da ida real para producao

## 2. Ambiente

- [x] existe [.env.example](/abs/path/.env.example)
- [x] variaveis publicas atuais documentadas:
  - `NEXT_PUBLIC_USE_SUPABASE_DATA`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] validar variaveis futuras de producao por ambiente
- [x] nenhuma chave real foi adicionada ao repositorio auditado

## 3. Supabase

- [x] SQL base preparado para `profiles`, `agencies`, `agency_members`, `clients`, `trips`
- [x] SQL preparado para `documents`
- [x] SQL preparado para `ai_*`
- [x] RLS inicial documentado
- [ ] aplicar migrations reais no projeto Supabase
- [ ] validar nomes finais das tabelas e relacoes
- [ ] confirmar envs reais antes de habilitar feature flag

## 4. Storage

- [x] bucket `vuei-documents` documentado
- [x] signed URLs previstas
- [x] documentos privados planejados como privados por padrao
- [ ] criar bucket real
- [ ] aplicar policies reais de storage
- [ ] testar upload real com arquivos permitidos

## 5. Auth

- [ ] integrar login real
- [ ] integrar signup real
- [ ] criar bootstrap de `profile`
- [ ] validar redirects por role:
  - traveler
  - agency_owner
  - agency_member
  - master
- [ ] substituir acessos mockados por sessao real

## 6. Links

- [x] contrato de `adminToken` e `publicToken` preparado
- [x] mappers de `TripPublicView` e `TripAdminView` preparados
- [x] politica de privacidade do link documentada
- [ ] mover permissao real de admin/public para backend
- [ ] criar rota publica final
- [ ] impedir qualquer dependencia de `?admin=true` em producao

## 7. Creditos

- [x] tipos canônicos de saldo, ledger, pacotes e planos preparados
- [x] repository de creditos preparado com fallback local
- [ ] persistir ledger real no backend
- [ ] validar consumo por modulo
- [ ] validar reconciliacao de saldo
- [ ] definir politica de expiracao e bonus

## 8. IA

- [x] contratos de conversa, mensagens, logs e prompts preparados
- [x] custos planejados por modulo preparados
- [x] repository com fallback mock/local preparado
- [ ] integrar provedor real de IA
- [ ] versionar prompts ativos
- [ ] validar custos reais por operacao
- [ ] definir fallback operacional quando IA falhar

## 9. Pagamentos

- [ ] escolher stack real: Stripe ou Mercado Pago
- [ ] modelar checkout
- [ ] implementar webhook
- [ ] garantir idempotencia
- [ ] reconciliar pagamento com creditos/plano
- [ ] validar eventos de assinatura, upgrade e cancelamento

## 10. QA

- [ ] mobile:
  - landing
  - portal usuario
  - pagina do link
  - portal agencia
- [ ] desktop:
  - portal usuario
  - agencia
  - master
- [ ] validar fluxos principais:
  - criar viagem
  - abrir viagem
  - compartilhar link
  - configuracoes
  - documentos
  - creditos
  - concierge
- [ ] validar QA visual final sem mocks quebrados

## Observacoes finais

- o frontend ainda usa `localStorage` como fonte principal por seguranca de rollout
- a proxima etapa recomendada e migrar primeiro leitura de `profiles`, `clients` e `trips` com feature flag
- Git ainda nao esta inicializado nesta pasta, entao nao ha trilha de versionamento ativa neste workspace atual
