
# Filtrar pedidos com status terminal no Painel do Forno

## Problema

O filtro atual do Forno só verifica se `dispatched_at` está preenchido para esconder pedidos. Porém, pedidos que foram fechados (`closed`) ou cancelados (`cancelled`) diretamente -- sem passar pelo fluxo de despacho -- ficam com `dispatched_at = NULL` e continuam aparecendo eternamente no Forno.

Dados reais do banco confirmam isso:
- #9515: status `cancelled`, dispatched_at NULL
- #6486: status `closed`, dispatched_at NULL  
- #6499: status `closed`, dispatched_at NULL

## Solucao

Adicionar verificacao do `status` do pedido alem do `dispatched_at`. Pedidos com status terminal (`closed`, `cancelled`, `dispatched`) devem ser excluidos do Forno.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

Alterar dois pontos no `useMemo` dos `orderGroups`:

1. **Linha 92** - No loop de `readyFromOvenItems`, alem de pular `dispatched_at`, tambem pular pedidos com status terminal:

```typescript
if (item.orders?.dispatched_at) continue;
const orderStatus = item.orders?.status;
if (orderStatus === 'closed' || orderStatus === 'cancelled' || orderStatus === 'dispatched') continue;
```

2. **Linha 105-106** - No filtro final dos grupos, incluir verificacao de status:

```typescript
.filter(g => {
  const order = g.ovenItems[0]?.orders;
  if (!order) return true;
  if (order.dispatched_at) return false;
  if (order.status === 'closed' || order.status === 'cancelled' || order.status === 'dispatched') return false;
  return true;
})
```

### Resultado

| Pedido | Status | dispatched_at | Antes | Depois |
|--------|--------|---------------|-------|--------|
| #9515 | cancelled | NULL | Aparece | Escondido |
| #6486 | closed | NULL | Aparece | Escondido |
| #6499 | closed | NULL | Aparece | Escondido |
| #6508 | dispatched | preenchido | Escondido | Escondido |
| Pedido ativo | pending | NULL | Aparece | Aparece |

Nenhuma mudanca no banco de dados, apenas logica de filtragem no frontend.
