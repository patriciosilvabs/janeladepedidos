

## Corrigir importacao parcial de itens do pedido #6759

### Problema

O pedido #6759 tem 3 itens na API do CardapioWeb:
1. **Pizza Grande | Massa Artesanal** (com Borda de Cheddar + sabores) -- importado com sucesso
2. **Pizza Chocolate Branco (G)** -- NAO importado (perdido)
3. **Domzitos de chocolate preto e coco ralado (G)** -- NAO importado (filtrado por `allowed_categories` na epoca)

Os itens foram perdidos por dois motivos:
- "Domzitos" nao estava nas `allowed_categories` da loja (ja corrigido)
- "Pizza Chocolate Branco (G)" deveria ter passado no filtro (contem "Pizza"), mas possivelmente foi perdida na funcao `create_order_items_from_json` por nao ter opcoes/sabores (item simples sem opcionais)

Alem disso, o mecanismo de **auto-reparo** so atua quando o pedido tem **ZERO itens**. Como o pedido #6759 ja tem 1 item, a reparacao nunca e acionada -- itens faltantes ficam perdidos permanentemente.

### Solucao em duas partes

#### Parte 1: Reparo imediato do pedido #6759

Chamar manualmente a funcao `create_order_items_from_json` para os 2 itens faltantes, usando os dados ja armazenados no campo `orders.items` do pedido.

#### Parte 2: Melhorar auto-reparo para itens parciais

Alterar a logica de reparo no `poll-orders/index.ts` para comparar a **quantidade de itens esperada** (campo `orders.items` no banco) com a **quantidade real de `order_items`**. Se houver diferenca, re-processar os itens faltantes.

### Mudancas tecnicas

**1. `supabase/functions/poll-orders/index.ts`**

Na secao de auto-reparo (linhas ~488-570), trocar a verificacao de "zero items" por comparacao de contagem:

```text
// ANTES:
const { data: orderItems } = await supabase
  .from('order_items')
  .select('id')
  .eq('order_id', order.id)
  .limit(1);

if (!orderItems || orderItems.length === 0) {

// DEPOIS:
// Buscar contagem real de items + dados do pedido para comparar
const { data: orderItems } = await supabase
  .from('order_items')
  .select('id')
  .eq('order_id', order.id);

const { data: orderData } = await supabase
  .from('orders')
  .select('items')
  .eq('id', order.id)
  .single();

const actualCount = orderItems?.length || 0;
const rawItems = orderData?.items || [];
const expectedCount = Array.isArray(rawItems) ? rawItems.length : 0;

if (actualCount < expectedCount) {
  // Deletar items existentes e re-criar todos
  // (mais seguro que tentar criar apenas os faltantes)
```

Quando detectar diferenca:
- Deletar os `order_items` existentes do pedido
- Re-buscar detalhes da API (ou usar `orders.items`)
- Aplicar filtro de categorias e combo explosion
- Chamar `create_order_items_from_json` novamente com todos os itens

Tambem adicionar log para rastreabilidade:
```text
console.log(`[poll-orders] Order ${order.cardapioweb_order_id} has ${actualCount}/${expectedCount} items, repairing...`);
```

**2. `src/lib/version.ts`** -- Bump para `v1.0.7`

### Reparo manual do pedido #6759

Apos deploy da correcao, o proximo ciclo de polling detectara que o pedido #6759 tem 1/3 itens e re-processara automaticamente. Como "Domzitos" ja esta nas categorias permitidas, todos os 3 itens serao criados.

### Risco

A estrategia de "deletar e re-criar" pode afetar itens que ja estao em preparo (status `in_prep` ou `in_oven`). Para mitigar, a logica so ira deletar/re-criar itens de pedidos que ainda estejam com status `pending`.

