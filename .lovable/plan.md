

## Correção: Duplicação de itens por race condition webhook + polling

### Problema

O pedido 6807 (Rodrigo Elamid) tem 6 itens no banco quando deveria ter 3. A causa é uma **race condition** entre o webhook (`webhook-orders`) e o polling (`poll-orders`):

1. O webhook recebe `order.placed` e insere o pedido + 3 itens (21:20:19.172)
2. O polling roda quase ao mesmo tempo, tenta inserir o mesmo pedido, falha pela constraint UNIQUE em `external_id`, mas no cenário onde o pedido já existe, o auto-repair verifica os itens e pode criar duplicatas (21:20:20.050)

A RPC `create_order_items_from_json` não tem nenhuma verificação de idempotência — sempre insere.

### Solução

**1. Adicionar guard de idempotência na RPC `create_order_items_from_json`**

No início da função, verificar se já existem itens para o `p_order_id`. Se sim, retornar 0 sem criar nada. Isso garante que mesmo que webhook e polling chamem a RPC simultaneamente, apenas a primeira execução cria os itens.

**2. Adicionar guard no `poll-orders` para pular pedidos que já têm itens**

No bloco de criação de itens após inserir um novo pedido (linhas ~464-477), verificar se já existem itens antes de chamar a RPC.

**3. Limpar os itens duplicados do pedido 6807**

Remover os 3 itens mais recentes (criados às 21:20:20), mantendo os 3 originais.

**4. Atualizar a versão para v1.0.15**

### Detalhes técnicos

**Migration SQL - Alterar RPC `create_order_items_from_json`:**

Adicionar no início do `BEGIN`:

```text
-- Idempotency guard: if items already exist for this order, skip
IF EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id LIMIT 1) THEN
  RETURN 0;
END IF;
```

**`supabase/functions/poll-orders/index.ts` (linhas ~464-477):**

Antes de chamar `create_order_items_from_json`, adicionar:

```text
// Guard: check if items already exist (webhook may have created them)
const { count: existingItemCount } = await supabase
  .from('order_items')
  .select('id', { count: 'exact', head: true })
  .eq('order_id', insertedOrder.id);

if (existingItemCount && existingItemCount > 0) {
  console.log(`[poll-orders] Items already exist for order ${insertedOrder.id} (created by webhook?), skipping`);
} else {
  // ... existing RPC call ...
}
```

**Limpeza SQL do pedido 6807:**

Deletar os 3 itens duplicados (IDs com `created_at = 2026-02-10 21:20:20.050001`).

### Impacto

- A RPC se torna idempotente — segura para chamadas concorrentes
- O polling não cria itens se o webhook já os criou
- Nenhum impacto no fluxo normal (a guard só atua quando itens já existem)
