

# Plano: Corrigir Fluxo de Status no CardápioWeb

## Problema Identificado

O endpoint `/ready` do CardápioWeb automaticamente muda o status para "Saiu para entrega" e dispara a integração com o Foody. Isso está errado porque:

- **Buffer → Pronto**: Deve aparecer como "Pronto" ou "Aguardando Coleta" (pedido ainda na loja)
- **Pronto → Despachado**: Só aí deve aparecer "Saiu para Entrega" (motoboy coletou)

## Fluxo Correto

```text
┌────────────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRETO DE STATUS                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  DASHBOARD LOCAL           API CardápioWeb           CARDÁPIOWEB UI    │
│  ─────────────────         ────────────────          ──────────────    │
│                                                                        │
│  ┌─────────────┐                                                       │
│  │   Buffer    │                                                       │
│  └──────┬──────┘                                                       │
│         │ Click "Pronto"                                               │
│         ▼                                                              │
│  ┌─────────────┐         /waiting_to_catch          "Aguardando        │
│  │   Pronto    │ ────────────────────────────────►   Coleta"           │
│  └──────┬──────┘         (ambos os tipos)                              │
│         │                                                              │
│         │ Click "Despachar"                                            │
│         ▼                                                              │
│  ┌─────────────┐         /dispatch                  "Saiu para         │
│  │ Despachado  │ ────────────────────────────────►   Entrega"          │
│  └─────────────┘         (delivery only)                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Alteração Necessária

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-order-ready/index.ts` | Usar `/waiting_to_catch` para TODOS os tipos de pedido (não só retirada) |

## Implementação

Simplificar a função `notifyCardapioWebReady` para sempre usar `/waiting_to_catch`:

```typescript
// ANTES (incorreto)
const isTakeout = orderType && TAKEOUT_TYPES.includes(orderType.toLowerCase());
const actionEndpoint = isTakeout ? 'waiting_to_catch' : 'ready';

// DEPOIS (correto)
// Sempre usar waiting_to_catch para marcar como "pronto/aguardando coleta"
// O endpoint /ready dispara automaticamente o envio ao entregador
const actionEndpoint = 'waiting_to_catch';
const statusLabel = 'AGUARDANDO COLETA';
```

## Lógica de Status

| Momento | Endpoint | Status no CardápioWeb |
|---------|----------|----------------------|
| Sai do Buffer | `/waiting_to_catch` | "Aguardando Coleta" ou "Pronto" |
| Motoboy coleta | `/dispatch` | "Saiu para Entrega" |

## Por que funciona

O endpoint `/waiting_to_catch` marca o pedido como pronto sem disparar automaticamente a integração com sistemas de logística. O `/dispatch` (já implementado e usado quando o pedido sai da coluna "Pronto" para "Despachado") é que deve ser usado para indicar "Saiu para Entrega".

## Código Final

Remover a lógica de distinção por tipo de pedido e usar sempre o mesmo endpoint:

```typescript
async function notifyCardapioWebReady(
  store: StoreData,
  externalId: string,
  orderType: string | null  // Mantido para log, mas não afeta a lógica
): Promise<{ success: boolean; error?: string }> {
  // ...
  
  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  
  // Sempre usar waiting_to_catch para "Pronto/Aguardando Coleta"
  // O endpoint /ready do CardápioWeb dispara automaticamente o Foody
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/waiting_to_catch`;

  console.log(`Calling CardápioWeb AGUARDANDO COLETA for order ${externalId} (type: ${orderType || 'unknown'})`);
  // ...
}
```

