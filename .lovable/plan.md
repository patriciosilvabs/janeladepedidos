
# Plano: Corrigir Dois Problemas Criticos

## Problema 1: Loop de Pedidos Antigos

### Status Atual
A correcao do `poll-orders` **ja foi deployada** (usa `external_id` para verificar duplicatas). Os erros de "duplicate key" que voce ainda ve sao residuais de polls anteriores. O proximo ciclo de polling (30 segundos) nao deve mais gerar esses erros.

### Acao Adicional Recomendada
Limpar os pedidos duplicados que foram importados incorretamente para garantir que nao ha dados sujos no sistema.

## Problema 2: Botao "PRONTO" Nao Funciona

### Causa Raiz Identificada
O sistema tem **dois fluxos conflitantes**:

```text
FLUXO A - DASHBOARD (orders):
Botao PRONTO → mark_order_ready() → orders.status = 'waiting_buffer'
                  ↓
          Ignora order_items completamente

FLUXO B - KDS (order_items):  
INICIAR → claim_order_item() → order_items.status = 'in_prep'
FORNO → send_to_oven() → order_items.status = 'in_oven'
PRONTO → mark_item_ready() → order_items.status = 'ready'
                  ↓
          check_order_completion() → Se TODOS items ready → orders.status = 'waiting_buffer'
```

**O problema**: O botao "PRONTO" no Dashboard (Fluxo A) tenta mover o pedido diretamente para `waiting_buffer`, mas:
1. Os itens do pedido permanecem em `pending`
2. O sistema KDS ainda mostra esses itens para processar
3. Isso causa inconsistencia de estado

### Cenario do Usuario
Na imagem, o usuario esta no **Dashboard administrativo** (nao no KDS). Quando clica "PRONTO", ele espera que o pedido seja movido para o buffer. Mas o sistema hibrido (orders + order_items) pode estar causando confusao.

**Verificacao adicional necessaria**: O botao pode estar falhando silenciosamente porque o `mark_order_ready` usa `supabase.rpc()` com tipo `any`, o que pode ocultar erros de tipo.

---

## Solucao Proposta

### Mudanca 1: Corrigir chamada RPC no useOrders

O problema esta na chamada RPC que usa `as any` e pode estar falhando silenciosamente:

```typescript
// ANTES (linha 109 de useOrders.ts):
const { error } = await supabase.rpc('mark_order_ready' as any, {
  order_id: orderId,
});

// DEPOIS - Adicionar tratamento de erro e log:
const { data, error } = await supabase.rpc('mark_order_ready' as any, {
  order_id: orderId,
});

if (error) {
  console.error('[markAsReady] RPC error:', error);
  throw error;
}

console.log('[markAsReady] Success for order:', orderId);
```

### Mudanca 2: Unificar fluxos - Dashboard deve usar o mesmo fluxo do KDS

Para manter consistencia, quando o usuario clica "PRONTO" no Dashboard, o sistema deveria:
1. Marcar **todos os items** do pedido como `ready`
2. Deixar o trigger `check_order_completion` mover o pedido para `waiting_buffer`

Isso requer criar uma nova funcao RPC:

```sql
CREATE OR REPLACE FUNCTION mark_order_items_ready(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Marcar todos os itens como ready de uma vez
  UPDATE order_items
  SET 
    status = 'ready',
    ready_at = NOW()
  WHERE order_id = p_order_id
    AND status IN ('pending', 'in_prep', 'in_oven');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Verificar se pedido deve ir para buffer
  PERFORM check_order_completion(p_order_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'items_marked', v_count,
    'order_id', p_order_id
  );
END;
$$;
```

### Mudanca 3: Atualizar useOrders para usar a nova RPC

```typescript
const markAsReady = useMutation({
  mutationFn: async (orderId: string) => {
    const { data, error } = await supabase.rpc('mark_order_items_ready', {
      p_order_id: orderId,
    });

    if (error) {
      console.error('[markAsReady] RPC error:', error);
      throw error;
    }
    
    const result = data as { success: boolean; items_marked: number };
    if (!result.success) {
      throw new Error('Falha ao marcar itens como prontos');
    }

    console.log('[markAsReady] Marked', result.items_marked, 'items for order:', orderId);
    return result;
  },
  // ... resto da mutacao permanece igual
});
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/` (migracao SQL) | Criar funcao `mark_order_items_ready` |
| `src/hooks/useOrders.ts` | Usar nova RPC e adicionar logs de debug |
| `src/integrations/supabase/types.ts` | (auto-gerado) Tipos atualizados |

---

## Impacto das Mudancas

| Antes | Depois |
|-------|--------|
| Dashboard e KDS usam fluxos diferentes | Ambos usam o mesmo fluxo baseado em items |
| "PRONTO" move pedido mas ignora items | "PRONTO" marca items e trigger move pedido |
| Erros silenciosos na RPC | Logs de debug para diagnostico |
| Inconsistencia de estado possivel | Estado sempre consistente |

---

## Ordem de Execucao

1. Criar migracao SQL com nova funcao `mark_order_items_ready`
2. Atualizar `useOrders.ts` para usar a nova funcao
3. Adicionar logs de debug para facilitar troubleshooting futuro
4. Testar o botao "PRONTO" no Dashboard
5. Verificar que pedidos e itens ficam sincronizados

---

## Secao Tecnica

### Por que o botao nao funciona?

O botao "PRONTO" pode nao funcionar por varios motivos:

1. **Erro silencioso na RPC**: A chamada `supabase.rpc('mark_order_ready' as any, ...)` usa type assertion que oculta erros de tipo
2. **Inconsistencia de estado**: O pedido pode ja estar em outro status que nao e `pending`
3. **Conflito entre fluxos**: O Dashboard atualiza `orders` diretamente enquanto o KDS usa `order_items`

### Consistencia Order ↔ Items

O sistema utiliza items atomicos (`order_items`) como unidade de processamento. A funcao `check_order_completion` garante que:
- Quando TODOS os items de um pedido estao `ready`
- O pedido automaticamente vai para `waiting_buffer`

Forcando o Dashboard a seguir o mesmo fluxo, eliminamos a possibilidade de estados inconsistentes.

### Logs para Diagnostico

Adicionar logs ajudara a identificar problemas futuros:
- `[markAsReady] RPC error: ...` → Problema na chamada ao banco
- `[markAsReady] Success for order: ...` → Confirmacao visual
- `[markAsReady] Marked X items for order: ...` → Quantos items foram atualizados
