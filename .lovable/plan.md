
# Plano: Corrigir Webhook para Suportar `ORDER_NEW` do CardápioWeb

## Diagnóstico do Problema

A análise dos logs e da documentação revelou a causa raiz:

1. **Evento esperado:** A documentação do CardápioWeb indica que novos pedidos disparam o evento `ORDER_NEW`
2. **Código atual:** O switch case trata apenas `order.placed`, `order.confirmed`, `order.created`
3. **Normalização:** `ORDER_NEW` é normalizado para `order.new`, que não é reconhecido
4. **Resultado:** O webhook ignora pedidos de mesa porque o evento não é mapeado corretamente

### Evidência dos Logs
- O evento `ORDER_CREATED` (10:09:01) foi recebido, mas o pedido 180706302 era tipo `takeout` (Retirada), não Mesa
- Pedidos de Mesa provavelmente usam evento `ORDER_NEW` conforme documentação

---

## Solução Proposta

### 1. Adicionar suporte ao evento `ORDER_NEW`

Incluir `'order.new'` no switch case que trata novos pedidos:

```typescript
switch (normalizedEvent) {
  case 'order.placed':
  case 'order.confirmed':
  case 'order.created':
  case 'order.new':  // ← Adicionar este caso
    result = await handleOrderPlaced(supabase, body, store);
    break;
  // ...
}
```

### 2. Expandir a condição de fetch da API

Garantir que `ORDER_NEW` também dispare o fetch de detalhes:

```typescript
if (['order.created', 'order.placed', 'order.new'].includes(normalizedEvent) && !body.order) {
  // Fetch order from API...
}
```

### 3. Melhorar logging para debug

Adicionar log específico para identificar tipo de pedido recebido:

```typescript
console.log(`Event: ${eventType}, normalized: ${normalizedEvent}, order_id: ${body.order_id}`);
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/webhook-orders/index.ts` | Adicionar `order.new` nos handlers de novos pedidos |

---

## Resultado Esperado

Após a implementação:
- Eventos `ORDER_NEW` serão reconhecidos e processados
- Pedidos de Mesa (`onsite`/`closed_table`) serão criados no KDS automaticamente
- Detalhes do pedido serão buscados via API quando o payload vier sem dados completos

---

## Teste de Validação

1. Deploy da função atualizada
2. Criar um novo pedido de Mesa no CardápioWeb
3. Verificar logs do webhook para confirmar recebimento de `ORDER_NEW`
4. Confirmar que o pedido aparece no tablet/preview como tipo `dine_in`
