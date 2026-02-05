

# Plano: Incluir Pedidos de Mesa Abertos no Polling

## Problema Identificado

O polling atual consulta apenas pedidos com status `confirmed`:

```typescript
// poll-orders/index.ts - Linha 85
const ordersResponse = await fetch(`${baseUrl}/api/partner/v1/orders?status[]=confirmed`, {
```

No CardápioWeb, pedidos de **Mesa** têm status "Aberta" (`open`), não "confirmed". Por isso nunca são capturados pelo sistema.

**Evidência da imagem:**
- MESA 17, Pedido #6250 mostra status "**Aberta**"
- Este pedido não aparece no KDS porque o filtro ignora status `open`

---

## Solucao

Expandir o filtro de status para incluir todos os status relevantes:
- `confirmed` - Delivery/Retirada/Balcao confirmados
- `open` - Mesas abertas em consumo
- `pending` - Pedidos aguardando confirmacao (se aplicavel)

---

## Mudanca

**Arquivo**: `supabase/functions/poll-orders/index.ts`

### Antes (linha 85)

```typescript
const ordersResponse = await fetch(`${baseUrl}/api/partner/v1/orders?status[]=confirmed`, {
```

### Depois

```typescript
// Incluir todos os status relevantes para diferentes tipos de pedido:
// - confirmed: Delivery, Retirada, Balcao confirmados
// - open: Mesas abertas em consumo
// - pending: Pedidos aguardando confirmacao
const ordersResponse = await fetch(
  `${baseUrl}/api/partner/v1/orders?status[]=confirmed&status[]=open&status[]=pending`,
  {
```

---

## Fluxo Corrigido

```text
CardapioWeb API
      |
      v
poll-orders (Edge Function)
      |
      +--> GET /orders?status[]=confirmed  (Delivery, Retirada, Balcao)
      |               &status[]=open       (Mesas abertas) <-- NOVO
      |               &status[]=pending    (Aguardando)    <-- NOVO
      |
      v
Todos os tipos de pedido sao capturados
      |
      v
Aparecem no KDS com badge correto
```

---

## Consideracao Adicional

Para pedidos de mesa que estao "abertos", o cliente pode continuar adicionando itens. Uma opcao futura seria:

1. **Abordagem atual (mais simples)**: Importar todos os itens de uma vez e processar
2. **Abordagem avancada**: Verificar se ha novos itens em pedidos de mesa ja importados e adiciona-los incrementalmente

Por ora, a abordagem simples resolve o problema imediato.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/poll-orders/index.ts` | Adicionar `status[]=open` e `status[]=pending` ao endpoint de consulta |

---

## Resultado Esperado

- Pedidos de Mesa com status "Aberta" serao capturados pelo polling
- Aparecerao no Dashboard e nas bancadas KDS com badge verde (Mesa)
- O pedido MESA 17 (#6250) sera importado na proxima sincronizacao

