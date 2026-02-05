
# Plano: Receber Todos os Tipos de Pedidos (Delivery, Mesa, Balcão, Retirada)

## Problema Atual

A função `poll-orders` filtra apenas pedidos do tipo `delivery`:

```typescript
// Linha 96 - poll-orders/index.ts
const deliveryOrders = ordersData.filter(order => order.order_type === 'delivery');
```

Pedidos de **mesa**, **balcão** e **retirada** são descartados.

---

## Solução

1. Adicionar coluna `order_type` na tabela `orders`
2. Remover filtro de `delivery` na edge function
3. Adaptar lógica de endereço para pedidos sem entrega
4. Exibir tipo do pedido na interface

---

## Mudança 1: Adicionar Coluna no Banco de Dados

**Migração SQL**:

```sql
-- Adicionar coluna order_type na tabela orders
ALTER TABLE orders 
ADD COLUMN order_type text DEFAULT 'delivery';

-- Comentário para documentação
COMMENT ON COLUMN orders.order_type IS 'Tipo do pedido: delivery, dine_in (mesa), takeaway (retirada), counter (balcão)';
```

---

## Mudança 2: Atualizar Edge Function poll-orders

**Arquivo**: `supabase/functions/poll-orders/index.ts`

### Remover filtro de delivery (linhas 95-100)

```typescript
// ANTES
const deliveryOrders = ordersData.filter(order => order.order_type === 'delivery');
result.totalFromApi = ordersData.length;
result.deliveryOnly = deliveryOrders.length;

for (const order of deliveryOrders) {

// DEPOIS
result.totalFromApi = ordersData.length;
console.log(`[poll-orders] Store "${store.name}": ${ordersData.length} pedidos encontrados`);

for (const order of ordersData) {
```

### Adaptar lógica de endereço para tipos sem entrega

```typescript
// Para pedidos que não são delivery, usar endereço padrão da loja
const isDelivery = order.order_type === 'delivery';
const address = isDelivery ? (orderDetails.delivery_address || {}) : {};

// Coordenadas: usar padrão se não for delivery
const lat = isDelivery ? (address.latitude || -7.1195) : -7.1195;
const lng = isDelivery ? (address.longitude || -34.8450) : -34.8450;

// Endereço formatado baseado no tipo
const fullAddress = isDelivery
  ? [address.street, address.number, address.neighborhood, address.city, address.state]
      .filter(Boolean)
      .join(', ') || 'Endereço não informado'
  : getOrderTypeLabel(order.order_type);  // "Mesa", "Balcão", "Retirada"
```

### Adicionar função auxiliar para labels

```typescript
function getOrderTypeLabel(orderType: string): string {
  const labels: Record<string, string> = {
    'delivery': 'Delivery',
    'dine_in': 'Mesa',
    'takeaway': 'Retirada',
    'counter': 'Balcão',
    'table': 'Mesa',
  };
  return labels[orderType] || orderType;
}
```

### Salvar order_type no insert

```typescript
const { error: insertError } = await supabase.from('orders').insert({
  // ... campos existentes ...
  order_type: order.order_type || 'delivery',  // NOVO CAMPO
});
```

---

## Mudança 3: Atualizar Tipos TypeScript

**Arquivo**: `src/types/orders.ts`

```typescript
export interface Order {
  // ... campos existentes ...
  order_type?: 'delivery' | 'dine_in' | 'takeaway' | 'counter' | string;  // NOVO
}
```

---

## Mudança 4: Exibir Tipo do Pedido no OrderCard

**Arquivo**: `src/components/OrderCard.tsx`

Adicionar badge visual indicando o tipo:

```tsx
// Função auxiliar para cor e label
const getOrderTypeBadge = (type?: string) => {
  const config: Record<string, { label: string; color: string }> = {
    'delivery': { label: '🛵 Delivery', color: 'bg-blue-500' },
    'dine_in': { label: '🍽️ Mesa', color: 'bg-green-500' },
    'takeaway': { label: '📦 Retirada', color: 'bg-orange-500' },
    'counter': { label: '🏪 Balcão', color: 'bg-purple-500' },
  };
  return config[type || 'delivery'] || config['delivery'];
};

// No JSX, após o número do pedido:
<div className={`${badge.color} text-white text-xs px-2 py-0.5 rounded-full`}>
  {badge.label}
</div>
```

---

## Fluxo Após Mudanças

```text
CardápioWeb API
      ↓
  Pedidos confirmados (todos os tipos)
      ↓
  poll-orders (sem filtro)
      ↓
  Salva com order_type no banco
      ↓
  Interface exibe com badge colorido

Tipos suportados:
- 🛵 Delivery (azul) → Com endereço
- 🍽️ Mesa (verde) → Sem endereço
- 📦 Retirada (laranja) → Sem endereço  
- 🏪 Balcão (roxo) → Sem endereço
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar coluna `order_type` |
| `supabase/functions/poll-orders/index.ts` | Remover filtro, adaptar endereço, salvar tipo |
| `src/types/orders.ts` | Adicionar campo `order_type` |
| `src/components/OrderCard.tsx` | Exibir badge do tipo de pedido |

---

## Resultado Visual no Dashboard

```
┌─────────────────────────────┐
│  #7955  ⏱️ 5min             │
│  🛵 Delivery                │  ← Badge azul
│  Pizzaria Central           │
│  João Silva                 │
│  Manaíra                    │
│  [PRONTO]                   │
└─────────────────────────────┘

┌─────────────────────────────┐
│  #7956  ⏱️ 2min             │
│  🍽️ Mesa                    │  ← Badge verde
│  Pizzaria Central           │
│  Maria Santos               │
│                             │
│  [PRONTO]                   │
└─────────────────────────────┘
```
