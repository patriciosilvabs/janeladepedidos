

# Manter bloco de pedido multi-item no Forno ate DESPACHAR

## Problema

Quando o operador marca o unico item `in_oven` de um combo como PRONTO, o bloco desaparece imediatamente. Isso acontece por dois motivos:

1. Grupos so sao criados a partir de itens `in_oven`. Quando o item vira `ready`, nenhum grupo e criado para esse pedido.
2. O filtro `.filter(g => g.ovenItems.some(i => i.status === 'in_oven'))` remove grupos sem itens ativos no forno.
3. O auto-despacho dispara para qualquer pedido quando o ultimo item fica pronto, incluindo combos.

## Solucao

Usar um `useRef` para rastrear pedidos que ja tiveram itens no forno durante a sessao. Isso permite que itens `ready` criem grupos mesmo quando nao ha mais itens `in_oven`, mantendo o bloco visivel ate o operador clicar DESPACHAR.

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenTimerPanel.tsx`

**1. Adicionar ref `knownOvenOrderIds`** para rastrear pedidos vistos com `in_oven` na sessao.

**2. No `useMemo`, popular o ref** a partir de `inOvenItems` e limpar pedidos ja despachados.

**3. Permitir que `readyFromOvenItems` criem grupos** se o pedido esta no `knownOvenOrderIds` (nao apenas se ja existe um grupo de `in_oven`).

**4. Remover o filtro `g.ovenItems.some(i => i.status === 'in_oven')`** - o bloco permanece enquanto nao for despachado.

**5. Auto-despachar apenas pedidos com 1 item total** (sem botao DESPACHAR). Combos ficam visiveis ate o clique em DESPACHAR.

**6. Limpar o `knownOvenOrderIds`** quando o pedido e despachado.

### Fluxo esperado

```text
Combo #6595 (3 itens: Frango, Mista, Calabresa):
1. Frango vai pro forno -> knownOvenOrderIds = {6595}, bloco aparece
2. Operador marca Frango PRONTO -> Frango vira ready, bloco PERMANECE
   (knownOvenOrderIds ainda tem 6595, readyFromOvenItems cria o grupo)
3. Mista vai pro forno -> bloco mostra Frango verde + Mista com timer
4. Operador marca Mista PRONTO -> bloco permanece
5. Calabresa vai pro forno -> bloco mostra 2 verdes + 1 timer
6. Operador marca Calabresa PRONTO -> bloco permanece (combo, nao auto-despacha)
7. Operador clica DESPACHAR -> bloco some, vai pro Historico

Pedido simples (1 item):
1. Item vai pro forno -> aparece
2. Marcado PRONTO -> auto-despacho para Historico
```
