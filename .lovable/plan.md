
# Plano: Corrigir Mudança de Posição dos Cards

## Problema Raiz Identificado

O problema não está na ordenação do `displayItems`, mas sim em **como o React Query gerencia as atualizações**:

1. **Optimistic Update**: Quando clica INICIAR, o `claimItem` muda o status para `in_prep` otimisticamente
2. **Invalidate Query**: Logo após, `onSettled` chama `invalidateQueries`, que refaz a query
3. **Re-render**: O novo array de `items` causa recálculo de `displayItems`
4. **Problema de Timing**: Durante a transição, os dados podem momentaneamente vir em ordem diferente

---

## Solução

Adicionar uma **chave estável** para manter a posição dos cards usando o `id` do item como referência, e garantir ordenação consistente com fallback para `id`.

---

## Mudanças Propostas

### Arquivo 1: `src/components/kds/SectorQueuePanel.tsx`

**Adicionar ordenação secundária por ID para estabilidade absoluta**:

```tsx
// ANTES (linhas 105-111)
const displayItems = useMemo(() => {
  return [...items].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}, [items]);

// DEPOIS
const displayItems = useMemo(() => {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    // Ordenação primária por created_at
    if (timeA !== timeB) return timeA - timeB;
    // Ordenação secundária por ID para estabilidade absoluta
    return a.id.localeCompare(b.id);
  });
}, [items]);
```

---

### Arquivo 2: `src/hooks/useOrderItems.ts`

**Manter o item no mesmo lugar durante optimistic update** (não remove durante a transição):

```tsx
// Modificar onMutate do claimItem (linhas 110-127)
// Adicionar preservação de ordem durante update

onMutate: async (itemId) => {
  await queryClient.cancelQueries({ queryKey: ['order-items'] });
  const previousItems = queryClient.getQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status]);

  // Atualizar in-place mantendo a mesma posição no array
  queryClient.setQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status], (old) => {
    if (!old) return [];
    // Criar novo array mantendo a ordem exata
    return old.map((item) =>
      item.id === itemId
        ? {
            ...item,
            status: 'in_prep' as const,
            claimed_by: user?.id || null,
            claimed_at: new Date().toISOString(),
          }
        : item
    );
  });

  return { previousItems };
},
```

**Adicionar debounce maior no invalidate para evitar flicker**:

```tsx
// Modificar onSettled do claimItem (linha 134-136)
onSettled: () => {
  // Delay para evitar flicker visual durante transição
  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ['order-items'] });
  }, 100);
},
```

---

## Resumo das Mudanças

| Arquivo | Mudança | Motivo |
|---------|---------|--------|
| `SectorQueuePanel.tsx` | Adicionar ordenação secundária por ID | Garante ordem determinística mesmo com timestamps iguais |
| `useOrderItems.ts` | Delay no invalidateQueries do claimItem | Evita flicker durante transição otimística |

---

## Por que isso resolve

1. **Ordenação determinística**: Com `id` como fallback, mesmo que dois items tenham o mesmo `created_at`, a ordem será sempre a mesma
2. **Menos re-renders**: O delay no invalidate permite que a UI estabilize antes de buscar novos dados
3. **Posição fixa**: O card mantém sua posição visual durante toda a operação

---

## Fluxo Corrigido

```text
1. Usuário clica INICIAR no Card #2
2. Optimistic update: Card #2 muda para azul (in_prep), MANTÉM posição
3. Após 100ms: Query invalida e refaz
4. Dados retornam ordenados por created_at + id
5. Card #2 continua na mesma posição (#2)
```
