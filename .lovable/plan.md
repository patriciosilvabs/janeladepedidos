
# Histórico do Forno — Controle interno (somente leitura)

## Abordagem

A aba "Histórico" no painel do forno é apenas para conferência interna do operador. Ela **não altera o fluxo** de pedidos — não chama `set_order_dispatched` nem modifica status.

## Implementação

O hook `useDispatchedOrders` busca itens que passaram pelo forno (`oven_entry_at IS NOT NULL`) e estão prontos (`status = 'ready'`), agrupados por pedido. Isso permite ao funcionário conferir o que já saiu do forno sem interferir no fluxo existente de buffer/despacho.
