

## Adicionar deteccao de meio-a-meio no webhook-orders

### Problema

A funcao `webhook-orders/index.ts` NAO possui a verificacao de pizza meio-a-meio que ja existe no `poll-orders/index.ts`. Quando um pedido chega via webhook (como o #9672), os sabores "1/2 MUSSARELA (G)" e "1/2 PORTUGUESA (G)" estao em `option_group_id` diferentes (955264 vs 955249), gerando 2 grupos de sabores. Sem a verificacao de meio-a-meio, o sistema explode o item em 2 itens separados -- cada um indo para uma bancada diferente.

No `poll-orders` ja existe esta logica (linhas 48-60) que detecta quando TODOS os sabores comecam com "1/2", "meia" ou "1/2" e pula a explosao. Falta replicar no webhook.

### Correcao

**`supabase/functions/webhook-orders/index.ts`** -- Adicionar a deteccao de meio-a-meio ANTES da verificacao de `flavorGroupKeys.length <= 1` (entre as linhas 117 e 119):

```text
const flavorGroupKeys = Object.keys(flavorGroups);

// NOVO: Detectar meio-a-meio
const allFlavors = Object.values(flavorGroups).flat();
const allHalf = allFlavors.length > 1 && allFlavors.every((f: any) => {
  const n = (f.name || '').trim();
  return /^(1\/2|½|meia)\s/i.test(n);
});

if (allHalf) {
  console.log(`[explodeCombo] Half-and-half detected for "${item.name}", keeping as single item`);
  result.push({ ...item, _source_item_id: item.item_id || item.name });
  continue;
}

if (flavorGroupKeys.length <= 1) {
```

Isso replica exatamente a mesma logica que ja funciona no `poll-orders`.

### Reparo do pedido #9672

O pedido #9672 ja tem 3 order_items (explodidos incorretamente). O auto-reparo v1.0.7 ira detectar que tem 3 items mas o JSON original tem apenas 1 item... porem nesse caso `actualCount > expectedCount`, entao NAO vai reparar automaticamente (so repara quando `actualCount < expectedCount`).

Sera necessario deletar manualmente os order_items do pedido #9672 e re-processar para que a nova logica (com deteccao de meio-a-meio) crie um unico item correto.

### Bump de versao

**`src/lib/version.ts`** -- Manter em `v1.0.8` (ja esta nessa versao, esta e uma correcao complementar).

