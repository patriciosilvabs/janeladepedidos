

# Filtrar pedidos antigos do painel de Forno

## Problema

A query busca TODOS os itens com status `ready` que possuem `oven_entry_at`. Isso inclui pedidos antigos que ja foram finalizados ha horas, que nao deveriam aparecer no painel ativo do Forno.

## Solucao

Usar um `useRef` para rastrear quais pedidos foram "vistos" com pelo menos um item `in_oven` durante a sessao. Somente esses pedidos podem aparecer no painel. Itens `ready` de pedidos que nunca tiveram um item `in_oven` nesta sessao serao ignorados.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

1. Adicionar um `useRef<Set<string>>` chamado `knownOvenOrderIds` que armazena IDs de pedidos que ja tiveram pelo menos um item `in_oven` durante a sessao atual.

2. No bloco `useMemo`, antes de agrupar:
   - Percorrer `inOvenItems` e adicionar seus `order_id` ao `knownOvenOrderIds`.
   - Remover IDs de pedidos ja despachados do set.

3. Ao processar `readyFromOvenItems`, so criar/adicionar ao grupo se o `order_id` estiver no `knownOvenOrderIds`.

4. Isso garante que:
   - Pedidos antigos com status `ready` nao aparecem (nunca foram vistos com `in_oven` nesta sessao).
   - Pedidos combo cujo ultimo item foi marcado como pronto continuam visiveis (o `order_id` ja esta no set).
   - Ao despachar, o `order_id` e removido do set e do `dispatchedOrderIds`.

### Fluxo

```text
Sessao inicia -> knownOvenOrderIds = {}

Item do pedido #6255 chega com in_oven
-> knownOvenOrderIds = {6255}
-> Bloco aparece

Operador marca item pronto (ready)
-> knownOvenOrderIds ainda tem 6255
-> Bloco permanece

Operador clica DESPACHAR
-> dispatchedOrderIds.add(6255)
-> knownOvenOrderIds.delete(6255)
-> Bloco some

Pedido antigo #6253 com ready + oven_entry_at chega da query
-> 6253 nao esta em knownOvenOrderIds
-> Ignorado, nao aparece
```

