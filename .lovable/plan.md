

# Plano: Corrigir Loop de Pedidos Antigos no Tablet

## Problema Identificado

A funcao `poll-orders` tem um **bug critico na verificacao de duplicatas** que causa:
- Pedidos antigos aparecem repetidamente no tablet
- A cada ciclo de polling (30s), tenta reinserir pedidos ja existentes
- Erros de "duplicate key" no banco de dados

### Causa Raiz

```text
CODIGO ATUAL (BUGADO):

Linha 119: cardapiowebOrderId = String(order.id)     → "180702725" (ID interno API)
Linha 125: SELECT * WHERE cardapioweb_order_id = "180702725"  → NAO ENCONTRA
Linha 178: INSERT cardapioweb_order_id = orderCode   → "6242" (display_id)

RESULTADO:
- Verificacao busca "180702725" no banco
- Banco tem "6242" salvo
- Nunca encontra → tenta inserir
- Constraint external_id bloqueia (gera erro)
- Proximo poll: tenta de novo
- Loop infinito
```

## Solucao

Corrigir a verificacao de duplicatas para usar o campo `external_id` (que contem o ID interno da API e tem constraint unique):

```typescript
// ANTES (bugado):
const { data: existingOrder } = await supabase
  .from('orders')
  .select('id')
  .eq('cardapioweb_order_id', cardapiowebOrderId)  // Comparando maça com laranja
  .maybeSingle();

// DEPOIS (corrigido):
const { data: existingOrder } = await supabase
  .from('orders')
  .select('id')
  .eq('external_id', cardapiowebOrderId)  // Usa o campo correto
  .maybeSingle();
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Corrigir verificacao de duplicatas na linha 125 |

---

## Mudanca Detalhada

### poll-orders/index.ts

```typescript
// Linha 121-131: Corrigir verificacao de duplicatas
for (const order of ordersData) {
  result.processed++;
  const cardapiowebOrderId = String(order.id);  // ID interno da API (ex: 180702725)

  // Check if order already exists - CORRIGIDO: usar external_id em vez de cardapioweb_order_id
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('external_id', cardapiowebOrderId)  // <-- CORRECAO: external_id contem o ID da API
    .maybeSingle();

  if (existingOrder) {
    // Order already exists, skip without logging to reduce noise
    continue;
  }
  
  // ... resto do codigo de insercao
}
```

---

## Impacto da Correcao

| Antes | Depois |
|-------|--------|
| Cada poll tenta inserir 60+ pedidos | Cada poll so processa pedidos NOVOS |
| Muitos erros de duplicate key | Sem erros de duplicata |
| Pedidos antigos aparecem em loop | Apenas pedidos novos sao importados |
| Performance degradada | Performance otimizada |

---

## Acao Adicional: Limpar Pedidos Antigos

Apos corrigir o bug, recomendo executar uma limpeza para remover pedidos duplicados que podem ter sido criados:

```sql
-- Verificar se ha pedidos duplicados pelo external_id
SELECT external_id, COUNT(*) 
FROM orders 
WHERE external_id IS NOT NULL 
GROUP BY external_id 
HAVING COUNT(*) > 1;
```

Se houver duplicatas, podemos criar uma funcao de limpeza.

---

## Secao Tecnica

### Por que isso acontece?

O sistema tem dois identificadores diferentes para pedidos do CardapioWeb:

| Campo | Conteudo | Exemplo | Uso |
|-------|----------|---------|-----|
| `cardapioweb_order_id` | Numero visivel do pedido | "6242" | Exibicao para usuario |
| `external_id` | ID interno da API | "180702725" | Chamadas de API, verificacao de duplicatas |

O bug ocorreu porque a verificacao de duplicatas usava `cardapioweb_order_id` esperando encontrar o ID interno, mas esse campo contem o display_id.

### Constraint que salvou o sistema

A constraint `orders_external_id_key` no campo `external_id` impediu que duplicatas reais fossem criadas. Por isso a query de verificacao de duplicatas retornou vazio - o banco esta correto, mas a funcao tenta inserir e falha a cada poll.

