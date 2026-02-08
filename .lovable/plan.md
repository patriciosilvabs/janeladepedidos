

# Polling de Fallback para o KDS

## Problema
Itens/pedidos aparecem na aplicacao principal mas nao no tablet. A causa e a perda silenciosa da conexao realtime (WebSocket) em navegadores de tablet, que nao dispara a atualizacao automatica.

## Solucao
Adicionar um mecanismo de polling periodico como fallback ao realtime, garantindo que o KDS do tablet sempre receba os itens novos, independente do estado da conexao WebSocket.

## Detalhes Tecnicos

### 1. Modificar `src/hooks/useOrderItems.ts`
- Adicionar `refetchInterval` de 3 segundos na query principal de items, garantindo que mesmo sem realtime os dados sejam atualizados
- Adicionar `refetchOnWindowFocus: true` para atualizar quando o tablet voltar de background
- Reduzir `staleTime` para 0 quando em modo tablet (com `sectorId` definido) para forcar refetch

### 2. Modificar `src/hooks/useOrderItems.ts` - query principal
```typescript
const { data: items = [], isLoading, error } = useQuery({
  queryKey: ['order-items', sectorId, status],
  queryFn: async () => { /* ... existing code ... */ },
  staleTime: 1000,
  refetchInterval: sectorId ? 3000 : 5000, // Polling mais frequente no tablet
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: true, // Continua polling mesmo em background
});
```

### 3. Adicionar detector de visibilidade em `src/hooks/useOrderItems.ts`
Quando o tablet volta de uma aba inativa ou da tela de bloqueio, forcar uma invalidacao imediata:
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [queryClient]);
```

## Impacto
- Garante que itens novos aparecem no tablet em no maximo 3 segundos, independente do realtime
- Sem impacto visual (dados sao atualizados silenciosamente)
- Leve aumento no uso de rede (uma query a cada 3s), aceitavel para aplicacao de producao
- Compativel com o realtime existente (ambos coexistem sem conflito)

