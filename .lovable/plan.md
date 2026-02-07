
## Correcao: Force Close deletando pedidos (mesmo bug do loop)

### Problema
A funcao `force-close-order` ainda usa `.delete()` (hard delete) em todos os cenarios. Isso causa o mesmo loop que ja corrigimos no `sync-orders-status`: o pedido e deletado, o `poll-orders` nao encontra o `external_id` no banco, e reimporta como novo.

### Alteracao

**`supabase/functions/force-close-order/index.ts`**

Substituir TODAS as chamadas `.delete()` por `.update({ status: 'closed' })`. Sao 4 locais:

1. Linha 48-51: pedido sem `external_id` -- update para `closed`
2. Linha 71-73: pedido sem `store_id` -- update para `closed`
3. Linha 109-112: CardapioWeb nao configurado -- update para `closed`
4. Linha 149-152: apos fechar no CardapioWeb com sucesso -- update para `closed`

Tambem deletar os `order_items` associados em todos os casos (para nao deixar itens orfaos no KDS):

```sql
DELETE FROM order_items WHERE order_id = orderId
```

### Resumo tecnico

- Trocar `.delete().eq('id', orderId)` por `.update({ status: 'closed' }).eq('id', orderId)` nos 4 pontos
- Antes de cada update, deletar os order_items do pedido
- O status `closed` nao aparece em nenhuma query do dashboard, entao o pedido some da interface
- O `external_id` permanece no banco, impedindo reimportacao pelo `poll-orders`
- O `cleanup-old-orders` (ja corrigido) vai limpar pedidos `closed` antigos automaticamente
