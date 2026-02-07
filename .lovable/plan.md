

## Problema: Pedidos voltando para produção em loop

### Causa raiz

O ciclo acontece entre duas funções do backend:

1. **sync-orders-status** verifica pedidos com status `pending`, `waiting_buffer` e `ready` no CardapioWeb
2. Quando o CardapioWeb responde que o pedido esta `closed` ou `delivered`, a funcao **DELETA** o pedido do banco de dados (hard delete)
3. Na proxima execucao do **poll-orders**, como o `external_id` nao existe mais no banco, o pedido e re-importado como novo
4. O pedido volta para producao com status `pending` - e o loop recomeça

```text
poll-orders          sync-orders-status          poll-orders
   |                        |                        |
   | importa pedido         |                        |
   | status: pending        |                        |
   |          ...           |                        |
   |    (pedido finalizado) |                        |
   |    status: ready       |                        |
   |                        | ve status "closed"     |
   |                        | no CardapioWeb         |
   |                        |                        |
   |                        | DELETA pedido          |
   |                        | do banco               |
   |                        |                        |
   |                        |                        | external_id sumiu
   |                        |                        | re-importa como novo!
   |                        |                        | status: pending (LOOP)
```

### Solucao

Em vez de deletar (hard delete) os pedidos finalizados, mudar o status para um valor terminal (`closed` ou `cancelled`). Assim o `external_id` permanece no banco e o poll-orders nao reimporta.

### Alteracoes

**1. `supabase/functions/sync-orders-status/index.ts`**

- Substituir todas as chamadas `.delete()` de pedidos cancelados/finalizados por `.update({ status: 'closed' })` ou `.update({ status: 'cancelled' })`
- Pedidos cancelados no CardapioWeb: `status = 'cancelled'`
- Pedidos finalizados (closed/delivered): `status = 'closed'`
- Pedidos 404 (nao encontrados): `status = 'cancelled'`
- Remover `ready` do filtro de status na query (linha 54), pois pedidos ready ja foram processados localmente e nao devem ser re-sincronizados com a API externa. Manter apenas `['pending', 'waiting_buffer']`

**2. `supabase/functions/poll-orders/index.ts`**

- Na query que busca `external_id` existentes (linhas 195-199), nenhuma mudanca necessaria -- ela ja busca sem filtro de status, entao pedidos com status `closed`/`cancelled` serao encontrados e bloqueiam reimportacao
- Na verificacao de pedidos pendentes cancelados (linhas 332-387), trocar a chamada `cancel_order_with_alert` para tambem garantir que o pedido nao e deletado (verificar a RPC)

**3. `supabase/functions/cleanup-old-orders/index.ts`**

- Adicionar limpeza de pedidos com status `closed` e `cancelled` que sejam mais antigos que `maxAgeHours` -- isso substitui a limpeza que antes era imediata
- Assim os pedidos terminais ficam no banco tempo suficiente para nao serem reimportados, mas nao acumulam indefinidamente

### Detalhes tecnicos

- Os status `closed` e `cancelled` nao aparecem em nenhuma query de dashboard (que filtram por `pending`, `waiting_buffer`, `ready`, `dispatched`), entao nao afetam a interface
- A funcao `cancel_order_with_alert` (RPC) precisa ser verificada para garantir que faz update de status e nao delete -- se deletar, precisa ser ajustada tambem
- Nenhuma mudanca no frontend e necessaria
