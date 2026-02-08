

# Corrigir classificacao de bebidas e bordas nos combos

## Diagnostico

O pedido #6637 ("Combo: Pizza G + Refri") foi explodido em 3 itens em vez de 1 por duas razoes:

### Causa 1: `#` ausente dos edge keywords

O campo `kds_edge_keywords` no banco contem:
```
Borda, Borda de Chocolate, ..., domzito, domzitos
```
Nao inclui `#`. Por isso, a opcao "# Massa Tradicional" nao e reconhecida como borda.

### Causa 2: keyword "pizza" muito generica no option_group_name

A keyword de sabor "pizza" casa com o `option_group_name` de TODAS as opcoes do combo, pois todas tem o prefixo "Combo: Pizza G + Refri - ...":

```text
option_group_name: "Combo: Pizza G + Refri - Refrigerante"
                          ^^^^^
                     contem "pizza" -> classificado como SABOR!
```

Resultado: 3 "flavor groups" em vez de 1, causando a explosao incorreta em 3 itens.

## Solucao

### 1. Adicionar `#` ao kds_edge_keywords (SQL)

```sql
UPDATE app_settings
SET kds_edge_keywords = '#, ' || kds_edge_keywords
WHERE id = 'default';
```

### 2. Remover option_group_name da classificacao de sabores no explodeComboItems

No `explodeComboItems` (em `poll-orders/index.ts` e `webhook-orders/index.ts`), a verificacao de sabor nao deve usar `option_group_name` pois os nomes dos grupos frequentemente contem "pizza" no prefixo do combo:

Antes:
```typescript
const isFlavor = !isEdge && flavorKeywords.some(k =>
  name.includes(k.toLowerCase()) ||
  (opt.option_group_name || '').toLowerCase().includes(k.toLowerCase())
);
```

Depois:
```typescript
const isFlavor = !isEdge && flavorKeywords.some(k =>
  name.includes(k.toLowerCase())
);
```

A classificacao por `option_group_name` fica apenas no RPC do banco (que processa o item individual depois da explosao, onde ja funciona corretamente).

### 3. Filtro pos-explosao para itens sem sabor

Apos a explosao, remover itens que ficaram apenas com complementos (sem sabores e sem bordas), mesclando seus complementos no primeiro item do grupo:

```typescript
// After explosion, merge complement-only items back into first item
const finalResult: any[] = [];
let pendingComplements: any[] = [];

for (const item of result) {
  const opts = item.options || [];
  const hasFlavor = opts.some(o => /* flavor check */);
  const hasEdge = opts.some(o => /* edge check */);

  if (!hasFlavor && !hasEdge && finalResult.length > 0) {
    // Merge these options as complements into the last flavor item
    pendingComplements.push(...opts);
  } else {
    finalResult.push(item);
  }
}

// Attach pending complements to first item
if (pendingComplements.length > 0 && finalResult.length > 0) {
  finalResult[0].options = [...finalResult[0].options, ...pendingComplements];
}
```

### 4. Deletar pedido #6637 para reimportacao

```sql
DELETE FROM order_items WHERE order_id = '5f0e460c-a734-4511-a1b2-2874edcb3db1';
DELETE FROM orders WHERE id = '5f0e460c-a734-4511-a1b2-2874edcb3db1';
```

## Arquivos alterados

- `supabase/functions/poll-orders/index.ts` - funcao explodeComboItems
- `supabase/functions/webhook-orders/index.ts` - mesma funcao
- SQL migration para adicionar `#` aos edge keywords

## Resultado esperado

Pedido #6637 reimportado como 1 unico card no KDS:
- Produto: Combo: Pizza G + Refri R$ 49,90
- Sabores: 1/2 BAURU (G) + 1/2 AMERICANA (G)
- Borda: # Massa Tradicional
- Complemento: Refrigerante 1 litro (exibido mas NAO gera card separado)

