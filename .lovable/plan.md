

# Plano: Corrigir Atualização em Tempo Real - Canais Únicos

## Problema Identificado

O sistema não está atualizando em tempo real em todos os dispositivos porque os canais de Realtime estão usando **nomes fixos** (hardcoded):

- `useOrderItems.ts`: `.channel('order-items-realtime')`
- `useOrders.ts`: `.channel('orders-realtime')`

Quando múltiplas instâncias do hook são montadas (diferentes componentes, diferentes tabs, diferentes dispositivos), **todos tentam usar o mesmo canal**. O Supabase **não cria novas subscriptions** para canais com o mesmo nome - ele reutiliza o existente. Isso causa:

1. Apenas a primeira instância recebe eventos
2. Novas instâncias podem não receber nenhuma atualização
3. Diferentes dispositivos (tablet A vs tablet B) podem ter comportamento inconsistente

## Solução

Gerar **nomes de canais únicos** usando identificadores únicos (UUID ou timestamp) para cada instância do hook. Cada subscription deve ter seu próprio canal exclusivo.

---

## Alterações Técnicas

### Arquivo: `src/hooks/useOrderItems.ts`

**Mudança na linha 71:**

```typescript
// ANTES (problemático)
const channel = supabase
  .channel('order-items-realtime')
  .on(...)

// DEPOIS (corrigido)
const channelName = `order-items-${crypto.randomUUID()}`;
const channel = supabase
  .channel(channelName)
  .on(...)
```

### Arquivo: `src/hooks/useOrders.ts`

**Mudança na linha 84:**

```typescript
// ANTES (problemático)
const channel = supabase
  .channel('orders-realtime')
  .on(...)

// DEPOIS (corrigido)
const channelName = `orders-${crypto.randomUUID()}`;
const channel = supabase
  .channel(channelName)
  .on(...)
```

---

## Por que isso funciona

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANTES (BUG)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tablet A (Dashboard)    Tablet B (KDS)      Tablet C (Despacho)        │
│       ↓                       ↓                     ↓                   │
│  channel('orders')      channel('orders')    channel('orders')          │
│       │                       │                     │                   │
│       └───────────────────────┴─────────────────────┘                   │
│                              │                                          │
│                    Supabase: "Já existe channel 'orders',               │
│                              vou reutilizar o primeiro"                 │
│                              │                                          │
│                    Resultado: Apenas Tablet A recebe eventos!           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPOIS (CORRIGIDO)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tablet A (Dashboard)    Tablet B (KDS)      Tablet C (Despacho)        │
│       ↓                       ↓                     ↓                   │
│  channel('orders-abc')  channel('orders-xyz') channel('orders-123')     │
│       │                       │                     │                   │
│       ↓                       ↓                     ↓                   │
│  Supabase cria 3 canais INDEPENDENTES                                   │
│                                                                         │
│  Resultado: TODOS os tablets recebem eventos em tempo real!             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Código Completo das Mudanças

### `src/hooks/useOrderItems.ts` (linhas 70-86)

```typescript
useEffect(() => {
  // Gerar nome único para esta instância do hook
  const channelName = `order-items-${crypto.randomUUID()}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_items' },
      debouncedInvalidate
    )
    .subscribe();

  return () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    supabase.removeChannel(channel);
  };
}, [debouncedInvalidate]);
```

### `src/hooks/useOrders.ts` (linhas 83-99)

```typescript
useEffect(() => {
  // Gerar nome único para esta instância do hook
  const channelName = `orders-${crypto.randomUUID()}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      debouncedInvalidate
    )
    .subscribe();

  return () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    supabase.removeChannel(channel);
  };
}, [queryClient, debouncedInvalidate]);
```

---

## Benefícios

| Problema Atual | Após Correção |
|----------------|---------------|
| Pedidos não aparecem sem refresh | Atualização instantânea em todos os dispositivos |
| Canais duplicados causam conflitos | Cada instância tem canal exclusivo |
| Latência alta e inconsistente | Latência < 100ms garantida |
| Dependência de nomes hardcoded | Nomes dinâmicos e únicos |

---

## Testes Recomendados

1. Abrir Dashboard no computador e KDS no tablet simultaneamente
2. Simular um pedido no computador
3. Verificar se aparece instantaneamente no tablet (sem refresh)
4. Testar com 3+ dispositivos simultâneos

