

## Corrigir: Pedidos de Retirada e Balcao nao devem passar pelo Buffer

### Problema

A funcao `check_order_completion` no banco de dados move **todos** os pedidos para `waiting_buffer` quando os itens ficam prontos, independentemente do tipo do pedido. Pedidos de retirada (`takeaway`/`takeout`), balcao (`counter`) e mesa (`dine_in`/`closed_table`) nao precisam esperar no buffer -- apenas pedidos de **delivery** devem aguardar.

### Fluxo correto por tipo de pedido

```text
Delivery:  itens prontos --> waiting_buffer --> (timer expira) --> ready + notifica CardapioWeb
Retirada:  itens prontos --> ready + notifica CardapioWeb imediatamente
Balcao:    itens prontos --> ready + notifica CardapioWeb imediatamente
Mesa:      itens prontos --> ready + notifica CardapioWeb imediatamente
```

### Mudanca tecnica

**Migracao SQL** -- Alterar a funcao `check_order_completion`:

A funcao precisa consultar o `order_type` do pedido. Se for `delivery`, continua movendo para `waiting_buffer`. Para qualquer outro tipo, move direto para `ready`.

```text
check_order_completion(p_order_id):
  1. Conta itens totais vs prontos
  2. Se todos prontos:
     a. Consulta order_type do pedido
     b. Se order_type = 'delivery' --> status = 'waiting_buffer'
     c. Se order_type != 'delivery' --> status = 'ready'
     d. Atualiza all_items_ready = true, ready_at = NOW()
```

A logica especifica:

- Buscar `order_type` da tabela `orders` para o pedido em questao
- Se `order_type` for `'delivery'` (ou NULL, para seguranca), mover para `waiting_buffer`
- Se `order_type` for qualquer outro valor (`takeaway`, `takeout`, `counter`, `dine_in`, `closed_table`), mover direto para `ready`

### O que NAO muda

- O fluxo de delivery continua identico (buffer --> timer --> ready --> notifica)
- O Dashboard continua mostrando pedidos no buffer normalmente
- O `OvenTimerPanel` nao precisa de alteracao (ja foi corrigido)
- A funcao `mark_item_ready` continua chamando `check_order_completion`

### Impacto

- Pedidos de retirada e balcao vao direto para a coluna "Pedido Pronto" ao terminar producao
- O CardapioWeb sera notificado imediatamente para esses tipos (quando o `moveToReady` ou mecanismo equivalente processar)
- Pedidos de delivery continuam respeitando o buffer normalmente

### Nota sobre notificacao

Pedidos que vao direto para `ready` (retirada/balcao) ainda precisam que o CardapioWeb seja notificado. Atualmente a notificacao acontece no `moveToReady` do Dashboard (que so roda para pedidos saindo do buffer). Sera necessario verificar se ha um mecanismo para notificar pedidos que chegam direto em `ready`, ou adicionar a chamada `notify-order-ready` dentro da propria funcao de banco (via `pg_net`/edge function trigger) ou no frontend ao detectar novos pedidos `ready`.

**Abordagem escolhida**: Chamar a edge function `notify-order-ready` a partir do `Dashboard.tsx` quando detectar pedidos com status `ready` que ainda nao foram notificados (`cardapioweb_notified = false`), usando um `useEffect`. Isso evita alterar a funcao SQL e mantem a logica de notificacao centralizada no frontend.

