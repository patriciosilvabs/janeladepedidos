

## Correção: Pedidos prontos travados no Despacho

### Problema

A função `check_order_completion` move pedidos non-delivery diretamente para `status = 'ready'` (sem passar por `waiting_buffer`). Porém, o filtro do `OvenTimerPanel` só exclui os status `closed`, `cancelled`, `dispatched` e `waiting_buffer` -- **não exclui `ready`**.

Resultado: pedidos de retirada/balcão/mesa ficam travados na tela do despacho após serem marcados como prontos.

Dados confirmados no banco: múltiplos pedidos com `order_status = 'ready'` e todos os itens `ready`, permanecendo visíveis no painel.

### Solução

**1. `src/components/kds/OvenTimerPanel.tsx`** (linha 110)

Adicionar `'ready'` à lista de status excluídos no filtro de `orderGroups`:

```
if (['closed', 'cancelled', 'dispatched', 'waiting_buffer', 'ready'].includes(order.status)) return false;
```

**2. `src/lib/version.ts`**

Atualizar para `v1.0.14`.

### Impacto

Correção de uma linha. Pedidos cujo status do order já é `ready` serão removidos do painel do forno imediatamente, sem afetar o fluxo dos itens individuais nas bancadas KDS.

