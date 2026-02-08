
# Corrigir itens ausentes no KDS do tablet

## Problema identificado

Ha dois problemas distintos que impedem o funcionamento correto do KDS no tablet:

### Problema 1: Pedidos sem itens (causa principal)
O pedido #6646 (external_id: 182085339) existe na tabela `orders` com status `pending`, porem nao possui nenhum registro na tabela `order_items`. Isso significa que a funcao `poll-orders` importou o pedido mas falhou ao criar os itens atomicos.

Como o pedido ja existe no banco, o polling subsequente o identifica como "existente" e nunca tenta recriar os itens. O dashboard de pedidos (que consulta `orders`) mostra o pedido, mas o KDS de itens (que consulta `order_items`) fica vazio.

### Problema 2: Erro React "Should have a queue"
O erro interno do React causa tela branca no tablet. Provavelmente causado pela combinacao de polling a cada 3s + realtime + invalidation de visibilidade disparando atualizacoes rapidas demais.

## Solucao

### 1. Adicionar auto-reparo de itens orfaos no hook `useOrderItems.ts`
Nao ha como corrigir retroativamente pelo polling. Mas podemos detectar e corrigir essa situacao no futuro adicionando uma verificacao no `poll-orders` que reprocessa pedidos pendentes sem itens.

### 2. Corrigir `poll-orders/index.ts` - adicionar reprocessamento de pedidos sem itens
No trecho que verifica pedidos pendentes existentes (linha ~466), alem de verificar cancelamento, tambem verificar se o pedido possui `order_items`. Se nao possuir, recriar os itens buscando os detalhes na API novamente.

```
Pseudocodigo:
- Para cada pedido pendente existente no banco:
  1. Verificar se possui order_items
  2. Se NAO possuir, buscar detalhes na API e chamar create_order_items_from_json
  3. Logar a acao de reparo
```

### 3. Corrigir o erro React em `useOrderItems.ts`
- Remover `refetchIntervalInBackground: true` (causa atualizacoes desnecessarias quando tablet esta em background)
- Aumentar `staleTime` para evitar re-renders desnecessarios: `staleTime: 2000`
- Adicionar `structuralSharing: true` explicitamente para evitar re-renders quando dados nao mudam

### 4. Adicionar ErrorBoundary no `KDSItemsDashboard.tsx`
Envolver o componente principal em um ErrorBoundary que exibe uma mensagem amigavel e permite recuperacao automatica, em vez de mostrar tela branca.

## Arquivos a modificar

1. **`supabase/functions/poll-orders/index.ts`** - Adicionar logica de reparo de pedidos sem itens no loop de verificacao de pedidos pendentes existentes (apos linha 473)
2. **`src/hooks/useOrderItems.ts`** - Ajustar configuracao de polling para evitar o erro React
3. **`src/components/kds/KDSItemsDashboard.tsx`** - Adicionar ErrorBoundary para recuperacao graciosa

## Secao tecnica

### Mudanca no poll-orders (principal)
Apos a verificacao de cancelamento de pedidos existentes, adicionar:
```typescript
// Verificar se pedido tem order_items, se nao, recriar
const { data: existingItems } = await supabase
  .from('order_items')
  .select('id')
  .eq('order_id', order.id)
  .limit(1);

if (!existingItems || existingItems.length === 0) {
  console.log(`[poll-orders] Order ${order.cardapioweb_order_id} has NO items, repairing...`);
  // Buscar detalhes na API e recriar items
  // (reutilizar logica existente de criacao de items)
}
```

### Mudanca no useOrderItems
```typescript
staleTime: 2000,
refetchInterval: sectorId ? 3000 : 5000,
refetchOnWindowFocus: true,
// Remover refetchIntervalInBackground
```

### ErrorBoundary
Componente simples que captura erros React e exibe botao de "Tentar novamente" com reload automatico apos 5 segundos.
