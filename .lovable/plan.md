
# Otimizacao de Tempo Real para KDS

## Diagnostico de Latencia Atual

### Problemas Identificados

| Problema | Impacto | Latencia Atual |
|----------|---------|----------------|
| Tabela `orders` sem realtime | Atualizacoes de pedidos dependem de invalidacao manual | ~200ms + query |
| Debounce em `useOrderItems` | Atrasa propagacao de mudancas | 150ms fixo |
| Debounce em `useOrders` | Atrasa propagacao de mudancas | 200ms fixo |
| Polling a cada 30s | Novos pedidos externos demoram ate 30s | 30000ms |
| Atualizacoes Otimistas | Ja implementado - BOM | 0ms (UI local) |

### Estado do Realtime

```text
Publicacao supabase_realtime:
  - order_items: HABILITADO
  - orders: NAO HABILITADO  <-- PROBLEMA
```

---

## Solucao Proposta

### 1. Habilitar Realtime para Tabela `orders`

Adicionar a tabela `orders` a publicacao realtime do Supabase:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
```

**Beneficio**: Todas as mudancas em pedidos (status, ready_at, dispatched_at) serao propagadas instantaneamente.

### 2. Reduzir Debounce para 50ms

Ajustar os valores de debounce em ambos os hooks:

| Hook | Antes | Depois | Reducao |
|------|-------|--------|---------|
| `useOrderItems.ts` | 150ms | 50ms | -67% |
| `useOrders.ts` | 200ms | 50ms | -75% |

**Tradeoff**: 50ms ainda evita "flood" de invalidacoes em batch, mas responde muito mais rapido.

### 3. Adicionar Subscricao Separada por Setor (Opcional)

Para ambientes com muitos tablets, usar filtro no canal realtime:

```typescript
// Filtrar eventos apenas para o setor do usuario
.on('postgres_changes', { 
  event: '*', 
  schema: 'public', 
  table: 'order_items',
  filter: `assigned_sector_id=eq.${sectorId}` // Menos eventos processados
}, ...)
```

**Beneficio**: Cada tablet processa apenas eventos relevantes.

---

## Arquitetura Otimizada

```text
┌────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ order_items  │    │    orders    │                          │
│  │   REALTIME   │    │   REALTIME   │  <- NOVO                 │
│  └──────┬───────┘    └──────┬───────┘                          │
└─────────┼───────────────────┼──────────────────────────────────┘
          │                   │
          ▼                   ▼
    ┌─────────────────────────────────┐
    │     Websocket Broadcast         │
    │     (< 100ms)                   │
    └─────────────┬───────────────────┘
                  │
    ┌─────────────┴─────────────────────┐
    │                                   │
    ▼                                   ▼
┌────────────┐                   ┌────────────┐
│ BANCADA A  │                   │ BANCADA B  │
│  50ms      │                   │  50ms      │
│  debounce  │                   │  debounce  │
└────────────┘                   └────────────┘
```

---

## Mudancas Necessarias

### Migration SQL

Habilitar realtime para `orders`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
```

### Codigo Frontend

1. **`src/hooks/useOrderItems.ts`**
   - Reduzir debounce de 150ms para 50ms
   - Adicionar filtro por setor no canal realtime (opcional)

2. **`src/hooks/useOrders.ts`**
   - Reduzir debounce de 200ms para 50ms

---

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Item capturado na Bancada A | ~350ms | ~100ms |
| Item enviado ao forno | ~350ms | ~100ms |
| Novo pedido via webhook | ~350ms | ~100ms |
| Pedido marcado como pronto | ~400ms | ~100ms |
| Propagacao entre 9 tablets | Consistente | Mais rapido |

---

## Arquivos a Modificar

| Tipo | Arquivo | Alteracao |
|------|---------|-----------|
| SQL | Migration | Adicionar `orders` ao realtime |
| Frontend | `src/hooks/useOrderItems.ts` | Debounce 150ms -> 50ms |
| Frontend | `src/hooks/useOrders.ts` | Debounce 200ms -> 50ms |

---

## Beneficios

- Latencia reduzida em ~70%
- Sincronizacao mais rapida entre bancadas
- Menos "colisoes" de claims por timing
- Experiencia mais responsiva para operadores

