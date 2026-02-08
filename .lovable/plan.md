

# Corrigir filtro de categorias: usar campo `kind` da API + fallback por nome

## Problema

O pedido #6636 tem o item "Para quem Ama Atum!" que e uma pizza, mas o nome nao contem "Pizza". O filtro atual compara `allowed_categories` contra o `item.name`, o que nao funciona para produtos com nomes criativos.

A API do CardapioWeb retorna um campo `kind` nos itens (ex: "pizza", "drink", "side") que identifica a categoria real do produto. Precisamos usar esse campo como fonte primaria de classificacao.

## Solucao

Alterar a logica de filtro para usar uma combinacao de fontes, nesta ordem de prioridade:

1. `item.kind` (campo da API que identifica o tipo do produto)
2. `item.name` (fallback - nome do produto)
3. `item.option_group_name` ou qualquer outro campo descritivo disponivel

### Nova logica de filtro

```text
allowed_categories = ["Pizza", "Combo", "Lanche"]

Item: { name: "Para quem Ama Atum!", kind: "pizza" }
  -> kind "pizza" includes "pizza" -> ACEITO

Item: { name: "Regente 1 litro", kind: "drink" }
  -> kind "drink" nao contem nenhuma keyword -> nome tambem nao -> BLOQUEADO
```

Se o `kind` nao existir ou estiver vazio, o sistema faz fallback para o nome (comportamento atual).

## Mudancas tecnicas

### Arquivo 1: `supabase/functions/poll-orders/index.ts` (~linha 386)

Alterar o filtro de categorias:

```typescript
itemsToCreate = itemsToCreate.filter((item: any) => {
  const name = (item.name || '').toLowerCase();
  const kind = (item.kind || '').toLowerCase();
  if (!name && !kind) return true; // safety net

  return allowedCategories.some((c: string) => {
    const keyword = c.toLowerCase();
    return kind.includes(keyword) || name.includes(keyword);
  });
});
```

### Arquivo 2: `supabase/functions/webhook-orders/index.ts`

Mesma alteracao no filtro do webhook.

### Adicionar log do campo `kind`

No log de debug existente (linha 376-378), incluir o campo `kind` para confirmar que esta presente:

```typescript
console.log(`[poll-orders] First item sample: name="${item.name}", kind="${item.kind}"`);
```

### Recuperar pedido #6636

Deletar o pedido para reimportacao com a nova logica:

```sql
DELETE FROM orders WHERE id = '6cad946e-69ac-4122-8ba9-58455c119c58';
```

## Resultado esperado

| Item | kind | nome | Resultado |
|---|---|---|---|
| Para quem Ama Atum! | pizza | nao match | ACEITO (via kind) |
| Regente 1 litro | drink | nao match | BLOQUEADO |
| Pizza Grande | pizza | match | ACEITO (via ambos) |
| Combo 3 Pizzas G | combo | match | ACEITO (via ambos) |

