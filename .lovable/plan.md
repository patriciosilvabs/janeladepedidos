

# Persistir pedidos multi-item no Forno usando dados do banco

## Problema raiz

O painel do Forno usa uma variavel local na memoria (`knownOvenOrderIds` ref) para decidir quais pedidos mostrar. Quando o usuario troca de aba, muda de bancada, ou a internet oscila, o componente e desmontado e essa memoria e perdida. Ao voltar, pedidos onde todos os itens ja estao "prontos" desaparecem porque o sistema nao reconhece mais aquele pedido como pertencente ao forno.

A mesma coisa acontece com `dispatchedOrderIds` (controle de pedidos despachados) -- tambem e memoria local que se perde ao desmontar.

## Solucao

Eliminar toda dependencia de memoria local da sessao e usar exclusivamente dados do banco de dados para decidir o que mostrar e o que esconder.

### Regra simplificada

- **Mostrar** no Forno: qualquer pedido que tenha itens com `oven_entry_at` preenchido E cujo pedido NAO tenha `dispatched_at` preenchido
- **Esconder** do Forno: pedidos cujo `dispatched_at` ja foi preenchido (ou seja, ja foram despachados)

### Resultado

Mesmo apos troca de aba, internet cair e voltar, ou troca de bancada, os pedidos multi-item continuam visiveis ate o clique em DESPACHAR.

## Detalhes Tecnicos

### 1. Adicionar `dispatched_at` e `status` na query de items

**Arquivo:** `src/hooks/useOrderItems.ts`

Alterar o `select` da query principal e da query de siblings para incluir `dispatched_at` e `status` do pedido:

```sql
orders!inner(
  id, customer_name, cardapioweb_order_id, external_id,
  neighborhood, address, dispatched_at, status,
  stores(id, name)
)
```

Tambem atualizar o tipo `OrderItemWithOrder` em `src/types/orderItems.ts` para incluir esses campos.

### 2. Remover `knownOvenOrderIds` e `dispatchedOrderIds`

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx`

- Remover o `useRef` de `knownOvenOrderIds`
- Remover o `useState` de `dispatchedOrderIds`
- Na logica do `useMemo`, permitir que itens `ready` com `oven_entry_at` SEMPRE criem grupos, sem verificacao de sessao
- Filtrar grupos cujo pedido ja tem `dispatched_at` preenchido (usando dados do join com orders)

### 3. Persistir despacho no banco

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx`

Na funcao `handleMasterReady`, ao despachar, chamar a funcao RPC `set_order_dispatched` que ja existe no banco (seta `status = 'dispatched'` e `dispatched_at = NOW()`):

```typescript
await supabase.rpc('set_order_dispatched', { p_order_id: orderId });
```

Isso garante que mesmo apos remount, o pedido despachado nao reaparece.

### 4. Atualizar tipo OrderItemWithOrder

**Arquivo:** `src/types/orderItems.ts`

Adicionar ao tipo `orders`:
```typescript
orders?: {
  id: string;
  customer_name: string;
  cardapioweb_order_id: string | null;
  external_id: string | null;
  neighborhood: string | null;
  address: string;
  dispatched_at: string | null;  // NOVO
  status: string;                // NOVO
  stores?: { id: string; name: string } | null;
} | null;
```

### Fluxo apos a mudanca

```text
Item vai pro forno --> status 'in_oven', oven_entry_at preenchido
  |
Item marcado PRONTO --> status 'ready', oven_entry_at permanece
  |
Todos prontos --> botao DESPACHAR fica disponivel
  |
Click DESPACHAR --> chama set_order_dispatched (DB)
  |                 dispatched_at preenchido no banco
  |
Pedido some do Forno (baseado em dispatched_at != null)
```

Nenhuma dependencia de memoria local. Tudo baseado no banco.

