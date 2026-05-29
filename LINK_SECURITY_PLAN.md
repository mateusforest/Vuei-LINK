# Vuei - Link Security Plan

## Objetivo
Definir a arquitetura segura dos links admin e publico do Vuei antes da migracao real da pagina da viagem para backend autenticado e tokenizado.

## Diferenca Entre Link Admin E Link Publico

### Link admin
- acesso editavel;
- pode abrir configuracoes, uploads, viajantes, creditos e documentos privados;
- deve exigir token seguro ou autenticacao no backend futuro;
- nao pode depender de `?admin=true` como regra de seguranca real.

### Link publico
- acesso visual e filtrado;
- deve mostrar apenas dados permitidos pelas permissoes da viagem;
- nunca pode expor documentos privados, tokens internos, creditos, dados sensiveis ou configuracoes administrativas.

## Riscos Atuais

- o frontend historico ainda entende `?admin=true` como modo admin local;
- `adminLink` e `publicLink` ainda sao derivados no frontend;
- o link da viagem ainda usa dados locais/mockados para montar a experiencia;
- qualquer liberacao precoce de dados publicos sem filtro pode vazar documentos privados e configuracoes internas.

## Padrao Futuro De Tokens

Util criado:
- [lib/security/link-tokens.ts](/abs/path/lib/security/link-tokens.ts)

Funcoes preparadas:
- `generateSecureToken()`
- `generateAdminLink(slug, token)`
- `generatePublicLink(slug, token)`
- `isAdminLinkMode(params)`
- `isPublicLinkMode(params)`

Direcao recomendada:
- `admin_token` longo, aleatorio e rotacionavel;
- `public_token` longo, aleatorio e revogavel;
- tokens nunca devem ser inferiveis por slug;
- tokens devem ser validados no backend, nunca apenas no cliente.

## Padrao Futuro De Rotas

### Recomendacao principal
- admin autenticado/futuro:
  - `/viagem/[slug]`
- admin por token de transicao:
  - `/viagem/[slug]?adminToken=...`
- publico:
  - `/v/[slug]?token=...`

### Motivo
- separa claramente experiencia publica e administrativa;
- reduz risco de um mesmo componente servir dados errados por query param;
- facilita RLS e endpoints com payloads diferentes.

## Politica De Documentos Privados

- documentos privados nunca entram no payload publico;
- documentos publicos exigem `visibility = public_trip`;
- qualquer URL de arquivo deve ser signed URL no futuro;
- documentos administrativos devem depender de auth ou `adminToken` validado no backend.

## Permissoes Por Secao

Contrato preparado em:
- [types/trip.ts](/abs/path/types/trip.ts)
- [lib/mappers/trip-view-mappers.ts](/abs/path/lib/mappers/trip-view-mappers.ts)

Regras de secao publica:
- `itinerary`: permitido so se `publicCanViewItinerary`
- `accommodations`: permitido so se `publicCanViewAccommodation`
- `flights`: permitido so se `publicCanViewFlights`
- `documents`: permitido so se `publicCanViewPublicDocuments`
- `concierge`: permitido so se `publicCanUseConcierge`

## Views Separadas

### `TripPublicView`
Deve conter apenas:
- titulo
- destino
- datas
- status
- passageiros resumidos
- roteiro permitido
- hospedagem permitida
- passagens permitidas
- documentos publicos
- compartilhamento

### `TripAdminView`
Pode conter:
- dados completos da viagem
- documentos privados
- uploads
- creditos
- configuracoes
- viajantes
- permissoes
- links administrativos

## Plano De Migracao Da Rota Atual

### Etapa 1
- manter rota atual funcionando para nao quebrar o app;
- usar mappers de view para diferenciar o que cada modo pode ver.

### Etapa 2
- passar a gerar `admin_token` e `public_token` reais no backend;
- persistir em `trips`.

### Etapa 3
- criar rota publica dedicada `/v/[slug]`;
- mover leitura publica para payload filtrado.

### Etapa 4
- deixar `/viagem/[slug]` depender de sessao autenticada ou token admin validado no backend;
- remover dependencia funcional de `?admin=true`.

## Riscos De RLS

- se o payload publico for buscado diretamente da tabela `trips` sem filtro de secao, pode haver vazamento de dados;
- se `documents` nao tiver endpoint/token dedicado, signed URLs podem ser emitidas para arquivos indevidos;
- se agency/member e traveler compartilharem consultas administrativas, pode haver leitura cruzada de viagens.

## Como Evitar Vazamento De Dados

- separar payload publico e payload admin em mappers diferentes;
- nunca serializar `admin_token` no payload publico;
- filtrar documentos com `filterPrivateDocuments`;
- validar token e permissao no backend antes de montar a resposta;
- usar rota publica dedicada para evitar ambiguidade do modo da pagina.
