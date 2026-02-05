

# Plano: Corrigir Erro "Não foi possível marcar item como pronto"

## Problema Identificado

O erro ocorre em situações de **race condition** quando:
1. Usuário clica em "PRONTO" no painel do forno
2. O item é marcado como `ready` no banco de dados
3. Antes da UI atualizar, o usuário clica novamente (ou há outra tab/dispositivo)
4. A segunda chamada falha porque o item já não está mais `in_oven`

A função `mark_item_ready` retorna `{success: false, error: 'not_in_oven'}`, mas o código trata isso como erro genérico.

## Causa Raiz

```typescript
// useOrderItems.ts - Linha 228-229
if (!result.success) {
  throw new Error('Não foi possível marcar o item como pronto');
}
```

O código não considera que `not_in_oven` pode significar que o item **já foi processado com sucesso** por outra requisição.

## Solução

Tratar o caso `not_in_oven` como sucesso silencioso, já que significa que o item já foi marcado como pronto.

---

## Mudanças

### Arquivo 1: `src/hooks/useOrderItems.ts`

**Atualizar a mutação `markItemReady`:**

```typescript
// Mark as ready
const markItemReady = useMutation({
  mutationFn: async (itemId: string) => {
    const { data, error } = await supabase.rpc('mark_item_ready', {
      p_item_id: itemId,
    });

    if (error) throw error;
    
    const result = data as unknown as { success: boolean; error?: string };
    
    // Tratar 'not_in_oven' como sucesso silencioso
    // Isso significa que o item já foi marcado como pronto por outra requisição
    if (!result.success && result.error === 'not_in_oven') {
      console.log(`[markItemReady] Item ${itemId} já foi marcado como pronto`);
      return { success: true, already_processed: true };
    }
    
    if (!result.success) {
      throw new Error(result.error || 'Não foi possível marcar o item como pronto');
    }

    return result;
  },
  // ... resto permanece igual
});
```

### Arquivo 2: `src/components/kds/OvenTimerPanel.tsx`

**Adicionar verificação antes de processar:**

```typescript
const handleMarkReady = async (itemId: string) => {
  // Evitar cliques duplos
  if (processingId) return;
  
  setProcessingId(itemId);
  try {
    const item = sortedItems.find(i => i.id === itemId);
    
    await markItemReady.mutateAsync(itemId);
    
    // Imprimir apenas se o item existir e não for já processado
    if (item) {
      printOrderReceipt(item);
    }
  } catch (error) {
    console.error('Erro ao marcar item como pronto:', error);
  } finally {
    setProcessingId(null);
  }
};
```

---

## Melhoria Adicional (Opcional)

Para evitar completamente cliques duplos, desabilitar o botão enquanto qualquer item está sendo processado:

```typescript
<Button
  onClick={onMarkReady}
  disabled={isProcessing || processingId !== null}  // Desabilitar durante qualquer processamento
  // ...
>
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useOrderItems.ts` | Tratar `not_in_oven` como sucesso silencioso |
| `src/components/kds/OvenTimerPanel.tsx` | Adicionar proteção contra cliques duplos |

---

## Resultado Esperado

1. Cliques duplos não causam mais erros no console
2. O fluxo continua funcionando normalmente
3. A impressão só ocorre uma vez por item
4. Múltiplos dispositivos/tabs não conflitam

