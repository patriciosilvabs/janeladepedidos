

# Plano: Otimizar Performance do Polling de Pedidos

## Problema Identificado

A cada 30 segundos, a funcao `poll-orders` faz **muitas requisicoes desnecessarias**:

| Etapa | Requisicoes | Observacao |
|-------|-------------|------------|
| Lista todos os pedidos | 1 | Retorna 65+ pedidos |
| Verifica cada no banco | 65 | Query por pedido |
| Busca detalhes na API | 65 | Apenas para novos (mas ainda e muito) |
| **Total** | **~130+** | Por ciclo de 30s |

### Resultado
- Poll demora **varios segundos** para completar
- Usuario espera muito para ver novos pedidos
- Carga desnecessaria no banco e na API externa

---

## Solucao: Otimizacao em 3 Niveis

### 1. Filtrar por Status na Listagem (API)
Antes de iterar, verificar o status diretamente na listagem para evitar chamadas de detalhes desnecessarias:

```typescript
// ANTES: Busca detalhes para TODOS os pedidos, depois filtra
for (const order of ordersData) {
  // ... busca detalhes
  // ... depois verifica status (tarde demais!)
}

// DEPOIS: Filtra ANTES de buscar detalhes
for (const order of ordersData) {
  // Verificar status na listagem PRIMEIRO
  const listStatus = (order.status || '').toLowerCase();
  if (ignoredStatuses.includes(listStatus)) {
    continue; // Pula sem buscar detalhes!
  }
  
  // So busca detalhes para pedidos ativos
}
```

### 2. Verificar Existencia em Batch
Em vez de 65 queries individuais, buscar todos os external_ids de uma vez:

```typescript
// ANTES: 1 query por pedido
for (const order of ordersData) {
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('external_id', order.id);
}

// DEPOIS: 1 query para todos
const existingIds = await supabase
  .from('orders')
  .select('external_id')
  .in('external_id', ordersData.map(o => String(o.id)));

const existingSet = new Set(existingIds.data?.map(o => o.external_id) || []);

for (const order of ordersData) {
  if (existingSet.has(String(order.id))) continue;
  // Processar apenas novos
}
```

### 3. Processar Apenas Pedidos Novos
Combinar as duas otimizacoes para minimizar trabalho:

```typescript
// Fluxo otimizado:
// 1. Buscar lista de pedidos da API
// 2. Filtrar por status ativo (na lista, sem detalhes)
// 3. Buscar IDs existentes no banco (1 query)
// 4. Identificar apenas novos pedidos
// 5. Buscar detalhes SO dos novos
// 6. Inserir
```

---

## Comparativo de Performance

| Metrica | Antes | Depois |
|---------|-------|--------|
| Queries no banco | ~65/ciclo | ~2/ciclo |
| Chamadas API detalhes | ~65/ciclo | 0-5/ciclo |
| Tempo total estimado | 5-10s | <1s |
| Requisicoes HTTP | ~130 | ~3 |

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Otimizar verificacao de existencia e filtro de status |

---

## Implementacao Detalhada

### Mudancas no poll-orders/index.ts

**Adicionar filtro de status ANTES de verificar no banco (linha 117):**
```typescript
// Filtrar pedidos ja finalizados ANTES de processar
const activeOrders = ordersData.filter(order => {
  const status = (order.status || '').toLowerCase();
  return !['closed', 'canceled', 'cancelled', 'rejected', 'delivered', 'dispatched'].includes(status);
});

console.log(`[poll-orders] ${activeOrders.length} active orders out of ${ordersData.length} total`);
```

**Substituir verificacao individual por batch (apos o filtro):**
```typescript
// Buscar todos os external_ids existentes de uma vez
const orderIds = activeOrders.map(o => String(o.id));
const { data: existingOrders } = await supabase
  .from('orders')
  .select('external_id')
  .in('external_id', orderIds);

const existingSet = new Set(existingOrders?.map(o => o.external_id) || []);

// Filtrar apenas novos
const newOrders = activeOrders.filter(o => !existingSet.has(String(o.id)));

console.log(`[poll-orders] ${newOrders.length} new orders to import`);

// Processar apenas novos
for (const order of newOrders) {
  // Buscar detalhes e inserir...
}
```

---

## Impacto Esperado

- Polling completa em menos de 1 segundo
- Novos pedidos aparecem quase instantaneamente apos criados na API
- Menos carga no banco de dados e API externa
- Melhor experiencia para o usuario

