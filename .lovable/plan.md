

## Corrigir fluxo: Painel do Forno deve enviar para Buffer, nao para Despachado

### Problema

Quando todos os itens do forno ficam prontos, o `OvenTimerPanel` chama `set_order_dispatched` (linha 166), que move o pedido direto para status `dispatched`, pulando completamente a etapa de buffer. Alem disso, chama `notify-order-ready` imediatamente (linha 170), notificando o CardapioWeb antes da hora.

O fluxo atual (ERRADO):
```text
Itens prontos no forno --> dispatched + notifica CardapioWeb
```

O fluxo correto:
```text
Itens prontos no forno --> waiting_buffer --> (timer do buffer expira) --> ready + notifica CardapioWeb
```

### Solucao

A funcao `mark_item_ready` no banco de dados JA chama `check_order_completion`, que automaticamente move o pedido para `waiting_buffer` quando todos os itens estao prontos. Portanto, o `handleMasterReady` esta fazendo trabalho duplicado e ERRADO.

### Mudancas tecnicas

**`src/components/kds/OvenTimerPanel.tsx`** -- Simplificar `handleMasterReady`:

1. **Remover** a chamada a `set_order_dispatched` (o DB trigger ja cuida de mover para buffer)
2. **Remover** a chamada a `notify-order-ready` (a notificacao deve ocorrer apenas quando sair do buffer, no Dashboard via `moveToReady`)
3. **Manter** apenas a impressao do ticket (se habilitada) e o callback `onDispatch` para o historico visual do painel
4. **Manter** a invalidacao de cache para atualizar a UI

A funcao ficara assim:

```text
const handleMasterReady = async (ovenItems: OrderItemWithOrder[]) => {
  const orderId = ovenItems[0]?.order_id;
  const firstItem = ovenItems[0];

  // Print dispatch ticket (opcional)
  if (printEnabled && dispatchPrintEnabled && printerId && ovenItems.length > 0) {
    try {
      const ticketContent = formatDispatchTicket(firstItem);
      await printRaw(printerId, ticketContent, ...);
    } catch (printError) { ... }
  }

  // Invalidar cache para refletir que o pedido saiu do forno e foi para buffer
  queryClient.invalidateQueries({ queryKey: ['order-items'] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });

  // Callback visual para historico do painel
  if (orderId) {
    const group = orderGroups.find(g => g.orderId === orderId);
    if (group && onDispatch) {
      onDispatch({ ... });
    }
  }
};
```

**Tambem ajustar o safety net** (useEffect na linha 196-208) para usar a mesma logica simplificada.

### O que NAO muda

- A logica de `mark_item_ready` (RPC no banco) continua chamando `check_order_completion`
- `check_order_completion` continua movendo o pedido para `waiting_buffer` quando todos os itens estao prontos
- O Dashboard continua mostrando pedidos no buffer e, quando o timer expira, chama `moveToReady` que notifica o CardapioWeb
- O fluxo do botao "PRONTO" no Dashboard (que marca todos os itens de uma vez) continua funcionando igual

### Impacto

- Pedidos que saem do forno vao corretamente para o buffer antes de notificar o CardapioWeb
- O CardapioWeb so sera notificado quando o buffer expirar (via Dashboard)
- O timer do buffer funciona normalmente, respeitando as configuracoes por dia da semana e o buffer dinamico

