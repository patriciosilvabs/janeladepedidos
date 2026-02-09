
## Corrigir notificacao ao CardapioWeb quando pedido fica pronto no Forno

### Problema

A funcao `handleMasterReady` no `OvenTimerPanel.tsx` despacha o pedido localmente (via `set_order_dispatched`) mas **nunca chama** a edge function `notify-order-ready`. Isso significa que pedidos despachados pelo painel do forno nao comunicam ao CardapioWeb que estao prontos.

A edge function ja existe e funciona -- ela e usada corretamente no `useOrders.ts` (Dashboard/Buffer). So falta chamar no fluxo do forno.

### Solucao

Adicionar a chamada `supabase.functions.invoke('notify-order-ready')` dentro de `handleMasterReady`, logo apos o `set_order_dispatched`.

### Mudanca unica

**`src/components/kds/OvenTimerPanel.tsx`** -- dentro de `handleMasterReady`, apos a linha `await supabase.rpc('set_order_dispatched', ...)`:

```text
// Notify CardapioWeb that order is READY
try {
  const { error: notifyError } = await supabase.functions.invoke('notify-order-ready', {
    body: { orderIds: [orderId] },
  });
  if (notifyError) {
    console.error('Erro ao notificar CardapioWeb:', notifyError);
  }
} catch (notifyErr) {
  console.error('Erro ao chamar notify-order-ready:', notifyErr);
}
```

Tambem bump de versao em `src/lib/version.ts` para `v1.0.5`.

### Arquivos a modificar

1. **`src/components/kds/OvenTimerPanel.tsx`** -- Adicionar chamada notify-order-ready no handleMasterReady
2. **`src/lib/version.ts`** -- Bump para v1.0.5
