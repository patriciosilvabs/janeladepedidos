

# Manter bloco do pedido no Forno ate o operador clicar DESPACHAR

## Problema

Dois trechos de codigo estao fazendo o bloco sumir antes da hora:

1. Um filtro que remove blocos sem itens `in_oven` -- quando o primeiro item de um combo fica pronto, se era o unico no forno, o bloco desaparece.
2. Um auto-despacho que envia o pedido para o Historico automaticamente quando o ultimo item fica pronto, sem esperar o operador clicar DESPACHAR.

## Solucao

- Remover o filtro que exige pelo menos um item `in_oven` no grupo. O bloco deve permanecer visivel enquanto houver itens do forno (prontos ou nao) e o pedido nao tiver sido despachado manualmente.
- Remover a logica de auto-despacho. O bloco so deve sair da aba Forno quando o operador clicar DESPACHAR explicitamente.
- Para pedidos com apenas 1 item total (renderizados como `OvenItemRow` simples), ao marcar como pronto, despachar automaticamente pois nao ha botao DESPACHAR nesse caso.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

**1. Remover filtro da linha 106:**
```
// ANTES
.filter(g => g.ovenItems.some(i => i.status === 'in_oven'))

// DEPOIS
// Removido — o bloco permanece enquanto nao for despachado
```

**2. Ajustar auto-despacho (linhas 123-132):**
- Manter auto-despacho APENAS para pedidos com 1 item total (sem bloco com botao DESPACHAR).
- Para pedidos com mais de 1 item (combos), NAO auto-despachar. O bloco fica visivel com itens prontos em verde ate o operador clicar DESPACHAR.

### Fluxo esperado apos a mudanca

```text
Pedido combo (3 itens):
1. Item 1 vai pro forno -> bloco aparece
2. Operador marca item 1 PRONTO -> item fica verde, bloco permanece
3. Item 2 vai pro forno -> timer aparece, item 1 continua verde
4. Operador marca item 2 PRONTO -> item fica verde, bloco permanece
5. Item 3 vai pro forno -> timer aparece
6. Operador marca item 3 PRONTO -> item fica verde, bloco permanece
7. Operador clica DESPACHAR -> bloco sai do Forno, vai pro Historico

Pedido simples (1 item):
1. Item vai pro forno -> OvenItemRow aparece
2. Operador marca PRONTO -> auto-despacho para Historico
```
