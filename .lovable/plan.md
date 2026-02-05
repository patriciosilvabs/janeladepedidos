

# Plano: Capturar Pedidos de Mesa do CardapioWeb

## Problema Identificado

Apos analise dos logs e codigo, identifiquei duas causas principais:

### 1. Limitacao da API CardapioWeb
Conforme documentado, pedidos de Mesa/Comanda (`closed_table`) possuem uma **limitacao tecnica da API**: eles so ficam disponiveis para integracao **apos serem finalizados ou cancelados** pelo estabelecimento. Isso e uma restricao do CardapioWeb, nao do sistema.

### 2. Filtro de Status Excessivo
O codigo atual filtra pedidos com status `closed`, mas pedidos de Mesa chegam com esse status (pois so aparecem apos fechamento):

```typescript
// Linha 118 - Este filtro REMOVE pedidos de mesa
const ignoredStatuses = ['closed', 'canceled', 'cancelled', 'rejected', 'delivered', 'dispatched'];
```

## Solucao Proposta

### Modificar a logica de filtragem para:

1. **Nao ignorar `closed` quando `order_type` for mesa** (`closed_table`, `dine_in`, `table`)
2. **Adicionar log para debug** de order_types recebidos
3. **Adicionar `closed_table` ao mapeamento de labels**

## Mudancas no Codigo

### Arquivo: `supabase/functions/poll-orders/index.ts`

| Local | Alteracao |
|-------|-----------|
| Linha 9-17 | Adicionar `closed_table: 'Mesa'` ao mapeamento |
| Linha 117-122 | Modificar filtro para permitir pedidos de mesa com status closed |
| Apos linha 110 | Adicionar log com todos order_types encontrados |

### Codigo Atualizado

**1. Mapeamento de labels (linhas 8-18):**
```typescript
function getOrderTypeLabel(orderType: string): string {
  const labels: Record<string, string> = {
    'delivery': 'Delivery',
    'dine_in': 'Mesa',
    'table': 'Mesa',
    'closed_table': 'Mesa',  // NOVO
    'takeaway': 'Retirada',
    'takeout': 'Retirada',
    'counter': 'Balcão',
    'onsite': 'Balcão',
  };
  return labels[orderType] || orderType;
}
```

**2. Novo filtro inteligente (linhas 117-130):**
```typescript
// Tipos de pedido que sao de mesa (chegam com status closed)
const tableOrderTypes = ['closed_table', 'dine_in', 'table'];

// Log para debug dos order_types recebidos
const orderTypesFound = [...new Set(ordersData.map(o => o.order_type))];
console.log(`[poll-orders] Order types found:`, orderTypesFound.join(', '));

// Filtrar pedidos ativos OU pedidos de mesa (que chegam como closed)
const ignoredStatuses = ['canceled', 'cancelled', 'rejected', 'delivered', 'dispatched'];
const activeOrders = ordersData.filter(order => {
  const status = (order.status || '').toLowerCase();
  const orderType = (order.order_type || '').toLowerCase();
  
  // Permitir pedidos de mesa mesmo com status closed
  if (tableOrderTypes.includes(orderType) && status === 'closed') {
    return true;
  }
  
  // Para outros tipos, ignorar status finalizados
  return !ignoredStatuses.includes(status) && status !== 'closed';
});
```

## Fluxo Esperado Apos a Mudanca

```
API CardapioWeb retorna 71 pedidos
    |
    v
Log: "Order types found: delivery, takeout, closed_table"
    |
    v
Filtro identifica pedidos closed_table com status=closed
    |
    v
Pedidos de Mesa sao importados com order_type='closed_table'
    |
    v
Badge verde "Mesa" aparece no Dashboard
```

## Consideracoes Importantes

1. **Pedidos de Mesa so aparecem depois de fechados** - Isso e uma limitacao do CardapioWeb, nao do sistema
2. **Duplicatas sao evitadas** pelo check de `external_id` existente
3. **O badge visual ja funciona** para `dine_in` e `table`, basta adicionar `closed_table`

## Resultado Esperado

- Pedidos de Mesa serao importados quando fechados no CardapioWeb
- Badge verde "Mesa" aparecera na interface
- Log mostrara quais tipos de pedido a API esta retornando (para debug futuro)

