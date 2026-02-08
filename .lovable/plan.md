

# Corrigir duplicacao de itens no bloco do Forno

## Problema

O pedido #6596 tem 3 pizzas, mas mostra 5 itens (4/5 no contador). Isso acontece porque itens com status `ready` que passaram pelo forno aparecem em **duas queries simultaneamente**:

1. **Query principal** (status `in_oven` + `ready`) -- captura os 2 itens ready com `oven_entry_at` e os adiciona como `ovenItems`
2. **Query de siblings** (status diferente de `in_oven` e `cancelled`) -- tambem captura esses mesmos 2 itens ready e os adiciona como `siblingItems`

Resultado: 3 itens reais aparecem como 5 (3 ovenItems + 2 siblingItems duplicados).

## Solucao

No `useMemo` do `OvenTimerPanel.tsx`, ao processar `siblingItems`, ignorar itens que ja estao no grupo como `ovenItems`. Basta verificar se o `item.id` ja existe no array `ovenItems` do grupo antes de adicionar.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

Na secao que processa siblings dentro do `useMemo`, adicionar uma verificacao:

```typescript
for (const item of siblingItems) {
  if (groups[item.order_id]) {
    // Evitar duplicatas: pular se o item ja esta nos ovenItems
    const alreadyInOven = groups[item.order_id].ovenItems.some(o => o.id === item.id);
    if (!alreadyInOven) {
      groups[item.order_id].siblingItems.push(item);
    }
  }
}
```

Isso garante que cada item apareca apenas uma vez no bloco, independente de quantas queries o retornem.

