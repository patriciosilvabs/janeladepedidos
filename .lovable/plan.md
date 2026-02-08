

# Desmembrar combos de pizza usando `option_group_id`

## Problema

O CardapioWeb envia um combo de 3 pizzas como **1 unico item** com todas as opcoes misturadas. O campo `option_group_id` diferencia cada pizza:

```text
option_group_id 953027 -> Pizza 1: 1/2 Milho Verde + 1/2 Bauru
option_group_id 953168 -> Pizza 2: 1/2 Milho Verde + 1/2 Bauru
option_group_id 953169 -> Pizza 3: 1/2 Calabresa + 1/2 Marguerita
option_group_id 953031 -> Bordas (compartilhadas entre as pizzas)
```

O sistema atual trata tudo como 1 item so, gerando apenas 1 card no KDS.

## Solucao

Criar uma funcao `explodeComboItems` que roda **antes** de enviar os itens para o banco. Essa funcao:

1. Identifica combos: itens com multiplos `option_group_id` contendo sabores (keywords de flavor)
2. Agrupa opcoes de sabor por `option_group_id` - cada grupo vira um item separado
3. Distribui bordas proporcionalmente entre os itens (pareando por posicao)
4. Complementos e observacoes ficam apenas no primeiro item (padrao existente)

### Exemplo do resultado

Antes (1 item):
```text
"Combo: 3 Pizzas G" com 8 opcoes misturadas
```

Depois (3 itens):
```text
Item 1: "Combo: 3 Pizzas G" | sabores: 1/2 Milho Verde + 1/2 Bauru | borda: # Massa Tradicional
Item 2: "Combo: 3 Pizzas G" | sabores: 1/2 Milho Verde + 1/2 Bauru | borda: # Massa Tradicional
Item 3: "Combo: 3 Pizzas G" | sabores: 1/2 Calabresa + 1/2 Marguerita | borda: # Borda de Cheddar
```

## Arquivos a alterar

### `supabase/functions/poll-orders/index.ts`

Adicionar funcao `explodeComboItems` e chama-la antes de `create_order_items_from_json`:

```typescript
function explodeComboItems(items: any[], edgeKeywords: string[], flavorKeywords: string[]): any[] {
  const result: any[] = [];

  for (const item of items) {
    const options = item.options || [];
    if (options.length === 0) {
      result.push(item);
      continue;
    }

    // Classify each option as edge, flavor, or complement
    // Group flavors by option_group_id
    const flavorGroups: Record<string, any[]> = {};
    const edgeOptions: any[] = [];
    const complementOptions: any[] = [];

    for (const opt of options) {
      const name = (opt.name || '').toLowerCase();
      const isEdge = edgeKeywords.some(k =>
        k === '#' ? name.startsWith('#') : name.includes(k.toLowerCase())
      );
      const isFlavor = !isEdge && flavorKeywords.some(k =>
        name.includes(k.toLowerCase()) ||
        (opt.option_group_name || '').toLowerCase().includes(k.toLowerCase())
      );

      if (isEdge) {
        edgeOptions.push(opt);
      } else if (isFlavor) {
        const groupId = String(opt.option_group_id || 'default');
        if (!flavorGroups[groupId]) flavorGroups[groupId] = [];
        flavorGroups[groupId].push(opt);
      } else {
        complementOptions.push(opt);
      }
    }

    const flavorGroupKeys = Object.keys(flavorGroups);

    // If only 0 or 1 flavor group, no explosion needed
    if (flavorGroupKeys.length <= 1) {
      result.push(item);
      continue;
    }

    // Explode: each flavor group becomes a separate item
    flavorGroupKeys.forEach((groupId, index) => {
      const groupFlavors = flavorGroups[groupId];
      // Pair edge by index (or distribute by quantity)
      const pairedEdge = index < edgeOptions.length ? [edgeOptions[index]] : [];

      const newOptions = [
        ...groupFlavors,
        ...pairedEdge,
        ...(index === 0 ? complementOptions : []),  // complements on first only
      ];

      result.push({
        ...item,
        quantity: 1,
        options: newOptions,
        observation: index === 0 ? item.observation : null,
      });
    });

    console.log(`[explodeCombo] Exploded "${item.name}" into ${flavorGroupKeys.length} items`);
  }

  return result;
}
```

Chamar antes do RPC:

```typescript
// Explode combos before sending to DB
const edgeKw = (settings.kds_edge_keywords || '#, Borda').split(',').map(s => s.trim());
const flavorKw = (settings.kds_flavor_keywords || '(G), (M), (P), Sabor').split(',').map(s => s.trim());
itemsToCreate = explodeComboItems(itemsToCreate, edgeKw, flavorKw);
```

### `supabase/functions/webhook-orders/index.ts`

Mesma funcao `explodeComboItems` e mesma chamada antes do RPC.

### Buscar keywords do `app_settings`

Ambas as funcoes ja tem acesso ao Supabase. Precisamos buscar `kds_edge_keywords` e `kds_flavor_keywords` do `app_settings` para usar na classificacao.

### Distribuicao de bordas

O sistema de bordas distribui com logica posicional:
- Se ha N bordas e N pizzas: cada borda vai para sua pizza correspondente
- Se ha menos bordas que pizzas: as pizzas excedentes ficam sem borda
- A borda "# Massa Tradicional" com `quantity: 2` sera expandida em 2 entradas antes da distribuicao

### Recuperar pedido #6632

Deletar o pedido existente para reimportacao com a nova logica:

```sql
DELETE FROM order_items WHERE order_id = 'f8f4e2af-1c28-4844-adde-8979c14a88cc';
DELETE FROM orders WHERE id = 'f8f4e2af-1c28-4844-adde-8979c14a88cc';
```

## Resultado esperado no KDS

3 cards separados, cada um com:
- Nome do produto (Combo: 3 Pizzas G)
- 2 sabores meio a meio
- Sua borda correspondente
- Complementos apenas no primeiro card

