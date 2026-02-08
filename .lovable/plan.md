
## Corrigir pedido travado no painel do forno

### Problema identificado

O pedido #6656 esta travado no painel "Forno" do tablet de despacho. Dados atuais:
- Item: status `ready`, com `oven_entry_at` e `ready_at` preenchidos
- Pedido: status `ready`, `all_items_ready = true`, mas `dispatched_at = NULL`

O item foi marcado como pronto, o `check_order_completion` rodou e marcou o pedido, mas o despacho automatico (`set_order_dispatched`) nunca foi executado com sucesso. O pedido ficou preso no painel porque o filtro do `OvenTimerPanel` so exclui pedidos com status `closed`, `cancelled` ou `dispatched` -- nao exclui `ready` nem `waiting_buffer`.

### Causa raiz

1. O auto-despacho no `handleMarkItemReady` so funciona para pedidos com exatamente 1 item (`totalItems === 1`), mas ele verifica `group.ovenItems.length + group.siblingItems.length`. Itens ready que aparecem como siblings podem inflar a contagem.
2. O filtro do `OvenTimerPanel` nao exclui pedidos que ja passaram pela fase do forno (status `ready` ou `waiting_buffer`).

### Solucao (3 mudancas)

#### 1. `src/components/kds/OvenTimerPanel.tsx` - Filtro + auto-despacho robusto

**Filtro**: Adicionar `waiting_buffer` a lista de exclusao e tratar `ready` com auto-despacho:

```typescript
.filter(g => {
  const order = g.ovenItems[0]?.orders;
  if (!order) return true;
  if (order.dispatched_at) return false;
  if (['closed', 'cancelled', 'dispatched', 'waiting_buffer'].includes(order.status)) return false;
  return true;
})
```

**Auto-despacho para todos os pedidos prontos**: Quando todos os itens do forno estao `ready` e nao ha siblings pendentes, despachar automaticamente (nao apenas single-item):

```typescript
// Apos markItemReady, verificar se TODOS os itens do grupo estao prontos
const allOvenReady = group.ovenItems.every(i => i.id === itemId || i.status === 'ready');
const pendingSiblings = group.siblingItems.filter(i => i.status !== 'ready');
if (allOvenReady && pendingSiblings.length === 0) {
  handleMasterReady(group.ovenItems);
}
```

#### 2. `src/components/kds/OvenTimerPanel.tsx` - Effect de seguranca para pedidos orfaos

Adicionar um `useEffect` que detecta pedidos onde todos os itens ja estao `ready` e o pedido nao foi despachado, e auto-despacha apos 3 segundos (safety net):

```typescript
useEffect(() => {
  for (const group of orderGroups) {
    const allReady = group.ovenItems.every(i => i.status === 'ready');
    const pendingSiblings = group.siblingItems.filter(i => i.status !== 'ready');
    if (allReady && pendingSiblings.length === 0 && group.ovenItems.length > 0) {
      // Auto-dispatch apos 3s como safety net
      const timer = setTimeout(() => handleMasterReady(group.ovenItems), 3000);
      return () => clearTimeout(timer);
    }
  }
}, [orderGroups]);
```

#### 3. Correcao imediata do pedido #6656

Executar migration SQL para despachar o pedido travado:

```sql
UPDATE orders SET status = 'dispatched', dispatched_at = NOW()
WHERE id = '003390b0-136c-410d-9bda-443a3046544a';
```

#### 4. Atualizar versao

Atualizar `src/lib/version.ts` para `v1.0.2` para confirmar deploy nos tablets.

### Arquivos a modificar

1. **`src/components/kds/OvenTimerPanel.tsx`** - Filtro expandido + auto-despacho robusto + safety net useEffect
2. **`src/lib/version.ts`** - Bump para v1.0.2
3. **Migration SQL** - Despachar pedido #6656 travado
