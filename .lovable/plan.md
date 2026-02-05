

# Plano: Corrigir Mapeamento de Tipos de Pedido

## Problema Identificado

A API do CardápioWeb retorna tipos de pedido diferentes do que o código espera:

| API CardápioWeb | Código Atual | Deveria Ser |
|-----------------|--------------|-------------|
| `takeout` | (não mapeado) | Retirada |
| `counter` | Balcão | OK |
| `dine_in` | Mesa | OK |
| `delivery` | Delivery | OK |

**Evidência dos logs:**
```json
{
  "order_type": "takeout",  // API retorna "takeout"
  ...
}
```

**Resultado no banco:**
```
address: "takeout"  // Deveria ser "Retirada"
order_type: "takeout"  // Não é reconhecido pelo badge
```

O pedido aparece com badge de Delivery (azul) porque `takeout` não está mapeado e o fallback é `delivery`.

---

## Solução

Adicionar `takeout` aos mapeamentos em dois arquivos:

1. **Edge Function** - para exibir endereço correto
2. **OrderCard** - para exibir badge correto

---

## Mudanças

### Arquivo 1: `supabase/functions/poll-orders/index.ts`

**Linha 8-16 - Função getOrderTypeLabel:**

```typescript
function getOrderTypeLabel(orderType: string): string {
  const labels: Record<string, string> = {
    'delivery': 'Delivery',
    'dine_in': 'Mesa',
    'takeaway': 'Retirada',
    'takeout': 'Retirada',    // NOVO: API retorna "takeout"
    'counter': 'Balcão',
    'table': 'Mesa',
  };
  return labels[orderType] || orderType;
}
```

**Lógica isDelivery (linha ~158):**

```typescript
// Verificar se é delivery para extrair endereço
const isDelivery = order.order_type === 'delivery';
// takeout/takeaway/counter/dine_in não têm endereço de entrega
```

---

### Arquivo 2: `src/components/OrderCard.tsx`

**Linha 8-17 - Função getOrderTypeBadge:**

```typescript
const getOrderTypeBadge = (type?: string) => {
  const config: Record<string, { label: string; className: string }> = {
    'delivery': { label: '🛵 Delivery', className: 'bg-blue-500 hover:bg-blue-500' },
    'dine_in': { label: '🍽️ Mesa', className: 'bg-green-500 hover:bg-green-500' },
    'takeaway': { label: '📦 Retirada', className: 'bg-orange-500 hover:bg-orange-500' },
    'takeout': { label: '📦 Retirada', className: 'bg-orange-500 hover:bg-orange-500' },  // NOVO
    'counter': { label: '🏪 Balcão', className: 'bg-purple-500 hover:bg-purple-500' },
    'table': { label: '🍽️ Mesa', className: 'bg-green-500 hover:bg-green-500' },
  };
  return config[type || 'delivery'] || config['delivery'];
};
```

---

## Resultado Esperado

Após a correção:

| Tipo API | Badge | Cor | Endereço |
|----------|-------|-----|----------|
| `delivery` | 🛵 Delivery | Azul | Endereço completo |
| `takeout` | 📦 Retirada | Laranja | "Retirada" |
| `takeaway` | 📦 Retirada | Laranja | "Retirada" |
| `counter` | 🏪 Balcão | Roxo | "Balcão" |
| `dine_in` | 🍽️ Mesa | Verde | "Mesa" |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Adicionar `takeout` ao mapeamento de labels |
| `src/components/OrderCard.tsx` | Adicionar `takeout` ao mapeamento de badges |

---

## Pedidos Existentes

Os 6 pedidos já importados com `order_type: 'takeout'` passarão a exibir o badge correto (laranja) automaticamente após a atualização do frontend. O campo `address` mostra "takeout" mas após a correção novos pedidos mostrarão "Retirada".

