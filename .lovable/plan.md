
# Plano: Corrigir Criação de Itens no Polling

## Problema Identificado

A função `poll-orders` **não cria itens de produção** (order_items) quando recebe pedidos do CardápioWeb.

**Evidência:**
- Tabela `orders`: 4 pedidos com dados JSON de itens
- Tabela `order_items`: **VAZIA** (0 registros)

**Causa raiz:**
O código `poll-orders` insere o pedido mas **não chama** o RPC `create_order_items_from_json`:

```typescript
// poll-orders/index.ts - Linha 168-192
const { error: insertError } = await supabase.from('orders').insert({
  // ... campos do pedido
  items: orderDetails.items || [],  // Salva JSON, mas não cria registros
});
// FALTA: Chamada ao RPC para criar order_items
```

Enquanto `webhook-orders` faz corretamente:

```typescript
// webhook-orders/index.ts - Linha 186-193
const { data: itemsResult } = await supabase.rpc(
  'create_order_items_from_json',
  { p_order_id: insertedOrder.id, p_items: order.items }
);
```

---

## Solucao

Adicionar chamada ao RPC `create_order_items_from_json` após inserir o pedido na função `poll-orders`.

---

## Mudanca

**Arquivo**: `supabase/functions/poll-orders/index.ts`

### Antes (linhas 167-199)

```typescript
const { error: insertError } = await supabase.from('orders').insert({
  // ... campos
});

if (insertError) {
  console.error(`[poll-orders] Error inserting order:`, insertError);
} else {
  result.newOrders++;
  console.log(`[poll-orders] Inserted new order: ${cardapiowebOrderId}`);
}
```

### Depois

```typescript
const { data: insertedOrder, error: insertError } = await supabase
  .from('orders')
  .insert({
    // ... campos
  })
  .select('id')
  .single();

if (insertError) {
  console.error(`[poll-orders] Error inserting order:`, insertError);
} else {
  result.newOrders++;
  console.log(`[poll-orders] Inserted new order: ${cardapiowebOrderId}`);

  // NOVO: Criar order_items para KDS
  if (orderDetails.items && Array.isArray(orderDetails.items)) {
    const { data: itemsResult, error: itemsError } = await supabase.rpc(
      'create_order_items_from_json',
      {
        p_order_id: insertedOrder.id,
        p_items: orderDetails.items,
        p_default_sector_id: null, // Distribuicao automatica
      }
    );

    if (itemsError) {
      console.error(`[poll-orders] Error creating order items:`, itemsError);
    } else {
      console.log(`[poll-orders] Created ${itemsResult} items for order ${insertedOrder.id}`);
    }
  }
}
```

---

## Fluxo Corrigido

```text
CardapioWeb API
      |
      v
poll-orders (Edge Function)
      |
      +--> INSERT orders (pedido)
      |
      +--> RPC create_order_items_from_json  <-- NOVO
             |
             v
      order_items (itens individuais)
             |
             v
      Distribuido para BANCADA A / BANCADA B
             |
             v
      Aparece no tablet KDS
```

---

## Correção de Pedidos Existentes

Após corrigir o código, será necessário reprocessar os pedidos já inseridos que não têm itens. Uma opção é chamar manualmente:

```sql
-- Para cada pedido pendente sem itens
SELECT create_order_items_from_json(
  o.id, 
  o.items, 
  NULL
) 
FROM orders o 
WHERE o.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
  );
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Adicionar chamada RPC para criar order_items apos inserir pedido |

---

## Resultado Esperado

- Pedidos recebidos via polling terao itens criados na tabela `order_items`
- Itens serao distribuidos entre BANCADA A e BANCADA B automaticamente
- Tablets KDS mostrarao os itens pendentes para producao
