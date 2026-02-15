

# Migracao para Webhook Assincrono (Fire-and-Forget)

## Resumo

Separar o webhook em duas fases: **ingestao rapida** (< 200ms) e **processamento em background**. O Cardapio Web recebe 200 OK quase instantaneamente, eliminando pausas por timeout.

## Arquitetura

```text
CardapioWeb  -->  webhook-orders (validar + salvar JSON + 200 OK)
                        |
                        +---> fetch fire-and-forget (sem await)
                                |
                                v
                        process-webhook-queue (logica pesada)
                                |
                                v
                        orders + order_items (banco)
```

## Passo 1: Criar tabela `webhook_queue`

Migracao SQL para criar a tabela de fila:

- `id` uuid (PK, default gen_random_uuid)
- `store_id` uuid (referencia a loja identificada pelo token)
- `payload` jsonb (JSON bruto do webhook)
- `status` text (default 'pending' -- valores: pending, processing, completed, error)
- `error_message` text (nullable, para debug)
- `created_at` timestamptz (default now)
- `processed_at` timestamptz (nullable)
- RLS: allow all (service_role access only via edge functions)
- Habilitar realtime NAO e necessario

## Passo 2: Refatorar `webhook-orders/index.ts`

Reduzir ao minimo:

1. Validar metodo POST
2. Extrair token do header (`x-api-key` / `x-webhook-token`)
3. Buscar store pelo token (query rapida, ja existente)
4. Parse do body JSON
5. **INSERT** na `webhook_queue` com `store_id` e `payload`
6. **Retornar 200 OK** imediatamente com `{"status": "received"}`
7. **Fire-and-forget**: disparar fetch para `process-webhook-queue` sem `await`, passando o `queue_id`

Toda a logica de `handleOrderPlaced`, `handleOrderCancelledOrClosed`, `handleOrderStatusChange`, `fetchOrderFromApi`, `explodeComboItems` etc. sera REMOVIDA deste arquivo.

## Passo 3: Criar nova Edge Function `process-webhook-queue`

Nova funcao em `supabase/functions/process-webhook-queue/index.ts` que:

1. Recebe o `queue_id` no body
2. Busca o registro na `webhook_queue` (status = 'pending')
3. Marca como `processing`
4. Executa TODA a logica atual do webhook-orders:
   - Normalizar evento
   - Fetch da API externa (se necessario)
   - Criar pedido + itens + explosao de combos
   - Cancelar/fechar pedidos
5. Marca como `completed` (ou `error` com mensagem)

Adicionar `verify_jwt = false` no `config.toml`.

## Passo 4: Configuracao

Adicionar no `supabase/config.toml`:
```
[functions.process-webhook-queue]
verify_jwt = false
```

## Vantagens

- **Resposta < 200ms**: INSERT de 1 linha JSONB e extremamente rapido
- **Sem perda de dados**: mesmo se o processamento falhar, o payload esta salvo na fila
- **Observabilidade**: tabela `webhook_queue` serve como log historico de todos os webhooks recebidos
- **Retry facil**: itens com status `error` podem ser reprocessados manualmente ou por cron
- **Escalabilidade**: multiplos webhooks simultaneos nao causam gargalo

## Arquivos Modificados

- `supabase/functions/webhook-orders/index.ts` -- simplificado drasticamente
- `supabase/functions/process-webhook-queue/index.ts` -- NOVO, contem toda a logica de processamento
- `supabase/config.toml` -- adicionar entrada para nova funcao
- Migracao SQL -- criar tabela `webhook_queue`

## Consideracoes

- O `process-webhook-queue` usa autenticacao interna (service_role_key) e nao precisa de token externo
- A chamada fire-and-forget garante que o webhook-orders nao espera o processamento
- Se o fetch fire-and-forget falhar silenciosamente, os itens pendentes na fila podem ser reprocessados via um cron ou botao manual
- Pedidos existentes e fluxo do poll-orders NAO sao afetados

