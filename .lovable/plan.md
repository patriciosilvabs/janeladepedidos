
# Corrigir botão DESPACHAR que não remove o pedido da tela

## Problema raiz

O botão DESPACHAR funciona corretamente no banco de dados (o pedido #6600 está com `status: dispatched` e `dispatched_at` preenchido). Porém o pedido NÃO some da tela porque:

1. Após chamar `set_order_dispatched`, o código **não invalida o cache** de queries do React Query
2. A subscription de realtime escuta mudanças na tabela `order_items`, mas `set_order_dispatched` só altera a tabela `orders` -- nenhum evento realtime é disparado
3. Resultado: a tela nunca recarrega os dados atualizados

## Solução

Após chamar `set_order_dispatched` com sucesso, invalidar manualmente as queries de `order-items` e `orders` no React Query para forçar o refetch dos dados (que agora incluem `orders.status = 'dispatched'`).

## Detalhes Técnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

1. Importar `useQueryClient` do `@tanstack/react-query`
2. Chamar `queryClient.invalidateQueries` após o RPC de despacho ter sucesso

Na função `handleMasterReady`, após a chamada `supabase.rpc('set_order_dispatched', ...)`, adicionar:

```typescript
queryClient.invalidateQueries({ queryKey: ['order-items'] });
queryClient.invalidateQueries({ queryKey: ['orders'] });
```

Isso forçará o refetch dos itens. Quando os dados voltarem do banco, `orders.status` será `'dispatched'` e o filtro no `useMemo` removerá o grupo da tela.
