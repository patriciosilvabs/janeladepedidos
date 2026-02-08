
# Corrigir badge do Forno mostrando contagem incorreta

## Problema

O badge "2" na aba Forno aparece mesmo quando nao ha itens visiveis no painel. Isso acontece porque a contagem do badge usa todos os itens com status `in_oven`, sem filtrar pedidos cancelados. Porem o `OvenTimerPanel` internamente filtra pedidos cancelados/despachados, resultando em painel vazio mas badge com numero.

## Causa raiz

Em dois locais, a contagem de itens ignora o status do pedido pai:

1. **KDSItemsDashboard.tsx** (linha 21, 48-50): `inOvenItems.length` conta todos os itens `in_oven`, inclusive de pedidos cancelados
2. **DispatchDashboard.tsx** (linha 10): `activeItems` filtra por status do item mas nao verifica `orders.status`

## Solucao

Adicionar filtro para excluir itens cujo pedido pai esteja cancelado, despachado ou fechado, nas duas contagens de badge.

### Arquivo 1: `src/components/kds/KDSItemsDashboard.tsx`

Alterar a linha 21 para usar o hook com status `in_oven` e depois filtrar:

```
const { items: rawInOvenItems } = useOrderItems({ status: 'in_oven' });
const inOvenItems = rawInOvenItems.filter(i => {
  const orderStatus = i.orders?.status;
  return orderStatus !== 'cancelled' && orderStatus !== 'closed' && orderStatus !== 'dispatched';
});
```

### Arquivo 2: `src/components/DispatchDashboard.tsx`

Alterar a linha 10 para incluir filtro de pedido cancelado:

```
const activeItems = items.filter(i => {
  const orderStatus = i.orders?.status;
  if (orderStatus === 'cancelled' || orderStatus === 'closed' || orderStatus === 'dispatched') return false;
  return i.status === 'in_oven' || (i.status === 'ready' && i.oven_entry_at);
});
```

## Resultado

- Badge "Forno" so mostra numero quando ha itens reais (de pedidos ativos) no forno
- Quando todos os itens no forno pertencem a pedidos cancelados, o badge desaparece e a tela vazia fica consistente
