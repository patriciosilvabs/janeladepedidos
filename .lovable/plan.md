
# Corrigir pedidos prontos aparecendo no Forno

## Problema

O `knownOvenOrderIds` (ref) guarda os IDs dos pedidos para sempre durante a sessao. Mesmo depois que TODOS os itens de um pedido ficam prontos, o pedido continua aparecendo no Forno porque o ID ainda esta no ref. Isso causa a poluicao visual mostrada no screenshot.

## Solucao

Duas mudancas simples:

### 1. Filtrar grupos que nao tem mais itens no forno

Adicionar de volta o filtro no `orderGroups` para exigir pelo menos um item com status `in_oven`:

```
.filter(g => !dispatchedOrderIds.has(g.orderId) && g.ovenItems.some(i => i.status === 'in_oven'))
```

Isso garante que:
- Pedidos cujos itens ja estao todos prontos NAO aparecem no Forno
- Combos com alguns itens prontos e outros no forno CONTINUAM visiveis (o bloco mostra os prontos em verde e os ativos com timer)

### 2. Auto-despachar TODOS os pedidos quando o ultimo item fica pronto

Remover a condicao `totalItems === 1` do auto-despacho. Quando o ultimo item `in_oven` de qualquer pedido (combo ou simples) for marcado como pronto, despachar automaticamente para o Historico:

```
// ANTES: if (totalItems === 1 && remainingInOven.length === 0)
// DEPOIS: if (remainingInOven.length === 0)
```

### 3. Remover `knownOvenOrderIds`

O ref `knownOvenOrderIds` nao e mais necessario, pois o filtro por `in_oven` ja resolve o problema de pedidos antigos. Remover o ref e toda a logica associada para simplificar o codigo.

## Fluxo esperado

```text
Combo (3 itens no forno):
1. Itens vao pro forno -> bloco aparece com 3 timers
2. Item 1 marcado PRONTO -> bloco permanece (2 itens ainda in_oven)
3. Item 2 marcado PRONTO -> bloco permanece (1 item ainda in_oven)
4. Item 3 marcado PRONTO -> auto-despacho para Historico (0 in_oven)

Pedido simples (1 item):
1. Item vai pro forno -> aparece
2. Marcado PRONTO -> auto-despacho para Historico
```

## Arquivo alterado

- `src/components/kds/OvenTimerPanel.tsx`
