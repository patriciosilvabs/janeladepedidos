

## Plano: Filtrar Pedidos Aguardando Pagamento

### Problema Identificado

O sistema está importando pedidos para o KDS/tablet antes do cliente confirmar o pagamento. No CardápioWeb, pedidos que ainda estão "Aguardando pagamento" chegam com status como `waiting_confirmation` ou `pending`, e o sistema atual os importa imediatamente.

Pelas imagens:
- Dashboard mostra pedido #5130 com badge "Aguardando pagamento"
- Mesmo pedido já aparece no tablet de produção prontos para iniciar

---

### Solução

Modificar as duas funções de importação para **ignorar pedidos que ainda não foram confirmados/pagos**. Apenas pedidos com status `confirmed`, `preparing`, `ready`, `released` ou similares devem entrar no fluxo de produção.

---

### Parte 1: Atualizar Webhook (webhook-orders)

**Arquivo:** `supabase/functions/webhook-orders/index.ts`

**Alterações:**

1. Modificar o switch case (linhas 481-520) para **NÃO** processar eventos com status `pending` ou `waiting_confirmation`

2. Adicionar lógica no bloco default (linha 509):

```text
Antes:  if (status === 'confirmed' || status === 'pending' || status === 'waiting_confirmation')
Depois: if (status === 'confirmed')
```

3. Criar handler específico para `order.confirmed` que é quando o pagamento foi aceito

4. Ignorar `order.placed` e `order.created` com status não confirmado - esses eventos acontecem antes do pagamento

---

### Parte 2: Atualizar Polling (poll-orders)

**Arquivo:** `supabase/functions/poll-orders/index.ts`

**Alterações:**

1. Expandir lista de status ignorados (linha 136) para incluir status de pré-pagamento:

```typescript
// Antes
const ignoredStatuses = ['canceled', 'cancelled', 'rejected'];

// Depois  
const ignoredStatuses = [
  'canceled', 
  'cancelled', 
  'rejected',
  'pending',
  'waiting_confirmation',
  'awaiting_payment',
  'placed'  // Pedido realizado mas não confirmado
];
```

2. Criar lista de status permitidos (abordagem mais segura):

```typescript
const allowedStatuses = [
  'confirmed',
  'preparing', 
  'ready',
  'dispatched',
  'released',
  'on_the_way',
  'delivered'
];

// Filtrar apenas pedidos com status permitido
const activeOrders = ordersData.filter(order => {
  const status = (order.status || '').toLowerCase();
  return allowedStatuses.includes(status);
});
```

---

### Fluxo Correto Após Alterações

```text
CardápioWeb                    Sistema
-----------                    -------
Pedido criado (pending)   -->  Ignorado
Aguardando pagamento      -->  Ignorado  
Pagamento confirmado      -->  IMPORTA para KDS
(status: confirmed)            (aparece nos tablets)
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/webhook-orders/index.ts` | Aceitar apenas `order.confirmed`, ignorar `pending` e `waiting_confirmation` |
| `supabase/functions/poll-orders/index.ts` | Adicionar filtro por status permitidos (confirmed, preparing, etc.) |

---

### Considerações

- **Pedidos de mesa (closed_table)**: Mantêm comportamento especial atual - são importados quando fechados
- **Fallback**: Se um pedido nunca receber evento `confirmed`, será capturado pelo polling quando mudar de status
- **Logs**: Adicionar log quando pedido é ignorado por status de pagamento para facilitar debug
- **Backward compatibility**: Pedidos já importados não são afetados

