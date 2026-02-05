

# Plano: Corrigir Loop de Pedidos - Filtrar por Status da API

## Problema Identificado

A Edge Function `poll-orders` está **inserindo pedidos já finalizados** ("closed", "canceled") como novos pedidos "pending". Isso causa:
- Pedidos antigos aparecem repetidamente
- Impossível finalizar (já estão fechados na API)
- Loop infinito de importação

### Evidência nos Logs

```text
Order details raw: {
  "id": 180660823,
  "status": "closed",        ← Pedido FECHADO na API
  "order_type": "takeout",
  ...
}

Inserted new order: 180660823  ← Inserido como PENDING local!
```

### Por que os erros de "duplicate key" continuam?

A correção do `external_id` foi aplicada ao código, mas **a Edge Function antiga ainda estava rodando**. Eu acabei de fazer o redeploy. Porém, o problema maior é que **pedidos fechados não deveriam ser importados**.

---

## Solucao

Adicionar filtro para **ignorar pedidos com status finalizado** antes de tentar inserir.

### Mudanca no poll-orders/index.ts

Apos buscar os detalhes do pedido (linha 155), adicionar verificacao de status:

```typescript
// Linha 155 - Apos buscar orderDetails

// NOVO: Ignorar pedidos já finalizados na API do CardapioWeb
const apiStatus = orderDetails.status || order.status;
const ignoredStatuses = ['closed', 'canceled', 'cancelled', 'rejected', 'delivered'];

if (ignoredStatuses.includes(apiStatus)) {
  console.log(`[poll-orders] Skipping order ${cardapiowebOrderId} - status "${apiStatus}" (already finalized)`);
  continue;
}

// Continua com a insercao apenas para pedidos ativos
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Adicionar filtro de status antes de inserir |

---

## Limpeza de Dados

Apos aplicar a correcao, precisamos limpar os pedidos antigos que foram importados incorretamente:

```sql
-- Deletar pedidos pending que sao de mesas fechadas ou antigos
DELETE FROM orders 
WHERE status = 'pending' 
  AND order_type IN ('closed_table', 'closed')
  OR (status = 'pending' AND created_at < NOW() - INTERVAL '2 hours');
```

---

## Impacto das Mudancas

| Antes | Depois |
|-------|--------|
| Importa todos os pedidos da API | Importa apenas pedidos ativos |
| Pedidos "closed" viram "pending" | Pedidos finalizados sao ignorados |
| Loop infinito de importacao | Apenas novos pedidos sao processados |
| 40+ pedidos acumulados | Apenas pedidos reais pendentes |

---

## Ordem de Execucao

1. Atualizar `poll-orders/index.ts` com filtro de status
2. Redeployar a Edge Function
3. Executar limpeza de pedidos antigos no banco
4. Testar que apenas pedidos novos/ativos sao importados

---

## Secao Tecnica

### Status da API CardapioWeb

Com base nos logs, os status possiveis sao:
- `confirmed` - Pedido confirmado, aguardando preparo
- `closed` - Pedido finalizado/entregue
- `canceled` / `cancelled` - Pedido cancelado
- `rejected` - Pedido rejeitado
- `delivered` - Pedido entregue

### Filtro Recomendado

Importar apenas pedidos com status:
- `confirmed` - Aguardando producao
- `new` ou `pending` - Se existirem

Ignorar:
- `closed`, `canceled`, `cancelled`, `rejected`, `delivered`

### Redeploy da Edge Function

O codigo ja foi atualizado com a correcao do `external_id`, mas a funcao antiga estava em execucao. Eu fiz o redeploy agora, mas ainda precisamos adicionar o filtro de status para resolver completamente o problema.

