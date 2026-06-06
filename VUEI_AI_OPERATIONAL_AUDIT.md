# Vuei AI Operational Audit

## Resumo
- A camada de IA do Vuei estava parcialmente persistida, mas ainda nao era operacional de ponta a ponta.
- Conversas e mensagens do concierge ja podiam ser gravadas em `public.ai_conversations` e `public.ai_messages`.
- As respostas do concierge ainda nasciam no client, com logica local, sem rota server-side, sem consumo real de creditos e sem `ai_usage_logs`.
- O portal master de IA ainda estava majoritariamente estatico.

## Causa raiz
1. O concierge usava persistencia real para historico, mas a resposta do assistente era gerada no frontend por funcoes locais.
2. Nao existia rota server-side para IA nem uso de `OPENAI_API_KEY` fora do frontend.
3. `ai_usage_logs` e `ai_prompts` estavam incompletos do ponto de vista operacional.
4. O ledger de creditos existia, mas a IA nao o acionava.
5. A tela `app/master/ia/page.tsx` exibia dados fixos, sem leitura real de prompts e logs.

## Onde a IA estava mock/local
- [app/portal/concierge/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/concierge/page.tsx)
  - `buildTripAwareResponse()` gerava resposta local.
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/%5Bid%5D/page.tsx)
  - `buildResponse()` gerava resposta local para o link.
- [app/master/ia/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/master/ia/page.tsx)
  - cards, modulos, prompt e estatisticas eram estaticos.
- [app/agencia/roteiros-ia/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/agencia/roteiros-ia/page.tsx)
  - continua honesto em modo real: nao persiste IA real nesta fase.

## O que virou real nesta rodada
- Concierge real via server route:
  - [app/api/ai/concierge/route.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/api/ai/concierge/route.ts)
- Prompts reais e logs reais no repository:
  - [lib/repositories/ai-repository.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/repositories/ai-repository.ts)
- Portal do viajante usando rota server-side real quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`:
  - [app/portal/concierge/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/concierge/page.tsx)
- Link admin/public parando de fingir resposta local em modo real:
  - [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/%5Bid%5D/page.tsx)
- Master lendo prompts e logs reais:
  - [contexts/master-context.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/contexts/master-context.tsx)
  - [app/master/ia/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/master/ia/page.tsx)

## Fluxo operacional atual
1. O usuario autenticado envia uma mensagem no concierge.
2. A UI chama `POST /api/ai/concierge`.
3. A rota server-side:
   - valida sessao;
   - valida acesso a viagem;
   - resolve prompt ativo;
   - monta contexto real de viagem, hospedagens e documentos;
   - valida saldo minimo antes da chamada;
   - chama o modelo real usando `OPENAI_API_KEY`;
   - persiste `ai_messages` e atualiza `ai_conversations`;
   - tenta registrar `ai_usage_logs`;
   - tenta consumir 1 credito no ledger real.
4. Se log ou consumo falharem, a resposta ainda e entregue com aviso honesto e sem fingir contabilizacao completa.

## Tabelas usadas
- `public.ai_conversations`
- `public.ai_messages`
- `public.ai_usage_logs`
- `public.ai_prompts`
- `public.credit_transactions`
- `public.profiles`
- `public.agencies`
- `public.trips`
- `public.trip_hotels`
- `public.documents`

## Campos exigidos pela operacao
### `ai_prompts`
- `code`
- `name`
- `module`
- `system_prompt`
- `user_prompt_template`
- `is_active`
- `version`
- `metadata`

### `ai_usage_logs`
- `owner_type`
- `owner_user_id`
- `trip_id`
- `user_id`
- `agency_id`
- `client_id`
- `module`
- `action`
- `model`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost`
- `credits_charged`
- `credits_used`
- `status`
- `metadata`
- `created_at`

## Consumo de creditos
- Regra aplicada nesta fase: `1 credito por resposta real do concierge`.
- O saldo e validado antes da chamada.
- O consumo so e tentado depois da resposta real retornar com sucesso.
- Se o consumo falhar, a UI recebe aviso honesto e o sistema nao finge que o credito foi debitado.

## Uso de contexto real
O concierge passou a usar:
- titulo da viagem;
- destino/cidade/pais;
- periodo;
- estilo;
- quantidade de viajantes;
- hospedagens reais de `trip_hotels`;
- documentos reais de `documents`.

Nao foi implementada leitura real de conteudo binario dos documentos nesta fase. O contexto usa metadados reais, nao OCR/parse do arquivo.

## Master IA
O master agora le:
- prompts reais;
- usage logs reais;
- total de conversas;
- total de mensagens;
- total de tokens;
- total de creditos cobrados;
- custo estimado quando configurado por env;
- erros recentes.

## SQL necessario
- [supabase/ai_operational_fix.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/ai_operational_fix.sql)

Esse SQL:
- completa `ai_usage_logs`;
- alinha `ai_prompts`;
- ajusta constraints e indices;
- garante policies especificas para logs e prompts;
- sem executar nada automaticamente.

## Limitacoes restantes
1. O link sem sessao continua sem backend seguro para persistencia anonima de IA.
   - Resultado: o concierge do link agora responde com erro honesto em vez de fingir IA local quando nao ha sessao.
2. `app/agencia/roteiros-ia/page.tsx` continua fora do backend real de IA.
   - A tela permanece honesta em modo real.
3. O custo estimado depende de `OPENAI_PRICE_INPUT_PER_1M_USD` e `OPENAI_PRICE_OUTPUT_PER_1M_USD`.
   - Sem essas envs, o custo fica como nao informado.
4. O modelo usado depende de `OPENAI_CONCIERGE_MODEL`.
   - Fallback aplicado: `gpt-4.1-mini`.

## Como testar
1. Configurar no ambiente:
   - `NEXT_PUBLIC_USE_SUPABASE_DATA=true`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - opcional: `OPENAI_CONCIERGE_MODEL`
   - opcional: `OPENAI_PRICE_INPUT_PER_1M_USD`
   - opcional: `OPENAI_PRICE_OUTPUT_PER_1M_USD`
2. Rodar o SQL recomendado no Supabase.
3. Abrir `/portal/concierge` com usuario autenticado e viagem real.
4. Enviar mensagem e validar:
   - nova linha em `ai_conversations` se necessario;
   - novas linhas em `ai_messages`;
   - nova linha em `ai_usage_logs`;
   - novo `credit_transactions` com `consume`;
   - reducao de saldo em `profiles` ou `agencies`.
5. Abrir `/master/ia` e confirmar:
   - prompts reais;
   - usage logs reais;
   - contadores atualizados.

## Arquivos alterados
- [types/ai.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/types/ai.ts)
- [lib/supabase/types.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/supabase/types.ts)
- [lib/repositories/ai-repository.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/lib/repositories/ai-repository.ts)
- [app/api/ai/concierge/route.ts](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/api/ai/concierge/route.ts)
- [app/portal/concierge/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/portal/concierge/page.tsx)
- [app/viagem/[id]/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/viagem/%5Bid%5D/page.tsx)
- [contexts/master-context.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/contexts/master-context.tsx)
- [app/master/ia/page.tsx](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/app/master/ia/page.tsx)
- [supabase/ai_operational_fix.sql](/abs/path/c:/Users/mateu/Downloads/Vuei%20LINK%202/supabase/ai_operational_fix.sql)

## Build
- `pnpm run build` passou com sucesso.
