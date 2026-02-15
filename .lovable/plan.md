

# Correcao: Despacho do Forno nao marca pedidos como "dispatched"

## Problema Encontrado

O botao "PRONTO" no tablet do forno marca os itens como `ready` e aciona a funcao `check_order_completion` no banco de dados. Essa funcao muda o status do pedido para `waiting_buffer` (delivery) ou `ready` (retirada/mesa), mas **nunca para `dispatched`**.

A funcao `handleMasterReady` no `OvenTimerPanel` apenas invalida caches do React Query -- ela nao chama a RPC `set_order_dispatched` que existe no banco. Por isso, `dispatched_at` nunca e preenchido e o historico (que busca pedidos com `dispatched_at IS NOT NULL`) fica sempre vazio.

## Solucao

Adicionar a chamada da RPC `set_order_dispatched` dentro de `handleMasterReady` no `OvenTimerPanel`. Quando todos os itens do forno estiverem prontos e nao houver itens pendentes de outros setores, o pedido sera marcado como `dispatched` no banco de dados.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

Na funcao `handleMasterReady`, antes de invalidar os caches, adicionar:

```text
1. Extrair o order_id do primeiro item do grupo
2. Chamar supabase.rpc('set_order_dispatched', { p_order_id: orderId })
3. Manter a logica de impressao e invalidacao de cache existente
```

A RPC `set_order_dispatched` ja existe no banco e faz:
```sql
UPDATE orders SET status = 'dispatched', dispatched_at = NOW() WHERE id = p_order_id;
```

### Observacao sobre pedidos delivery

Pedidos do tipo `delivery` normalmente passam pelo buffer antes do despacho (gerenciado pelo Dashboard administrativo). No fluxo do forno/tablet, o despacho direto faz sentido para pedidos de retirada/mesa/balcao. Para delivery, o `check_order_completion` ja envia para `waiting_buffer`. Portanto, a chamada do `set_order_dispatched` no forno deve respeitar essa logica: so despachar automaticamente se o pedido NAO for delivery (ou se todos os itens ja estiverem prontos e nao houver buffer ativo).

A implementacao verificara o `order_type` antes de chamar o RPC: se for `delivery`, nao chama `set_order_dispatched` (o buffer cuida disso); caso contrario, despacha diretamente.

## Arquivo Modificado

- **`src/components/kds/OvenTimerPanel.tsx`** -- adicionar chamada `supabase.rpc('set_order_dispatched')` em `handleMasterReady` para pedidos nao-delivery

