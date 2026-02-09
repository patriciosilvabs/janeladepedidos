
## Corrigir pizza meio a meio aparecendo em bancadas diferentes

### Problema

Pizzas meio a meio (com "1/2" no nome do sabor) estao sendo separadas em bancadas diferentes. Isso acontece porque:

1. A funcao `explodeComboItems` no poll-orders separa sabores por `option_group_id` -- cada metade tem um group_id diferente
2. Cada item separado e entao enviado ao banco, onde o balanceador de carga distribui para bancadas diferentes
3. O banco ja tem deteccao de "1/2" (`v_all_half`), mas ela so roda DEPOIS da explosao -- quando os sabores ja chegam separados, cada item tem apenas 1 sabor e nao dispara a logica

### Solucao

Adicionar deteccao de meio a meio na funcao `explodeComboItems` (edge function), ANTES de separar os itens. Se todos os sabores de todos os grupos comecam com "1/2", "1/2" ou "meia", pular a explosao e manter como um unico item.

### Mudancas

1. **`supabase/functions/poll-orders/index.ts`** -- funcao `explodeComboItems` (linhas 46-83):
   - Antes de explodir, coletar todos os nomes de sabores de todos os grupos
   - Verificar se TODOS comecam com `1/2`, `1/2` ou `meia` (case-insensitive)
   - Se sim, tratar como 1 grupo so (pular a explosao), mantendo o item intacto
   - Isso garante que o banco receba o item com multiplos sabores e ative a logica `v_all_half`

2. **`src/lib/version.ts`** -- Bump para `v1.0.4`

### Detalhes tecnicos

Antes da linha que faz `if (flavorGroupKeys.length <= 1)`, inserir:

```text
// Detect half-and-half: if ALL flavors across ALL groups
// start with "1/2", "½", or "meia", skip explosion
const allFlavors = Object.values(flavorGroups).flat();
const allHalf = allFlavors.length > 1 && allFlavors.every(f => {
  const n = (f.name || '').trim();
  return /^(1\/2|½|meia)\s/i.test(n);
});

if (allHalf) {
  console.log(`[explodeCombo] Half-and-half detected for "${item.name}", keeping as single item`);
  result.push(item);
  continue;
}
```

Isso resolve o problema na raiz: a pizza meio a meio chega ao banco como um unico item, o balanceador atribui a UMA bancada so, e os sabores ficam juntos no card do KDS.
