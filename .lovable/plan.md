

# Plano: Notificar CardápioWeb com Status Diferente por Tipo de Pedido

## Problema

Atualmente, quando um pedido sai do Buffer e vai para "Pronto", o sistema sempre chama o endpoint `/ready` do CardápioWeb. Isso está errado porque:

- **Retirada**: Deve aparecer como "aguardando retirada" (`waiting_to_catch`)
- **Delivery**: Deve aparecer como "pronto" (`ready`)

## Arquitetura da Solução

```text
┌────────────────────────────────────────────────────────────────────┐
│                   FLUXO DE NOTIFICAÇÃO POR TIPO                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Buffer → Pronto (click no Dashboard)                              │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │             notify-order-ready (edge function)                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│         │                                                          │
│         ├── order_type = 'takeaway' | 'takeout'                    │
│         │         │                                                │
│         │         ▼                                                │
│         │   POST /orders/{id}/waiting_to_catch                     │
│         │         │                                                │
│         │         └── "Esperando Retirada" no CardápioWeb          │
│         │                                                          │
│         └── order_type = 'delivery' | outros                       │
│                   │                                                │
│                   ▼                                                │
│             POST /orders/{id}/ready                                │
│                   │                                                │
│                   └── "Pronto" no CardápioWeb                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

| Local | Alteração |
|-------|-----------|
| `supabase/functions/notify-order-ready/index.ts` | Buscar `order_type` e usar endpoint correto |

## Detalhes Técnicos

### 1. Atualizar interface OrderData

Adicionar campo `order_type`:

```typescript
interface OrderData {
  id: string;
  external_id: string | null;
  store_id: string | null;
  order_type: string | null;  // NOVO
}
```

### 2. Buscar order_type no SELECT

Linha ~97:
```typescript
.select('id, external_id, store_id, order_type')  // Adicionar order_type
```

### 3. Atualizar função notifyCardapioWebReady

Receber `orderType` como parâmetro e escolher o endpoint correto:

```typescript
async function notifyCardapioWebReady(
  store: StoreData,
  externalId: string,
  orderType: string | null  // NOVO parâmetro
): Promise<{ success: boolean; error?: string }> {
  // ...
  
  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  
  // Determinar endpoint baseado no tipo de pedido
  let actionEndpoint = 'ready';  // Padrão para delivery
  const takeoutTypes = ['takeaway', 'takeout', 'pickup'];
  
  if (orderType && takeoutTypes.includes(orderType.toLowerCase())) {
    actionEndpoint = 'waiting_to_catch';  // Esperando retirada
    console.log(`Order is takeout type (${orderType}), using waiting_to_catch`);
  }
  
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/${actionEndpoint}`;
  // ...
}
```

### 4. Passar orderType na chamada

Linha ~160:
```typescript
const readyResult = await notifyCardapioWebReady(
  typedStore, 
  typedOrder.external_id, 
  typedOrder.order_type  // NOVO
);
```

## Mapeamento de Tipos de Pedido

| Tipo no Sistema | Tipo Original | Endpoint CardápioWeb | Status Exibido |
|-----------------|---------------|----------------------|----------------|
| `delivery` | delivery | `/ready` | Pronto |
| `takeaway` | takeout | `/waiting_to_catch` | Esperando Retirada |
| `takeout` | takeout | `/waiting_to_catch` | Esperando Retirada |
| `pickup` | pickup | `/waiting_to_catch` | Esperando Retirada |
| `onsite` | balcão | `/ready` | Pronto |
| `table` | mesa | `/ready` | Pronto |

## Resultado Esperado

- Pedidos de **Retirada**: Aparecem como "Esperando Retirada" no CardápioWeb quando saem do buffer
- Pedidos de **Delivery**: Aparecem como "Pronto" no CardápioWeb quando saem do buffer
- Logs detalhados indicando qual endpoint foi usado

