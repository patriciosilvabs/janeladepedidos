
# Plano: Integrar Webhook do CardapioWeb para Pedidos de Mesa em Tempo Real

## Contexto

Atualmente, pedidos de mesa (`closed_table`, `dine_in`) so aparecem na API de polling do CardapioWeb **apos serem finalizados**. Para capturar pedidos de mesa em tempo real (enquanto ainda estao abertos), precisamos configurar um webhook que receba eventos diretamente do CardapioWeb.

## Estrutura do Webhook CardapioWeb

Baseado na documentacao fornecida, o CardapioWeb envia eventos via webhook com a seguinte estrutura:

```text
Eventos Relevantes:
- order.placed      -> Pedido criado (todos os tipos, incluindo mesa)
- order.confirmed   -> Pedido confirmado
- order.cancelled   -> Pedido cancelado
- order.closed      -> Pedido finalizado
```

O payload inclui os dados completos do pedido, permitindo criar o pedido no sistema imediatamente.

## Arquitetura Proposta

```text
CardapioWeb                     Sistema
    |                              |
    |-- order.placed (Mesa) ------>|
    |                              |-- webhook-orders recebe
    |                              |-- Identifica store por token
    |                              |-- Cria pedido + items no KDS
    |                              |
    |                         [Tablet mostra pedido]
    |                              |
    |-- order.closed (Mesa) ------>|
    |                              |-- Remove pedido (ja concluido)
```

## Mudancas Necessarias

### 1. Atualizar Edge Function `webhook-orders`

| Aspecto | Atual | Proposto |
|---------|-------|----------|
| Formato do payload | Generico (IncomingOrder) | Payload CardapioWeb nativo |
| Identificacao de loja | Token unico global | Token por loja (stores table) |
| Eventos suportados | Status events basicos | Todos os eventos order.* |
| Criacao de items | Formato interno | Formato CardapioWeb (items[]) |

### 2. Nova Logica de Processamento

```text
POST /webhook-orders
    |
    +-- Extrair header X-API-KEY ou X-Webhook-Token
    |
    +-- Buscar loja pelo token na tabela "stores"
    |       (SELECT * FROM stores WHERE cardapioweb_api_token = token)
    |
    +-- Identificar tipo de evento
    |       |
    |       +-- order.placed / order.confirmed
    |       |       +-- Criar pedido + order_items via RPC
    |       |
    |       +-- order.cancelled / order.closed
    |       |       +-- Remover pedido existente
    |       |
    |       +-- Outros eventos (ignorar)
    |
    +-- Responder 200 OK
```

### 3. Payload CardapioWeb Esperado

```json
{
  "event_type": "order.placed",
  "order_id": 12345678,
  "merchant_id": 999,
  "created_at": "2026-02-05T10:30:00Z",
  "order": {
    "id": 12345678,
    "display_id": 8001,
    "status": "confirmed",
    "order_type": "closed_table",
    "customer": {
      "name": "Mesa 05",
      "phone": null
    },
    "items": [
      {
        "name": "Pizza Margherita",
        "quantity": 2,
        "options": [
          { "name": "Borda Recheada", "group": "Bordas" }
        ],
        "observation": "Sem cebola"
      }
    ],
    "total": 89.90
  }
}
```

### 4. Configuracao de Seguranca

O webhook usara o mesmo token de API da loja (`cardapioweb_api_token`) para autenticacao, permitindo:
- Multiplas lojas com webhooks independentes
- Roteamento automatico para a loja correta

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/webhook-orders/index.ts` | Reescrever para suportar payload CardapioWeb nativo |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para webhook-orders |

## URL do Webhook

Apos implementacao, voce precisara configurar no painel do CardapioWeb:

```text
URL: https://cpxuluerkzpynlcdnxcq.supabase.co/functions/v1/webhook-orders
Header: X-API-KEY: [token da loja]
```

## Fluxo Completo Pos-Implementacao

```text
1. Cliente faz pedido de Mesa no CardapioWeb
        |
        v
2. CardapioWeb dispara webhook "order.placed"
        |
        v
3. webhook-orders recebe e identifica loja pelo token
        |
        v
4. Sistema cria pedido + items no banco
        |
        v
5. Realtime atualiza o tablet INSTANTANEAMENTE
        |
        v
6. Operador ve o pedido de Mesa no KDS
```

## Consideracoes Tecnicas

1. **Idempotencia**: Verificar se pedido ja existe antes de criar (evitar duplicatas do polling)
2. **Fallback**: Manter polling ativo como backup caso webhook falhe
3. **Logs**: Adicionar logging detalhado para debug
4. **Retry**: CardapioWeb pode reenviar webhooks em caso de falha - tratar duplicatas

## Resultado Esperado

- Pedidos de Mesa aparecem no tablet **instantaneamente** (sem esperar fechamento)
- Pedidos de Delivery/Retirada tambem podem usar webhook (mais rapido que polling)
- Sistema robusto com fallback para polling
