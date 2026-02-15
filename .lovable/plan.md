
# Correcao: Deteccao e Reprocessamento de Pedidos Orfaos

## Diagnostico do Pedido 9940

O pedido 9940 (external_id: 184449105, loja CACHOEIRINHA) foi criado na tabela `orders` com status `pending`, porem possui **zero registros** em `order_items`. O filtro de categorias nao e a causa — o nome "Carne de Sol e Cream Cheese" faz match com "Carne de Sol" na lista de categorias permitidas. A causa mais provavel e uma falha silenciosa na RPC `create_order_items_from_json` ou na guarda de idempotencia.

## Solucao Proposta

### 1. Correcao imediata do pedido 9940

Chamar a RPC `create_order_items_from_json` manualmente com os dados do campo `items` (JSONB) ja armazenados no pedido. Isso recria os itens no KDS.

Sera feito via uma query SQL direta:

```sql
SELECT create_order_items_from_json(
  '5fbe496a-c0ef-4657-9a10-e28012b31750'::uuid,
  (SELECT items FROM orders WHERE id = '5fbe496a-c0ef-4657-9a10-e28012b31750'),
  NULL
);
```

### 2. Prevencao: Verificacao de pedidos orfaos no poll-orders

Adicionar ao final do ciclo de polling uma verificacao que detecta pedidos com status `pending` que tem zero `order_items` e tenta recriar os itens automaticamente.

Logica no `poll-orders/index.ts`:

```text
1. SELECT orders com status = 'pending' e zero order_items (LEFT JOIN + COUNT)
2. Para cada pedido orfao encontrado:
   a. Se o campo items (JSONB) nao estiver vazio, chamar create_order_items_from_json
   b. Logar o resultado
```

### 3. Adicionar log de seguranca no poll-orders e process-webhook-queue

Apos a chamada da RPC `create_order_items_from_json`, verificar se o resultado e `0` e, nesse caso, logar um warning com os dados do pedido para facilitar debug futuro.

## Arquivos Modificados

- **SQL direto**: Recriar itens do pedido 9940 (correcao imediata)
- **`supabase/functions/poll-orders/index.ts`**: Adicionar verificacao de pedidos orfaos ao final do ciclo
- **`supabase/functions/process-webhook-queue/index.ts`**: Adicionar log de warning quando RPC retorna 0 itens criados

## Impacto

- Pedido 9940 aparecera no tablet imediatamente apos a correcao
- Pedidos futuros que falharem na criacao de itens serao detectados e corrigidos automaticamente no proximo ciclo de polling (max 20 segundos)
- Nenhuma alteracao no fluxo normal — apenas uma rede de seguranca adicional
