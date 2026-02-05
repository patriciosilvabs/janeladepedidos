
# Plano: Alterar Intervalo de Sincronizacao para 20 Segundos

## Mudancas Necessarias

| Arquivo | Linha | Alteracao |
|---------|-------|-----------|
| `src/hooks/usePolling.ts` | 12 | Alterar valor padrao de `30000` para `20000` |
| `src/components/Dashboard.tsx` | 34 | Alterar parametro de `30000` para `20000` |

## Codigo Atualizado

### usePolling.ts
```typescript
// Linha 12
export function usePolling(intervalMs: number = 20000) {
```

### Dashboard.tsx
```typescript
// Linha 34
const { isPolling, lastSync, isEnabled: pollingEnabled, manualPoll } = usePolling(20000);
```

## Resultado

- Sincronizacao com CardapioWeb a cada **20 segundos** (era 30s)
- Novos pedidos serao capturados 33% mais rapido
- Intervalo seguro para evitar rate limits da API
