
# Plano: Corrigir Erro 400 na API do CardapioWeb

## Problema Identificado

A modificacao anterior causou erro 400 na API do CardapioWeb:

```
{"code":4000,"message":"Parametros invalidos.","details":"status contem valores invalidos"}
```

Os valores `open` e `pending` nao sao aceitos pela API. Isso quebrou completamente o polling - nenhum pedido esta sendo importado agora.

---

## Causa Raiz

A API do CardapioWeb nao aceita os status que tentamos usar:
- `open` - NAO ACEITO
- `pending` - NAO ACEITO
- `confirmed` - ACEITO (funcionava antes)

---

## Solucao em 2 Etapas

### Etapa 1: Correcao Imediata (Restaurar Funcionamento)

Voltar ao filtro que funcionava (`confirmed`) para restaurar o polling de pedidos de Delivery/Retirada/Balcao.

### Etapa 2: Busca Sem Filtro (Descobrir Status Validos)

Fazer uma chamada a API **sem o parametro status** para:
1. Receber todos os pedidos disponiveis
2. Verificar nos logs quais valores de `status` existem nos pedidos de Mesa
3. Usar esses valores reais em uma proxima iteracao

---

## Mudanca Proposta

**Arquivo**: `supabase/functions/poll-orders/index.ts`

### Opcao A: Remover filtro de status (buscar todos)

```typescript
// Buscar todos os pedidos sem filtrar por status
// Isso permite descobrir quais status reais a API retorna para pedidos de Mesa
const ordersResponse = await fetch(
  `${baseUrl}/api/partner/v1/orders`,
  {
    method: 'GET',
    headers: {
      'X-API-KEY': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  }
);
```

### Opcao B: Voltar apenas para `confirmed` (seguro, mas sem Mesas)

```typescript
// Voltar ao filtro anterior que funcionava
const ordersResponse = await fetch(
  `${baseUrl}/api/partner/v1/orders?status[]=confirmed`,
  {
    method: 'GET',
    headers: {
      'X-API-KEY': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  }
);
```

---

## Recomendacao

**Opcao A (Remover filtro)** e a melhor escolha porque:
1. Restaura o funcionamento imediato
2. Permite descobrir todos os pedidos disponiveis, incluindo Mesas
3. Os logs mostrarao o `order_type` e `status` real de cada pedido
4. Com essa informacao, podemos ajustar o filtro corretamente

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Remover filtro de status ou adicionar log para debug |

---

## Resultado Esperado

1. Polling volta a funcionar imediatamente
2. Todos os tipos de pedido (Delivery, Retirada, Mesa) serao capturados
3. Logs mostrarao os status reais para ajustes futuros
