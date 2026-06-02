# Vuei Client Runtime Fix

## Erro observado

- Sintoma em producao: tela generica `This page couldn't load` nas paginas de viagem, com `GET 200` na Vercel.
- Neste ambiente eu nao tenho navegador interativo para capturar o console real da aba, entao a reproducao foi feita por auditoria estatica do componente client principal e dos helpers usados por `/v/[id]` e `/viagem/[id]/admin`.

## Causa principal

### 1. Referencias fora de escopo no client

- Arquivo: `app/viagem/[id]/page.tsx`
- Area: `FlightsSection` e `DocumentsSection`
- Problema:
  - `FlightsSection` renderizava `AddFlightModal` passando `ensureSensitiveAccess`, mas esse valor nao fazia parte das props do componente.
  - `DocumentsSection` usava `ensureSensitiveAccess` e `profile?.settings` sem receber esses valores por props.
- Efeito:
  - Isso gera erro client-side em runtime (`ReferenceError` / valor inexistente no escopo do componente), que derruba a renderizacao mesmo com resposta HTTP `200`.

### 2. Leitura frágil de dados reais da trip

- Arquivo: `app/viagem/[id]/page.tsx`
- Areas:
  - `TripHeader`
  - `TripHero`
  - `QuickAccessCards`
  - `QuickInfoSection`
  - `buildTripDataFromStoredTrip`
- Problema:
  - O componente assumia que `travelers`, `weather`, `documents`, `flights`, `itinerary` e `quickInfo.currency` sempre existiam com shape completo.
  - Com dados reais parciais do Supabase, a pagina podia tentar acessar valores como:
    - `tripData.travelers.slice(...)`
    - `tripData.travelers.length`
    - `tripData.weather.icon`
    - `tripData.quickInfo.currency.name`
- Efeito:
  - Qualquer `undefined` nesses pontos podia quebrar a pagina inteira no client.

### 3. Resolucao de parametro de rota pouco defensiva

- Arquivo: `app/viagem/[id]/page.tsx`
- Problema:
  - A pagina compartilhada agora aceita leitura defensiva tanto de `params.id` quanto de `params.slug`.
- Efeito evitado:
  - Reduz o risco de carregar a trip com identificador incorreto quando o componente for reutilizado por outra rota compatível.

## Correcoes aplicadas

### `app/viagem/[id]/page.tsx`

- Passei `ensureSensitiveAccess` corretamente para `FlightsSection`.
- Passei `profileSettings` e `ensureSensitiveAccess` corretamente para `DocumentsSection`.
- Adicionei normalizacao defensiva para a trip:
  - `normalizeQuickInfo`
  - `normalizeTravelers`
  - `normalizeTripViewData`
- Passei a usar `normalizeTripViewData(initialTripData)` no estado inicial.
- Passei a normalizar o retorno de `buildTripDataFromStoredTrip`.
- Protegi renderizacao de:
  - avatares de viajantes no header
  - contagem de viajantes
  - icone de clima
  - cards de acesso rapido
  - informacoes rapidas do rodape
- Ajustei a leitura do parametro da rota para aceitar `id` e `slug`.

## Como testar

1. Abrir uma viagem publica em `/v/[slug-ou-id]`.
2. Abrir a versao admin em `/viagem/[slug-ou-id]/admin`.
3. Validar que ambas carregam mesmo quando:
   - nao ha documentos
   - nao ha hoteis
   - nao ha quick access configurado
   - a trip tem dados parciais no Supabase
4. No admin, abrir:
   - Passagens
   - Documentos
   - Compartilhar
   - Menu da viagem
5. Validar que a pagina nao cai na tela generica de erro do client.
6. Validar que erros de PIN/biometria aparecem como mensagem local e nao derrubam a pagina inteira.

## Limitacao desta validacao

- O build e a auditoria estatica confirmam a correcao estrutural.
- A validacao de console do navegador precisa ser conferida manualmente em browser real, porque este ambiente nao tem navegador interativo acoplado para inspecao da aba.
