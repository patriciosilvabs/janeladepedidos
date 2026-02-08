
# Simplificar visualizacao de pedidos com 1 item no forno

## Problema

Pedidos que tem apenas 1 item no forno estao aparecendo dentro do bloco `OrderOvenBlock` (com header, bordas extras, botao DESPACHAR), ocupando espaco desnecessario no tablet. Isso acontece porque a condicao atual verifica o total de itens do pedido (incluindo itens de outros setores/"siblings"), e nao apenas os itens no forno.

## Solucao

Alterar a condicao no `OvenTimerPanel.tsx` para usar `OvenItemRow` simplificado sempre que houver apenas **1 item no forno e nenhum sibling pendente** (siblings ja prontos nao precisam de atencao visual).

A condicao atual:
```
if (totalItems === 1 && group.ovenItems.length === 1)
```

Sera alterada para:
```
if (group.ovenItems.length === 1 && group.siblingItems.filter(i => i.status !== 'ready').length === 0)
```

Isso garante que pedidos com 1 item no forno aparecem como card simples (sem o bloco extra), economizando espaco. O bloco `OrderOvenBlock` so sera usado quando houver multiplos itens no forno OU itens pendentes em outros setores que precisam ser acompanhados.

## Detalhe Tecnico

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx` (linhas 224-240)

Ajustar a condicao de renderizacao para considerar apenas itens no forno e siblings pendentes, nao o total absoluto.
