

# Manter bloco do pedido visivel no Forno ate o despacho

## Problema

Quando o operador clica "PRONTO" em um item do forno, o status muda de `in_oven` para `ready`. Como o painel filtra apenas itens com status `in_oven`, o item some da tela. Se era o ultimo item no forno daquele pedido, o bloco inteiro desaparece -- antes mesmo do operador poder clicar "DESPACHAR".

## Solucao

Alterar a query do painel de forno para buscar itens com status `in_oven` **OU** `ready` (que ainda nao foram despachados), e so remover o bloco quando o botao "DESPACHAR" for acionado.

## Detalhes Tecnicos

### 1. Arquivo: `src/hooks/useOrderItems.ts`

**Mudancas na query principal (linhas 50-56):**
- Quando `status` inclui `'in_oven'`, a query ja retorna esses itens normalmente.
- Nenhuma mudanca necessaria na query principal -- a mudanca sera no componente que consome os dados.

**Mudancas na query de siblings (linhas 329-356):**
- A query de siblings ja busca itens nao-oven do mesmo pedido, mas exclui `ready` com `neq('status', 'ready')` -- na verdade nao exclui `ready`, apenas exclui `in_oven` e `cancelled`. Entao siblings `ready` ja sao retornados. Isso esta correto.

**Nova abordagem -- buscar itens `in_oven` E `ready` juntos:**
- Alterar o `OvenTimerPanel` para usar `useOrderItems({ status: ['in_oven', 'ready'] })` em vez de apenas `{ status: 'in_oven' }`.
- Isso fara com que itens marcados como prontos continuem aparecendo na lista.

### 2. Arquivo: `src/components/kds/OvenTimerPanel.tsx`

- Mudar a chamada de `useOrderItems({ status: 'in_oven', sectorId })` para `useOrderItems({ status: ['in_oven', 'ready'], sectorId })`.
- No agrupamento, separar itens `in_oven` dos itens `ready` dentro de cada grupo de pedido.
- Itens `ready` que vieram do forno (possuem `oven_entry_at`) serao exibidos com visual "OK/PRONTO" (verde).
- Itens `ready` sem `oven_entry_at` sao itens de bancada ja prontos -- tratar como siblings prontos.
- Ajustar o contador do badge do header para mostrar apenas itens `in_oven` (nao contar os `ready`).
- **Remover o bloco somente apos DESPACHAR**: Quando o botao DESPACHAR for clicado, o sistema precisa de uma acao concreta para que esses itens saiam da visualizacao.

### 3. Acao do botao DESPACHAR

Atualmente o `handleMasterReady` no `OvenTimerPanel` apenas imprime um ticket. Nao ha transicao de estado. Para que o bloco desapareca apos o despacho, precisamos de uma das opcoes:

**Opcao escolhida: estado local de "despachado"**
- Manter um `Set<string>` local com IDs de pedidos ja despachados.
- Ao clicar DESPACHAR, adicionar o `order_id` ao set.
- Filtrar os `orderGroups` para excluir pedidos despachados.
- Isso funciona porque os itens `ready` eventualmente saem do painel quando o pedido muda de status no backend (trigger `check_order_completion` ja move para `waiting_buffer`).

### 4. Arquivo: `src/components/DispatchDashboard.tsx`

- Atualizar a query para usar `status: ['in_oven', 'ready']` tambem, para que a condicao de "vazio" considere ambos os status.

### 5. Arquivo: `src/components/kds/KDSItemsDashboard.tsx`

- Manter o badge da aba Forno contando apenas itens `in_oven` (sem mudanca necessaria, ja usa query separada).

### Fluxo apos as mudancas

```text
1. Bancada envia item 1 ao forno
   -> Bloco aparece com 1 timer + 2 "Aguardando..."

2. Operador clica PRONTO no item 1
   -> Item 1 mostra "OK" verde, bloco permanece
   -> Contador: 0/3 (nenhum despachado)

3. Bancada envia item 2 ao forno
   -> Item 2 aparece com timer, item 1 continua "OK"

4. Todos itens prontos, operador clica DESPACHAR
   -> Ticket impresso, bloco some da tela
   -> Backend move pedido para waiting_buffer
```
