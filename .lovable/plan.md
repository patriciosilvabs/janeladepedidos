

# Corrigir filtro de categorias: extrair categoria do nome do produto

## Problema

A API do CardapioWeb **nao possui um campo `category`** nos itens. Os campos retornados sao: `name`, `kind`, `options`, `quantity`, `status`, etc. A mudanca anterior inverteu a logica para bloquear itens sem categoria, o que bloqueou **todos** os itens de todos os pedidos, impedindo que aparecam nas bancadas do KDS.

O pedido #6631 existe na tabela `orders` (aparece no Dashboard admin), mas tem **0 registros** em `order_items`, entao nao aparece em nenhuma bancada.

## Solucao

Extrair a categoria a partir do **nome do produto** (`item.name`), comparando-o diretamente com as palavras-chaves configuradas em `allowed_categories` da loja. Se o nome do produto contem alguma das categorias permitidas, o item e aceito; caso contrario, e bloqueado.

### Nova logica de filtro

Em vez de depender de um campo `category` inexistente, o filtro usara o `item.name` diretamente:

```text
Exemplo: allowed_categories = ["Pizza", "Combo", "Lanche"]
Item name = "Pizza Grande - 1 Sabor"
  -> "pizza grande - 1 sabor" includes "pizza" -> ACEITO

Item name = "Refrigerante Coca-Cola 2L"
  -> nao contem nenhuma keyword -> BLOQUEADO
```

### Mudancas

**Arquivo 1: `supabase/functions/poll-orders/index.ts`** (linhas 298-316)

- Remover o mapeamento artificial de `category` (linhas 298-302) que tenta ler campos inexistentes
- Alterar o filtro para usar `item.name` em vez de `item.category`:

```typescript
// Filter by allowed categories if configured
const allowedCategories = store.allowed_categories;
if (allowedCategories && allowedCategories.length > 0) {
  const before = itemsToCreate.length;
  itemsToCreate = itemsToCreate.filter((item: any) => {
    const name = (item.name || '').toLowerCase();
    // If item has no name, allow it (safety net)
    if (!name) return true;
    // Check if the product name contains any allowed category keyword
    return allowedCategories.some((c: string) => name.includes(c.toLowerCase()));
  });
  console.log(`[poll-orders] Category filter by name: ${before} -> ${itemsToCreate.length} items`);
}
```

**Arquivo 2: `supabase/functions/webhook-orders/index.ts`** (linhas 218-236)

- Mesma correcao aplicada no webhook.

**Arquivo 3: `supabase/functions/webhook-orders/index.ts`** (linha 382)

- Remover o mapeamento de `category` no `parseOrderFromWebhook` tambem, ja que nao serve.

### Sobre o pedido #6631 ja existente

Como o pedido ja foi inserido sem `order_items`, sera necessario reimporta-lo. A solucao mais simples e deletar o pedido do banco e deixar o proximo poll reimportar:

```sql
DELETE FROM orders WHERE id = '449af86f-788b-407e-a389-74469393f297';
```

Isso permitira que o poll-orders reimporte o pedido com a nova logica de filtro, criando os `order_items` corretamente.

## Resumo

| O que muda | Antes | Depois |
|---|---|---|
| Campo usado no filtro | `item.category` (inexistente) | `item.name` (sempre presente) |
| Item sem match | Bloqueado | Bloqueado |
| Item sem nome | Bloqueado | Aceito (safety net) |
| "Pizza Grande" com filtro "Pizza" | Bloqueado (category vazio) | Aceito (nome contem "Pizza") |
| "Refrigerante" sem filtro "Refrigerante" | Bloqueado | Bloqueado |
